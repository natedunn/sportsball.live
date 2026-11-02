import { useMemo, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { Image } from "@/components/ui/image";
import { useIsDarkMode } from "@/lib/use-is-dark-mode";
import { useHasTabAnimated } from "@/components/team-details/animation-context";
import { getTeamStaticData, leagueLabels } from "@/lib/teams";
import { cn } from "@/lib/utils";
import type { League } from "@/lib/shared/league";

const teamRoutes: Record<League, string> = {
	nba: "/nba/team/$teamId",
	wnba: "/wnba/team/$teamId",
	gleague: "/gleague/team/$teamId",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayoffTeamInfo {
	espnTeamId: string;
	name: string;
	abbreviation: string;
	location: string;
	conference: string | undefined;
	conferenceRank: number | undefined;
}

interface PlayoffGame {
	espnGameId: string;
	gameDate: string;
	scheduledStart: number;
	eventStatus: string;
	homeScore: number | undefined;
	awayScore: number | undefined;
	homeTeam: PlayoffTeamInfo | null;
	awayTeam: PlayoffTeamInfo | null;
}

interface PlayoffTeamSeed {
	espnTeamId: string;
	name: string;
	abbreviation: string;
	location: string;
	conference: string | undefined;
	conferenceRank: number | undefined;
	/** Seed for leagues that seed the playoffs league-wide (WNBA) */
	leagueRank?: number;
	wins: number;
	losses: number;
}

export interface PlayoffBracketData {
	games: PlayoffGame[];
	teams: PlayoffTeamSeed[];
}

// ---------------------------------------------------------------------------
// Bracket data model
// ---------------------------------------------------------------------------

interface BracketTeam {
	espnTeamId: string;
	abbreviation: string;
	name: string;
	fullName: string;
	slug: string | undefined;
	seed: number;
	logoUrl: string;
	darkColor: string;
	lightColor: string;
	record: string;
}

interface BracketSeries {
	id: string;
	round: number;
	conference: "east" | "west" | "finals" | "league";
	topTeam: BracketTeam | null;
	bottomTeam: BracketTeam | null;
	topWins: number;
	bottomWins: number;
	status: "upcoming" | "active" | "completed";
	winner: "top" | "bottom" | null;
	gameIds: string[];
	/** A one-game round's final score, shown in place of series wins */
	score?: { top: number; bottom: number };
}

export interface BracketData {
	west: BracketSeries[][];
	east: BracketSeries[][];
	finals: BracketSeries;
}

// ---------------------------------------------------------------------------
// Build bracket from raw data
// ---------------------------------------------------------------------------

const FIRST_ROUND_MATCHUPS = [
	[1, 8],
	[4, 5],
	[3, 6],
	[2, 7],
] as const;

// Wins that take a series, per conference round and in the Finals. NBA: best
// of seven throughout. G League: single games, then a best-of-three Finals.
const CONFERENCE_FORMAT: Partial<
	Record<League, { winsByRound: number[]; finalsWins: number }>
> = {
	nba: { winsByRound: [4, 4, 4], finalsWins: 4 },
	gleague: { winsByRound: [1, 1, 1], finalsWins: 2 },
};
// WNBA (since 2025): best-of-three first round, best-of-five semifinals,
// best-of-seven Finals
const WNBA_WINS_BY_ROUND = [2, 3, 4];

function buildTeamInfo(
	teamData: PlayoffTeamSeed,
	league: League,
	seed: number,
): BracketTeam {
	const staticData = getTeamStaticData(league, [
		teamData.espnTeamId,
		teamData.abbreviation,
	]);

	const logoUrl = staticData
		? `/api/${league}/logo/${staticData.logoSlug}`
		: "";
	const darkColor = staticData?.colors.display.dark ?? "666666";
	const lightColor = staticData?.colors.display.light ?? "666666";

	return {
		espnTeamId: teamData.espnTeamId,
		abbreviation: teamData.abbreviation,
		name: teamData.name,
		fullName: staticData?.fullName ?? `${teamData.location} ${teamData.name}`,
		slug: staticData?.api.slug,
		seed,
		logoUrl,
		darkColor,
		lightColor,
		record: `${teamData.wins}-${teamData.losses}`,
	};
}

/** Games grouped by the pair of teams playing, keyed by their sorted IDs */
function groupSeries(games: PlayoffGame[]) {
	const seriesMap = new Map<string, PlayoffGame[]>();
	for (const game of games) {
		if (!game.homeTeam || !game.awayTeam) continue;
		const key = [game.homeTeam.espnTeamId, game.awayTeam.espnTeamId]
			.sort()
			.join("-");
		const seriesGames = seriesMap.get(key) ?? [];
		seriesGames.push(game);
		seriesMap.set(key, seriesGames);
	}
	return seriesMap;
}

function getSeriesResult(
	teamIds: [string, string],
	seriesGames: PlayoffGame[],
	winsNeeded: number,
) {
	let team1Wins = 0;
	let team2Wins = 0;
	const gameIds: string[] = [];

	for (const game of seriesGames) {
		if (!game.homeTeam || !game.awayTeam) continue;
		gameIds.push(game.espnGameId);
		if (game.eventStatus !== "completed") continue;
		if (
			game.homeScore === undefined ||
			game.awayScore === undefined ||
			!Number.isFinite(game.homeScore) ||
			!Number.isFinite(game.awayScore) ||
			game.homeScore === game.awayScore
		) {
			continue;
		}
		const homeWon = game.homeScore > game.awayScore;
		const winnerId = homeWon
			? game.homeTeam.espnTeamId
			: game.awayTeam.espnTeamId;
		if (winnerId === teamIds[0]) team1Wins++;
		else team2Wins++;
	}

	const hasActiveGame = seriesGames.some(
		(g) =>
			g.eventStatus === "in_progress" ||
			g.eventStatus === "halftime" ||
			g.eventStatus === "overtime" ||
			g.eventStatus === "end_of_period",
	);

	const isCompleted = team1Wins >= winsNeeded || team2Wins >= winsNeeded;
	const status: BracketSeries["status"] = isCompleted
		? "completed"
		: team1Wins + team2Wins > 0 || hasActiveGame
			? "active"
			: "upcoming";

	return { team1Wins, team2Wins, status, gameIds };
}

function getWinner(series: BracketSeries): BracketTeam | null {
	if (series.winner === "top") return series.topTeam;
	if (series.winner === "bottom") return series.bottomTeam;
	return null;
}

/** One series between two teams (or TBD), with its wins counted from the games */
function makeSeries(
	id: string,
	round: number,
	conference: BracketSeries["conference"],
	topTeam: BracketTeam | null,
	bottomTeam: BracketTeam | null,
	seriesMap: Map<string, PlayoffGame[]>,
	winsNeeded: number,
): BracketSeries {
	const series: BracketSeries = {
		id,
		round,
		conference,
		topTeam,
		bottomTeam,
		topWins: 0,
		bottomWins: 0,
		status: "upcoming",
		winner: null,
		gameIds: [],
	};
	if (!topTeam || !bottomTeam) return series;

	const ids = [topTeam.espnTeamId, bottomTeam.espnTeamId].sort() as [
		string,
		string,
	];
	const seriesGames = seriesMap.get(ids.join("-"));
	if (!seriesGames) return series;

	const result = getSeriesResult(ids, seriesGames, winsNeeded);
	const topIsFirst = ids[0] === topTeam.espnTeamId;
	series.topWins = topIsFirst ? result.team1Wins : result.team2Wins;
	series.bottomWins = topIsFirst ? result.team2Wins : result.team1Wins;
	series.status = result.status;
	series.gameIds = result.gameIds;
	if (result.status === "completed") {
		series.winner = series.topWins > series.bottomWins ? "top" : "bottom";
	}
	if (winsNeeded === 1 && result.status === "completed") {
		const final = seriesGames.find((g) => g.eventStatus === "completed");
		if (final?.homeTeam && final.homeScore !== undefined && final.awayScore !== undefined) {
			const topIsHome = final.homeTeam.espnTeamId === topTeam.espnTeamId;
			series.score = {
				top: topIsHome ? final.homeScore : final.awayScore,
				bottom: topIsHome ? final.awayScore : final.homeScore,
			};
		}
	}
	return series;
}

/**
 * The rounds of an eight-team bracket (1v8, 4v5, 3v6, 2v7, no reseeding), from
 * the first round to the single series at the end. `seededTeams` are the
 * playoff teams with their seeds, and `winsByRound` how many wins take a
 * series in each round.
 */
function buildRounds(
	seededTeams: { team: PlayoffTeamSeed; seed: number }[],
	seriesMap: Map<string, PlayoffGame[]>,
	league: League,
	conference: BracketSeries["conference"],
	winsByRound: number[],
): BracketSeries[][] {
	const teamWithSeed = (seed: number) => {
		const entry = seededTeams.find((t) => t.seed === seed);
		return entry ? buildTeamInfo(entry.team, league, seed) : null;
	};

	const rounds: BracketSeries[][] = [
		FIRST_ROUND_MATCHUPS.map(([topSeed, bottomSeed], idx) =>
			makeSeries(
				`${conference}-r1-${idx}`,
				1,
				conference,
				teamWithSeed(topSeed),
				teamWithSeed(bottomSeed),
				seriesMap,
				winsByRound[0],
			),
		),
	];

	while (rounds[rounds.length - 1].length > 1) {
		const previous = rounds[rounds.length - 1];
		const round = rounds.length + 1;
		const next: BracketSeries[] = [];
		for (let i = 0; i < previous.length; i += 2) {
			next.push(
				makeSeries(
					`${conference}-r${round}-${i / 2}`,
					round,
					conference,
					getWinner(previous[i]),
					getWinner(previous[i + 1]),
					seriesMap,
					winsByRound[round - 1],
				),
			);
		}
		rounds.push(next);
	}

	return rounds;
}

/**
 * A bracket per conference, seeded by `conferenceRank`, then the Finals (NBA,
 * G League)
 */
export function buildBracket(
	data: PlayoffBracketData,
	league: League,
): BracketData {
	const seriesMap = groupSeries(data.games);
	const format = CONFERENCE_FORMAT[league] ?? CONFERENCE_FORMAT.nba!;

	const conferenceRounds = (conf: "east" | "west") =>
		buildRounds(
			data.teams
				.filter(
					(t) =>
						t.conference?.toLowerCase().includes(conf) &&
						t.conferenceRank !== undefined,
				)
				.map((team) => ({ team, seed: team.conferenceRank! })),
			seriesMap,
			league,
			conf,
			format.winsByRound,
		);

	const west = conferenceRounds("west");
	const east = conferenceRounds("east");
	const finals = makeSeries(
		"finals",
		4,
		"finals",
		getWinner(west[2][0]),
		getWinner(east[2][0]),
		seriesMap,
		format.finalsWins,
	);

	return { west, east, finals };
}

/**
 * The WNBA bracket: the top eight teams in the league table, seeded 1 to 8
 * whatever their conference, through to the Finals.
 */
export function buildLeagueBracket(
	data: PlayoffBracketData,
	league: League,
): BracketSeries[][] {
	return buildRounds(
		data.teams
			.filter((t) => t.leagueRank !== undefined)
			.map((team) => ({ team, seed: team.leagueRank! })),
		groupSeries(data.games),
		league,
		"league",
		WNBA_WINS_BY_ROUND,
	);
}

// ---------------------------------------------------------------------------
// UI Primitives
// ---------------------------------------------------------------------------

function SeriesLabel({ series }: { series: BracketSeries }) {
	if (series.status === "upcoming") return null;

	const totalGames = series.topWins + series.bottomWins;
	if (totalGames === 0) return null;

	const leader =
		series.topWins > series.bottomWins
			? series.topTeam
			: series.bottomWins > series.topWins
				? series.bottomTeam
				: null;

	if (series.score && leader) {
		return (
			<span className="text-[10px] text-muted-foreground">
				{leader.abbreviation} wins
			</span>
		);
	}

	if (series.status === "completed" && leader) {
		return (
			<span className="text-[10px] text-muted-foreground">
				{leader.abbreviation} wins {Math.max(series.topWins, series.bottomWins)}
				-{Math.min(series.topWins, series.bottomWins)}
			</span>
		);
	}

	if (leader) {
		return (
			<span className="text-[10px] text-muted-foreground">
				{leader.abbreviation} leads{" "}
				{Math.max(series.topWins, series.bottomWins)}-
				{Math.min(series.topWins, series.bottomWins)}
			</span>
		);
	}

	return (
		<span className="text-[10px] text-muted-foreground">
			Tied {series.topWins}-{series.bottomWins}
		</span>
	);
}

function TeamRow({
	team,
	wins,
	isWinner,
	isLoser,
	isTop,
	league,
}: {
	team: BracketTeam | null;
	wins: number;
	isWinner: boolean;
	isLoser: boolean;
	isTop: boolean;
	isDark: boolean;
	league: League;
}) {
	if (!team) {
		return (
			<div
				className={cn(
					"flex items-start gap-2 px-2.5 py-2",
					isTop ? "rounded-t-lg" : "rounded-b-lg",
				)}
			>
				<span className="text-[10px] font-bold text-muted-foreground/30 tabular-nums w-3 text-center shrink-0 mt-0.5">
					-
				</span>
				<div className="size-5 rounded-full bg-muted/50 shrink-0 mt-0.5" />
				<div className="flex flex-col min-w-0">
					<span className="text-sm font-medium text-muted-foreground/40 italic">
						TBD
					</span>
				</div>
				<span className="ml-auto text-xs font-bold tabular-nums mt-0.5 invisible">
					0
				</span>
			</div>
		);
	}

	const content = (
		<>
			<span className="text-[10px] font-bold text-muted-foreground tabular-nums w-3 text-center shrink-0 mt-0.5">
				{team.seed}
			</span>
			<Image
				src={team.logoUrl}
				alt={team.name}
				width={20}
				height={20}
				className="size-5 shrink-0 object-contain mt-0.5"
				proxy={false}
			/>
			<div className="flex flex-col min-w-0">
				<span
					className={cn(
						"text-sm font-semibold leading-tight group-hover:underline",
						isWinner && "text-foreground",
					)}
				>
					{team.abbreviation}
				</span>
				<span className="text-[10px] text-muted-foreground leading-tight truncate">
					{team.fullName}
				</span>
			</div>
			<span className="ml-auto text-xs font-bold tabular-nums mt-0.5">
				{wins}
			</span>
		</>
	);

	const rowClass = cn(
		"flex items-start gap-2 px-2.5 py-2 transition-all",
		isTop ? "rounded-t-lg" : "rounded-b-lg",
		isLoser && "opacity-50",
		isWinner && "bg-muted/50",
	);

	if (team.slug) {
		return (
			<Link
				to={teamRoutes[league]}
				params={{ teamId: team.slug }}
				className={cn(rowClass, "group hover:bg-muted/70")}
			>
				{content}
			</Link>
		);
	}

	return <div className={rowClass}>{content}</div>;
}

function SeriesCard({
	series,
	isDark,
	league,
	header,
}: {
	series: BracketSeries;
	isDark: boolean;
	league: League;
	header?: string;
}) {
	const isUpcoming = series.status === "upcoming";

	return (
		<div className="flex flex-col bg-muted rounded-2xl p-1 border">
			<div
				className={cn(
					"rounded-xl border bg-card overflow-hidden transition-all border-border",
					isUpcoming && "border-dashed border-border/50",
				)}
			>
				{header && (
					<div className="px-3 py-1.5 bg-muted/50 border-b border-border/40 text-center">
						<span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
							{header}
						</span>
					</div>
				)}
				<TeamRow
					team={series.topTeam}
					wins={series.score?.top ?? series.topWins}
					isWinner={series.winner === "top"}
					isLoser={series.winner === "bottom"}
					isTop={true}
					isDark={isDark}
					league={league}
				/>
				<div className="h-px bg-border/40" />
				<TeamRow
					team={series.bottomTeam}
					wins={series.score?.bottom ?? series.bottomWins}
					isWinner={series.winner === "bottom"}
					isLoser={series.winner === "top"}
					isTop={false}
					isDark={isDark}
					league={league}
				/>
			</div>
			<div className="text-center">
				<SeriesLabel series={series} />
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Conference Tab View — pyramid layout (bottom-up)
// ---------------------------------------------------------------------------

const ROUND_LABELS = ["First Round", "Conference Semis", "Conference Finals"];

function RoundRow({
	series,
	label,
	isDark,
	league,
	delay = 0,
	headerMap,
}: {
	series: BracketSeries[];
	label: string;
	isDark: boolean;
	league: League;
	delay?: number;
	headerMap?: Record<string, string>;
}) {
	const hasTabAnimated = useHasTabAnimated();
	const animate = useRef(!hasTabAnimated && delay !== undefined).current;
	const [visible, setVisible] = useState(!animate);

	useEffect(() => {
		if (!animate) return;
		const timeout = setTimeout(() => setVisible(true), delay);
		return () => clearTimeout(timeout);
	}, [animate, delay]);

	return (
		<div
			className={cn(
				"flex flex-col gap-6",
				animate
					? cn(
							"transition-[opacity,transform] duration-700 ease-out",
							visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
						)
					: "",
			)}
		>
			{/* Round header */}
			<div className="flex items-center gap-3">
				<div className="h-px flex-1 bg-border" />
				<h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
					{label}
				</h3>
				<div className="h-px flex-1 bg-border" />
			</div>

			{/* Cards — grid sized to count, centered via auto margins */}
			{series.length === 4 ? (
				<>
					{/* Mobile: single column */}
					<div className="grid grid-cols-1 gap-3 sm:hidden">
						{series.map((s) => (
							<SeriesCard key={s.id} series={s} isDark={isDark} league={league} header={headerMap?.[s.id]} />
						))}
					</div>
					{/* Desktop: two branches with dot divider */}
					<div className="hidden sm:flex items-start justify-center gap-6 mx-auto w-full">
						<div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
							<SeriesCard series={series[0]} isDark={isDark} league={league} header={headerMap?.[series[0].id]} />
							<SeriesCard series={series[1]} isDark={isDark} league={league} header={headerMap?.[series[1].id]} />
						</div>
						<div className="flex items-center self-stretch">
							<div className="size-1.5 rounded-full bg-border" />
						</div>
						<div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
							<SeriesCard series={series[2]} isDark={isDark} league={league} header={headerMap?.[series[2].id]} />
							<SeriesCard series={series[3]} isDark={isDark} league={league} header={headerMap?.[series[3].id]} />
						</div>
					</div>
				</>
			) : series.length === 2 ? (
				<>
					{/* Mobile: single column */}
					<div className="grid grid-cols-1 gap-3 sm:hidden">
						{series.map((s) => (
							<SeriesCard key={s.id} series={s} isDark={isDark} league={league} header={headerMap?.[s.id]} />
						))}
					</div>
					{/* Desktop: side by side with dot divider */}
					<div className="hidden sm:flex items-start justify-center gap-6 mx-auto w-full max-w-lg">
						<div className="flex-1 min-w-0">
							<SeriesCard series={series[0]} isDark={isDark} league={league} header={headerMap?.[series[0].id]} />
						</div>
						<div className="flex items-center self-stretch">
							<div className="size-1.5 rounded-full bg-border" />
						</div>
						<div className="flex-1 min-w-0">
							<SeriesCard series={series[1]} isDark={isDark} league={league} header={headerMap?.[series[1].id]} />
						</div>
					</div>
				</>
			) : (
				<div className="grid grid-cols-1 max-w-sm sm:max-w-56 mx-auto w-full">
					{series.map((s) => (
						<SeriesCard key={s.id} series={s} isDark={isDark} league={league} header={headerMap?.[s.id]} />
					))}
				</div>
			)}
		</div>
	);
}

function ConferenceView({
	rounds,
	isDark,
	league,
}: {
	rounds: BracketSeries[][];
	isDark: boolean;
	league: League;
}) {
	// Render bottom-up: Conference Finals at top, First Round at bottom
	const reversed = [...rounds].reverse();
	const reversedLabels = [...ROUND_LABELS].reverse();

	return (
		<div className="flex flex-col gap-12">
			{reversed.map((roundSeries, idx) => (
				<RoundRow
					key={idx}
					series={roundSeries}
					label={reversedLabels[idx]}
					isDark={isDark}
					league={league}
					delay={idx * 100}
				/>
			))}
		</div>
	);
}

function ChampionBanner({
	champion,
	league,
}: {
	champion: BracketTeam;
	league: League;
}) {
	return (
		<div className="flex flex-col items-center gap-2">
			<Trophy className="size-10 text-primary" />
			<span className="text-sm font-bold uppercase tracking-widest text-primary">
				{leagueLabels[league]} Champion
			</span>
			<div className="flex items-center gap-3">
				<Image
					src={champion.logoUrl}
					alt={champion.name}
					width={40}
					height={40}
					className="size-10 object-contain"
					proxy={false}
				/>
				<span className="text-xl font-bold">{champion.fullName}</span>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// League View — the WNBA's single bracket, Finals on top
// ---------------------------------------------------------------------------

function LeagueView({
	rounds,
	isDark,
	league,
}: {
	rounds: BracketSeries[][];
	isDark: boolean;
	league: League;
}) {
	const champion = getWinner(rounds[rounds.length - 1][0]);
	const labels = ["First Round", "Semifinals", `${leagueLabels[league]} Finals`];

	return (
		<div className="flex flex-col gap-12">
			{champion && <ChampionBanner champion={champion} league={league} />}
			{[...rounds].reverse().map((roundSeries, idx) => (
				<RoundRow
					key={idx}
					series={roundSeries}
					label={labels[rounds.length - 1 - idx]}
					isDark={isDark}
					league={league}
					delay={idx * 100}
				/>
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Finals Tab View — same pyramid layout, just different rounds
// ---------------------------------------------------------------------------

function FinalsView({
	finals,
	westCF,
	eastCF,
	isDark,
	league,
}: {
	finals: BracketSeries;
	westCF: BracketSeries | undefined;
	eastCF: BracketSeries | undefined;
	league: League;
	isDark: boolean;
}) {
	const champion =
		finals.winner === "top"
			? finals.topTeam
			: finals.winner === "bottom"
				? finals.bottomTeam
				: null;

	// Build rounds array just like conference view: finals on top, conf finals below
	const cfSeries = [westCF, eastCF].filter(
		(s): s is BracketSeries => s !== undefined,
	);

	// Add header to finals series for the "West vs East" label
	const finalsWithHeader = {
		...finals,
		_header: `${finals.topTeam ? "West" : "TBD"} vs ${finals.bottomTeam ? "East" : "TBD"}`,
	};

	return (
		<div className="flex flex-col gap-12">
			{champion && <ChampionBanner champion={champion} league={league} />}

			{/* Finals — 1 card */}
			<RoundRow
				series={[finalsWithHeader]}
				label={`${leagueLabels[league]} Finals`}
				isDark={isDark}
				league={league}
				delay={0}
				headerMap={{ [finals.id]: finalsWithHeader._header }}
			/>

			{/* Conference Finals — 2 cards */}
			{cfSeries.length > 0 && (
				<RoundRow
					series={cfSeries}
					label="Conference Finals"
					isDark={isDark}
					league={league}
					delay={100}
				/>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/** Conference brackets and the Finals (NBA), or one league-wide bracket (WNBA) */
export type PlayoffView = "western" | "eastern" | "finals" | "league";

interface PlayoffBracketProps {
	data: PlayoffBracketData;
	league: League;
	view: PlayoffView;
}

export function PlayoffBracket({ data, league, view }: PlayoffBracketProps) {
	const isDark = useIsDarkMode();
	const bracket = useMemo(
		() => (view === "league" ? null : buildBracket(data, league)),
		[data, league, view],
	);
	const leagueRounds = useMemo(
		() => (view === "league" ? buildLeagueBracket(data, league) : null),
		[data, league, view],
	);

	if (!data.teams.length) {
		return (
			<div className="flex flex-col items-center justify-center py-20 gap-4">
				<div className="text-4xl">&#127936;</div>
				<p className="text-muted-foreground text-center">
					Playoff bracket data is not yet available for this season.
				</p>
			</div>
		);
	}

	if (leagueRounds) {
		return <LeagueView rounds={leagueRounds} isDark={isDark} league={league} />;
	}

	if (!bracket) return null;

	if (view === "western") {
		return (
			<ConferenceView rounds={bracket.west} isDark={isDark} league={league} />
		);
	}

	if (view === "eastern") {
		return (
			<ConferenceView rounds={bracket.east} isDark={isDark} league={league} />
		);
	}

	// finals view
	return (
		<FinalsView
			finals={bracket.finals}
			westCF={bracket.west[2]?.[0]}
			eastCF={bracket.east[2]?.[0]}
			isDark={isDark}
			league={league}
		/>
	);
}

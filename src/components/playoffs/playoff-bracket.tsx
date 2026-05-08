import { useMemo, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { Image } from "@/components/ui/image";
import { useIsDarkMode } from "@/lib/use-is-dark-mode";
import { useHasTabAnimated } from "@/components/team-details/animation-context";
import { getTeamStaticData } from "@/lib/teams";
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
	homeScore: number;
	awayScore: number;
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
	conference: "east" | "west" | "finals";
	topTeam: BracketTeam | null;
	bottomTeam: BracketTeam | null;
	topWins: number;
	bottomWins: number;
	status: "upcoming" | "active" | "completed";
	winner: "top" | "bottom" | null;
	gameIds: string[];
}

interface BracketData {
	west: BracketSeries[][];
	east: BracketSeries[][];
	finals: BracketSeries | null;
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

function buildTeamInfo(teamData: PlayoffTeamSeed, league: League): BracketTeam {
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
		seed: teamData.conferenceRank ?? 0,
		logoUrl,
		darkColor,
		lightColor,
		record: `${teamData.wins}-${teamData.losses}`,
	};
}

function buildBracket(data: PlayoffBracketData, league: League): BracketData {
	const { games, teams } = data;

	const eastTeams = teams
		.filter((t) => t.conference?.toLowerCase().includes("east"))
		.sort((a, b) => (a.conferenceRank ?? 99) - (b.conferenceRank ?? 99));
	const westTeams = teams
		.filter((t) => t.conference?.toLowerCase().includes("west"))
		.sort((a, b) => (a.conferenceRank ?? 99) - (b.conferenceRank ?? 99));

	// Group games by matchup
	const seriesMap = new Map<
		string,
		{ games: PlayoffGame[]; teamIds: [string, string] }
	>();

	for (const game of games) {
		if (!game.homeTeam || !game.awayTeam) continue;
		const ids = [game.homeTeam.espnTeamId, game.awayTeam.espnTeamId].sort();
		const key = ids.join("-");
		if (!seriesMap.has(key)) {
			seriesMap.set(key, { games: [], teamIds: ids as [string, string] });
		}
		seriesMap.get(key)!.games.push(game);
	}

	function getSeriesResult(
		teamIds: [string, string],
		seriesGames: PlayoffGame[],
	) {
		let team1Wins = 0;
		let team2Wins = 0;
		const gameIds: string[] = [];

		for (const game of seriesGames) {
			if (!game.homeTeam || !game.awayTeam) continue;
			gameIds.push(game.espnGameId);
			if (game.eventStatus !== "completed") continue;
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

		const isCompleted = team1Wins === 4 || team2Wins === 4;
		const status: BracketSeries["status"] = isCompleted
			? "completed"
			: team1Wins + team2Wins > 0 || hasActiveGame
				? "active"
				: "upcoming";

		return { team1Wins, team2Wins, status, gameIds };
	}

	function findAndCalcSeries(
		topTeam: BracketTeam | null,
		bottomTeam: BracketTeam | null,
	) {
		let topWins = 0;
		let bottomWins = 0;
		let status: BracketSeries["status"] = "upcoming";
		let winner: BracketSeries["winner"] = null;
		let gameIds: string[] = [];

		if (topTeam && bottomTeam) {
			const ids = [topTeam.espnTeamId, bottomTeam.espnTeamId].sort();
			const key = ids.join("-");
			const seriesData = seriesMap.get(key);
			if (seriesData) {
				const result = getSeriesResult(
					ids as [string, string],
					seriesData.games,
				);
				const topIsFirst = ids[0] === topTeam.espnTeamId;
				topWins = topIsFirst ? result.team1Wins : result.team2Wins;
				bottomWins = topIsFirst ? result.team2Wins : result.team1Wins;
				status = result.status;
				gameIds = result.gameIds;
				if (status === "completed") {
					winner = topWins > bottomWins ? "top" : "bottom";
				}
			}
		}

		return { topWins, bottomWins, status, winner, gameIds };
	}

	function getWinner(series: BracketSeries): BracketTeam | null {
		if (series.winner === "top") return series.topTeam;
		if (series.winner === "bottom") return series.bottomTeam;
		return null;
	}

	function buildConference(
		confTeams: PlayoffTeamSeed[],
		conf: "east" | "west",
	): BracketSeries[][] {
		// Round 1
		const round1 = FIRST_ROUND_MATCHUPS.map(([topSeed, bottomSeed], idx) => {
			const topTeamData = confTeams.find(
				(t) => (t.conferenceRank ?? 99) === topSeed,
			);
			const bottomTeamData = confTeams.find(
				(t) => (t.conferenceRank ?? 99) === bottomSeed,
			);
			const topTeam = topTeamData ? buildTeamInfo(topTeamData, league) : null;
			const bottomTeam = bottomTeamData
				? buildTeamInfo(bottomTeamData, league)
				: null;

			let topWins = 0;
			let bottomWins = 0;
			let status: BracketSeries["status"] = "upcoming";
			let winner: BracketSeries["winner"] = null;
			let gameIds: string[] = [];

			if (topTeamData && bottomTeamData) {
				const ids = [topTeamData.espnTeamId, bottomTeamData.espnTeamId].sort();
				const key = ids.join("-");
				const sd = seriesMap.get(key);
				if (sd) {
					const r = getSeriesResult(ids as [string, string], sd.games);
					const topIsFirst = ids[0] === topTeamData.espnTeamId;
					topWins = topIsFirst ? r.team1Wins : r.team2Wins;
					bottomWins = topIsFirst ? r.team2Wins : r.team1Wins;
					status = r.status;
					gameIds = r.gameIds;
					if (status === "completed") {
						winner = topWins > bottomWins ? "top" : "bottom";
					}
				}
			}

			return {
				id: `${conf}-r1-${idx}`,
				round: 1,
				conference: conf,
				topTeam,
				bottomTeam,
				topWins,
				bottomWins,
				status,
				winner,
				gameIds,
			} as BracketSeries;
		});

		// Round 2
		const round2: BracketSeries[] = [];
		for (let i = 0; i < round1.length; i += 2) {
			const topTeam = getWinner(round1[i]);
			const bottomTeam = getWinner(round1[i + 1]);
			const calc = findAndCalcSeries(topTeam, bottomTeam);
			round2.push({
				id: `${conf}-r2-${i / 2}`,
				round: 2,
				conference: conf,
				topTeam,
				bottomTeam,
				...calc,
			});
		}

		// Conference Finals
		const cfTop = getWinner(round2[0]);
		const cfBottom = getWinner(round2[1]);
		const cfCalc = findAndCalcSeries(cfTop, cfBottom);
		const cf: BracketSeries = {
			id: `${conf}-cf`,
			round: 3,
			conference: conf,
			topTeam: cfTop,
			bottomTeam: cfBottom,
			...cfCalc,
		};

		return [round1, round2, [cf]];
	}

	const westRounds = buildConference(westTeams, "west");
	const eastRounds = buildConference(eastTeams, "east");

	const westChamp = getWinner(westRounds[2][0]);
	const eastChamp = getWinner(eastRounds[2][0]);
	const finalsCalc = findAndCalcSeries(westChamp, eastChamp);

	const finals: BracketSeries = {
		id: "finals",
		round: 4,
		conference: "finals",
		topTeam: westChamp,
		bottomTeam: eastChamp,
		...finalsCalc,
	};

	return { west: westRounds, east: eastRounds, finals };
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
	isDark,
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
					wins={series.topWins}
					isWinner={series.winner === "top"}
					isLoser={series.winner === "bottom"}
					isTop={true}
					isDark={isDark}
					league={league}
				/>
				<div className="h-px bg-border/40" />
				<TeamRow
					team={series.bottomTeam}
					wins={series.bottomWins}
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
			{/* Champion banner */}
			{champion && (
				<div className="flex flex-col items-center gap-2">
					<Trophy className="size-10 text-primary" />
					<span className="text-sm font-bold uppercase tracking-widest text-primary">
						NBA Champion
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
			)}

			{/* NBA Finals — 1 card */}
			<RoundRow
				series={[finalsWithHeader]}
				label="NBA Finals"
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

export type PlayoffView = "western" | "eastern" | "finals";

interface PlayoffBracketProps {
	data: PlayoffBracketData;
	league: League;
	view: PlayoffView;
}

export function PlayoffBracket({ data, league, view }: PlayoffBracketProps) {
	const isDark = useIsDarkMode();
	const bracket = useMemo(() => buildBracket(data, league), [data, league]);

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
			finals={bracket.finals!}
			westCF={bracket.west[2]?.[0]}
			eastCF={bracket.east[2]?.[0]}
			isDark={isDark}
			league={league}
		/>
	);
}

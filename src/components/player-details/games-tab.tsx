import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { FunctionReturnType } from "convex/server";
import { ArrowRight, Bandage, Info, ListOrdered } from "lucide-react";
import { api } from "~api";
import { SectionHeader } from "@/components/team-details/section-header";
import { StatCard } from "@/components/team-details/stat-card";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import type { GamesSearch } from "@/lib/players/stats-route";
import { TEAM_COLOR_CLASS, teamColorVars } from "@/lib/shared/team-color-vars";
import type { League } from "@/lib/shared/league";
import { cn } from "@/lib/utils";
import type { InjuryUpdate, PlayerInjury } from "@convex/shared/playerAvailability";
import type { PlayerGameTableRow } from "@convex/shared/playerGames";
import { GamePerformanceDialog, type PerformancePlayer } from "./game-performance-dialog";
import { GameLogTable } from "./game-log-table";
import { playerGameLogRoute } from "./player-details-layout";
import { playerGameLogQuery } from "./player-details-page";
import { SectionNav, type PageSection } from "./section-nav";
import { shortDate } from "./stat-parts";

export function plural(count: number, noun: string) {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

const SUMMARY_ID = "games-summary";
const INJURIES_ID = "games-injuries";
const GAME_LOG_ID = "games-log";

const ALL_SECTIONS: PageSection[] = [
	{ id: SUMMARY_ID, label: "Summary" },
	{ id: GAME_LOG_ID, label: "Game Log" },
	{ id: INJURIES_ID, label: "Injuries" },
];
const INJURY_HIGHLIGHT_MS = 2000;
// Percent of games played that reads as reliable, and as a real concern
const AVAILABILITY_GOOD = 90;
const AVAILABILITY_BAD = 50;

export function injuryElementId(index: number) {
	return `games-injury-${index}`;
}

const SECTIONS_WITHOUT_LOG = ALL_SECTIONS.filter((section) => section.id !== GAME_LOG_ID);

function InjuryHistory({ updates }: { updates: InjuryUpdate[] }) {
	return (
		<ol className="max-w-[320px] space-y-2 text-left text-xs leading-relaxed">
			{updates.map((update) => (
				<li key={`${update.date}-${update.status}-${update.comment}`}>
					<p className="font-semibold">
						{shortDate(update.date)} · {update.status}
					</p>
					{update.comment && <p>{update.comment}</p>}
				</li>
			))}
		</ol>
	);
}

function InjuryRow({
	id,
	injury,
	highlighted,
}: {
	id: string;
	injury: Omit<PlayerInjury, "gameDates">;
	/** Just arrived at from the game log */
	highlighted: boolean;
}) {
	const latestStatus = injury.updates.at(-1)?.status;
	return (
		<li
			id={id}
			tabIndex={-1}
			className={cn(
				"scroll-mt-6 space-y-0.5 px-4 py-3 transition-colors duration-500 focus:outline-none",
				highlighted && "bg-muted",
			)}
		>
			<div className="flex flex-wrap items-baseline justify-between gap-x-4">
				<h3 className="font-semibold">
					{injury.updates.length > 0 ? (
						<Tooltip
							content={<InjuryHistory updates={injury.updates} />}
							className="cursor-help rounded-sm text-left underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							{injury.label}
						</Tooltip>
					) : (
						injury.label
					)}
				</h3>
				<span className="text-sm text-muted-foreground">
					{shortDate(injury.startDate)}
					{injury.ongoing
						? " – now"
						: injury.endDate !== injury.startDate && ` – ${shortDate(injury.endDate)}`}
				</span>
			</div>
			<p className="text-sm text-muted-foreground">
				{injury.games > 0 ? `${plural(injury.games, "game")} missed` : "No games missed"}
				{injury.ongoing && latestStatus && ` · ${latestStatus}`}
			</p>
		</li>
	);
}

export type PlayerGamesData = NonNullable<
	FunctionReturnType<typeof api.nba.queries.getPlayerGames>
>;

/**
 * The performance dialog for the games tables. It needs a full box score, so
 * the season's log is only fetched once a game is open.
 */
export function PlayerGameDialog({
	rows,
	openGameId,
	onOpenGame,
	league,
	season,
	player,
}: {
	/** The table's rows; previous and next follow them, past games missed */
	rows: PlayerGameTableRow[];
	openGameId: string | null;
	onOpenGame: (espnGameId: string | null) => void;
	league: League;
	season: string;
	player: PerformancePlayer & { id: string };
}) {
	const { data: games } = useQuery({
		...playerGameLogQuery(league, season, player.id),
		enabled: !!season && !!openGameId,
	});
	const log = games ?? [];
	const openRow = openGameId ? (log.find((row) => row.espnGameId === openGameId) ?? null) : null;
	const playedRows = rows.filter((row) => row.missedReason === undefined);
	const openIndex = playedRows.findIndex((row) => row.espnGameId === openGameId);
	const step = (by: number) => {
		const next = openIndex >= 0 ? playedRows[openIndex + by] : undefined;
		return next ? () => onOpenGame(next.espnGameId) : undefined;
	};
	return (
		<GamePerformanceDialog
			row={openRow}
			games={log}
			player={player}
			league={league}
			onClose={() => onOpenGame(null)}
			onPrevious={step(-1)}
			onNext={step(1)}
		/>
	);
}

/** The four numbers at the top, each with the line that gives it meaning */
function summaryStats(data: PlayerGamesData): Array<ComponentProps<typeof StatCard>> {
	const { played, started, missed, missedToInjury, availability, injuries } = data;
	const games = played + missed;
	const current = injuries.find((injury) => injury.ongoing);
	const status = current?.updates[current.updates.length - 1]?.status;
	const startedShare =
		played === 0
			? "No games played"
			: started === 0
				? "All off the bench"
				: `${((started / played) * 100).toFixed(0)}% of games played`;

	return [
		{ label: "Played", value: String(played), subtitle: `of ${plural(games, "team game")}` },
		{ label: "Started", value: String(started), subtitle: startedShare },
		{
			label: "Missed",
			value: String(missed),
			subtitle:
				missed === 0
					? "Hasn't missed a game"
					: missedToInjury > 0
						? `${missedToInjury} to injury`
						: "None to a known injury",
		},
		{
			label: "Available",
			value: availability === null ? "—" : `${availability.toFixed(0)}%`,
			subtitle: current && status ? `${status} since ${shortDate(current.startDate)}` : "This season",
			tone:
				availability === null
					? undefined
					: availability >= AVAILABILITY_GOOD
						? "good"
						: availability < AVAILABILITY_BAD
							? "bad"
							: undefined,
		},
	];
}

interface GamesTabProps {
	data: PlayerGamesData | null;
	isLoading: boolean;
	league: League;
	season: string;
	player: PerformancePlayer & { id: string; team: string };
	search: GamesSearch;
	onSearchChange: (change: Partial<GamesSearch>) => void;
}

export function GamesTab({
	data,
	isLoading,
	league,
	season,
	player,
	search,
	onSearchChange,
}: GamesTabProps) {
	const { team } = player;
	const openGameId = search.game === undefined ? null : String(search.game);
	const onOpenGame = (game: string | null) => onSearchChange({ game: game ? Number(game) : undefined });
	const [highlightedInjury, setHighlightedInjury] = useState<string | null>(null);
	useEffect(() => {
		if (!highlightedInjury) return;
		const timer = setTimeout(() => setHighlightedInjury(null), INJURY_HIGHLIGHT_MS);
		return () => clearTimeout(timer);
	}, [highlightedInjury]);

	const openInjury = useCallback((index: number) => {
		const id = injuryElementId(index);
		const element = document.getElementById(id);
		element?.scrollIntoView({ behavior: "smooth", block: "center" });
		element?.focus({ preventScroll: true });
		setHighlightedInjury(id);
	}, []);

	// Arriving from the full game log, which links to an injury here
	const loaded = data !== null;
	useEffect(() => {
		if (!loaded) return;
		const index = window.location.hash.match(/^#games-injury-(\d+)$/)?.[1];
		if (index !== undefined) openInjury(Number(index));
	}, [loaded, openInjury]);

	if (isLoading) {
		return <p className="py-12 text-center text-sm text-muted-foreground">Loading games...</p>;
	}
	if (!data) {
		return <p className="py-12 text-center text-sm text-muted-foreground">No games yet this season</p>;
	}

	const { rows, injuries, total } = data;
	// Any game at all, not just those listed: only played ones are by default
	const hasGames = data.phases.length > 0;

	return (
		<div
			className={cn(
				"lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8",
				TEAM_COLOR_CLASS,
			)}
			style={teamColorVars(league, team)}
		>
			<aside className="sticky top-6 hidden self-start lg:block">
				<SectionNav
					sections={hasGames ? ALL_SECTIONS : SECTIONS_WITHOUT_LOG}
					color="var(--team)"
					label="Game sections"
				/>
			</aside>

			<div className="min-w-0 space-y-10">
				<section id={SUMMARY_ID} className="scroll-mt-6 space-y-3">
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						{summaryStats(data).map((stat) => (
							<StatCard key={stat.label} {...stat} />
						))}
					</div>
					{data.playoffs && (
						<p className="text-sm text-muted-foreground">
							Playoffs: played {data.playoffs.played} of {plural(data.playoffs.games, "game")}
						</p>
					)}
				</section>

				{hasGames && (
					<section id={GAME_LOG_ID} className="scroll-mt-6">
						<SectionHeader
							icon={ListOrdered}
							title="Game Log"
							action={
								<div className="flex items-center gap-4">
									<Switch
										checked={search.show === "all"}
										onCheckedChange={(checked) =>
											onSearchChange({ show: checked ? "all" : undefined })
										}
									>
										Show missed
									</Switch>
									<Link
										to={playerGameLogRoute(league)}
										params={{ id: player.id }}
										search={{ show: search.show }}
										className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										{total > 0 ? `View all ${plural(total, "game")}` : "View all games"}
										<ArrowRight className="size-3.5" aria-hidden />
									</Link>
								</div>
							}
						/>
						<Card classNames={{ inner: "flex-col p-0" }}>
							{rows.length > 0 ? (
								<GameLogTable sorted={rows} onOpen={onOpenGame} onOpenInjury={openInjury} />
							) : (
								<p className="w-full px-4 py-10 text-center text-sm text-muted-foreground">
									No games played this season
								</p>
							)}
						</Card>
					</section>
				)}

				<section id={INJURIES_ID} className="scroll-mt-6">
					<SectionHeader icon={Bandage} title="Injuries" />
					<Card classNames={{ inner: "flex-col justify-start p-0" }}>
						{injuries.length > 0 ? (
							<ul className="divide-y divide-border/60">
								{injuries.map((injury, index) => (
									<InjuryRow
										key={`${injury.startDate}-${injury.label}`}
										id={injuryElementId(index)}
										injury={injury}
										highlighted={highlightedInjury === injuryElementId(index)}
									/>
								))}
							</ul>
						) : (
							<p className="px-4 py-10 text-center text-sm text-muted-foreground">
								No injuries recorded this season
							</p>
						)}
					</Card>
					<p className="mt-3 flex gap-1.5 text-xs text-muted-foreground">
						<Info className="mt-px size-3.5 shrink-0" aria-hidden />
						Played, started and missed cover the regular season. Reasons are the best we can find
						and can miss the full story. A player who joined their team this season can show as
						missing games from before they arrived.
					</p>
				</section>
			</div>

			<PlayerGameDialog
				rows={rows}
				openGameId={openGameId}
				onOpenGame={onOpenGame}
				league={league}
				season={season}
				player={player}
			/>
		</div>
	);
}

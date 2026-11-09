import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PHASE_LABELS, type GameLogPhase } from "@/lib/players/game-log-stats";
import type { GameLogSearch } from "@/lib/players/stats-route";
import type { League } from "@/lib/shared/league";
import { TEAM_COLOR_CLASS, teamColorVars } from "@/lib/shared/team-color-vars";
import { cn } from "@/lib/utils";
import type { GamesSplit } from "@convex/shared/playerGames";
import { FilterSelect, SidebarField } from "./filter-fields";
import type { PerformancePlayer } from "./game-performance-dialog";
import { GameLogTable, type GameLogSort } from "./game-log-table";
import { PlayerGameDialog, injuryElementId, plural, type PlayerGamesData } from "./games-tab";
import { playerTabRoute } from "./player-details-layout";

const TABLE_ID = "game-log-table";
const ALL = "all";

const SPLIT_OPTIONS: Array<{ value: GamesSplit | typeof ALL; label: string }> = [
	{ value: ALL, label: "All games" },
	{ value: "home", label: "Home" },
	{ value: "road", label: "Road" },
	{ value: "wins", label: "Wins" },
	{ value: "losses", label: "Losses" },
];

const unlessAll = <T extends string>(value: T | typeof ALL) => (value === ALL ? undefined : (value as T));

function Pagination({
	page,
	pageCount,
	onPageChange,
}: {
	page: number;
	pageCount: number;
	onPageChange: (page: number) => void;
}) {
	return (
		<nav aria-label="Game log pages" className="flex items-center justify-between gap-4">
			<Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
				<ChevronLeft className="size-4" aria-hidden />
				Previous
			</Button>
			<span className="text-sm tabular-nums text-muted-foreground">
				Page {page} of {pageCount}
			</span>
			<Button
				variant="outline"
				size="sm"
				disabled={page >= pageCount}
				onClick={() => onPageChange(page + 1)}
			>
				Next
				<ChevronRight className="size-4" aria-hidden />
			</Button>
		</nav>
	);
}

interface GameLogProps {
	data: PlayerGamesData | null;
	isLoading: boolean;
	league: League;
	season: string;
	player: PerformancePlayer & { id: string; team: string };
	search: GameLogSearch;
	onSearchChange: (change: Partial<GameLogSearch>) => void;
}

/** Every game of a player's season, a page at a time */
export function GameLog({
	data,
	isLoading,
	league,
	season,
	player,
	search,
	onSearchChange,
}: GameLogProps) {
	const navigate = useNavigate();
	const gamesRoute = playerTabRoute(league, "games");
	const sort: GameLogSort = { key: search.sort ?? "date", dir: search.dir ?? "desc" };
	const phases = data?.phases ?? [];

	// Any change to what's listed starts again from the first page
	const filter = (change: Partial<GameLogSearch>) => onSearchChange({ ...change, page: undefined });

	const goToPage = (page: number) => {
		onSearchChange({ page: page > 1 ? page : undefined });
		document.getElementById(TABLE_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<div
			className={cn("lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8", TEAM_COLOR_CLASS)}
			style={teamColorVars(league, player.team)}
		>
			<aside
				aria-label="Game filters"
				className="mb-6 grid gap-3 self-start sm:grid-cols-3 lg:sticky lg:top-6 lg:mb-0 lg:grid-cols-1"
			>
				<div className="border-b border-border pb-3 sm:col-span-3 lg:col-span-1">
					<Link
						to={gamesRoute}
						params={{ id: player.id }}
						search={{ show: search.show }}
						className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-1 text-sm font-medium text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<ArrowLeft className="size-3.5" aria-hidden />
						Back to Games
					</Link>
				</div>
				{phases.length > 1 && (
					<SidebarField label="Season">
						<FilterSelect<GameLogPhase | typeof ALL>
							label="Season phase"
							value={search.phase ?? ALL}
							options={[
								{ value: ALL, label: "Whole season" },
								...phases.map((value) => ({ value, label: PHASE_LABELS[value] })),
							]}
							onChange={(value) => filter({ phase: unlessAll(value) })}
							className="w-full"
						/>
					</SidebarField>
				)}
				<SidebarField label="Games">
					<FilterSelect
						label="Games"
						value={search.split ?? ALL}
						options={SPLIT_OPTIONS}
						onChange={(value) => filter({ split: unlessAll(value) })}
						className="w-full"
					/>
				</SidebarField>
			</aside>

			<div id={TABLE_ID} className="min-w-0 scroll-mt-6 space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<h2 className="text-lg font-semibold">
						Game Log
						{data && (
							<span className="ml-2 text-sm font-normal text-muted-foreground">
								{plural(data.total, "game")}
							</span>
						)}
					</h2>
					<Switch
						checked={search.show === "all"}
						onCheckedChange={(checked) => filter({ show: checked ? "all" : undefined })}
					>
						Show missed
					</Switch>
				</div>

				{isLoading ? (
					<p className="py-12 text-center text-sm text-muted-foreground">Loading games...</p>
				) : !data || data.rows.length === 0 ? (
					<Card>
						<p className="w-full px-4 py-10 text-center text-sm text-muted-foreground">
							No games match these filters
						</p>
					</Card>
				) : (
					<>
						<Card classNames={{ inner: "flex-col p-0" }}>
							<GameLogTable
								sorted={data.rows}
								sort={sort}
								onSortChange={(next) => filter({ sort: next.key, dir: next.dir })}
								onOpen={(game) => onSearchChange({ game: Number(game) })}
								onOpenInjury={(index) =>
									navigate({
										to: gamesRoute,
										params: { id: player.id },
										hash: injuryElementId(index),
									})
								}
							/>
						</Card>
						{data.pageCount > 1 && (
							<Pagination page={data.page} pageCount={data.pageCount} onPageChange={goToPage} />
						)}
					</>
				)}
			</div>

			<PlayerGameDialog
				rows={data?.rows ?? []}
				openGameId={search.game === undefined ? null : String(search.game)}
				onOpenGame={(game) => onSearchChange({ game: game ? Number(game) : undefined })}
				league={league}
				season={season}
				player={player}
			/>
		</div>
	);
}

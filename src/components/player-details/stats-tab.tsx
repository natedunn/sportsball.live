import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Crosshair, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/team-details/section-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TEAM_COLOR_CLASS, teamColorVars } from "@/lib/shared/team-color-vars";
import type { League } from "@/lib/shared/league";
import {
	GAME_LOG_SPLITS,
	PHASE_LABELS,
	advancedStats,
	filterGameLog,
	gameScore,
	isWin,
	phasesIn,
	summarizeGameLog,
	type AdvancedStats,
	type GameLogPhase,
	type GameLogSplit,
	type GameLogSummary,
	type PlayerGameLogRow,
	type StatMode,
} from "@/lib/players/game-log-stats";
import { TabContentMotion } from "./tab-content-motion";
import { GamePerformanceDialog, type PerformancePlayer } from "./game-performance-dialog";
import { FilterSelect, SidebarField } from "./filter-fields";
import { SectionNav } from "./section-nav";
import {
	Delta,
	HeadlineStat,
	MinorStat,
	ShootingRow,
	diff,
	fixed,
	shortDate,
	signed,
	type Better,
} from "./stat-parts";

interface StatsTabProps {
	games: PlayerGameLogRow[];
	isLoading: boolean;
	league: League;
	player: PerformancePlayer & { team: string };
	/** The game whose performance dialog is open (from the URL), or null */
	openGameId: string | null;
	onOpenGame: (espnGameId: string | null) => void;
}

const MODES: Array<{ value: StatMode; label: string }> = [
	{ value: "perGame", label: "Per game" },
	{ value: "per36", label: "Per 36" },
	{ value: "totals", label: "Totals" },
];

// --- Filter bar ---

/** True once the sentinel before a `top-0` sticky element has scrolled away */
function useStuck() {
	const ref = useRef<HTMLDivElement>(null);
	const [stuck, setStuck] = useState(false);
	useEffect(() => {
		const sentinel = ref.current;
		if (!sentinel) return;
		const observer = new IntersectionObserver(([entry]) =>
			setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 1),
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, []);
	return [ref, stuck] as const;
}

interface FilterBarProps {
	phases: GameLogPhase[];
	phase: GameLogPhase;
	onPhaseChange: (phase: GameLogPhase) => void;
	split: GameLogSplit;
	onSplitChange: (split: GameLogSplit) => void;
	mode: StatMode;
	onModeChange: (mode: StatMode) => void;
	color: string;
}

/**
 * A gray bar that pins to the top of the viewport and spreads edge to edge
 * once stuck, so it never reads as one of the cards scrolling under it.
 */
function FilterBar(props: FilterBarProps) {
	const [sentinelRef, stuck] = useStuck();
	return (
		<>
			<div ref={sentinelRef} aria-hidden className="h-0 lg:hidden" />
			<div
				role="toolbar"
				aria-label="Stat filters"
				className={cn(
					"sticky top-0 z-40 lg:hidden flex flex-wrap items-center gap-2 border bg-muted p-2",
					stuck
						? // Spread the background past the container without widening the page
							"rounded-none border-transparent shadow-[0_0_0_100vmax_var(--muted),0_1px_0_100vmax_var(--border)] [clip-path:inset(0_-100vmax_-1px)]"
						: "rounded-xl border-border",
				)}
			>
				{props.phases.length > 1 && (
					<FilterSelect
						label="Season phase"
						value={props.phase}
						options={props.phases.map((value) => ({ value, label: PHASE_LABELS[value] }))}
						onChange={props.onPhaseChange}
					/>
				)}
				<FilterSelect
					label="Games"
					value={props.split}
					options={GAME_LOG_SPLITS}
					onChange={props.onSplitChange}
				/>
				<FilterSelect label="Stat mode" value={props.mode} options={MODES} onChange={props.onModeChange} />
			</div>
		</>
	);
}

const STAT_SECTIONS = [
	{ id: "stats-averages", label: "Averages" },
	{ id: "stats-game-by-game", label: "Game by Game" },
	{ id: "stats-shooting", label: "Shooting" },
	{ id: "stats-advanced", label: "Advanced" },
] as const;

/** Large screens: the filters and section links as a sticky column beside the stats */
function FilterSidebar(props: FilterBarProps & { showSections: boolean }) {
	return (
		<aside aria-label="Stat filters" className="sticky top-6 space-y-6 self-start">
			<div className="space-y-3">
				{props.phases.length > 1 && (
					<SidebarField label="Season">
						<FilterSelect
							label="Season phase"
							value={props.phase}
							options={props.phases.map((value) => ({ value, label: PHASE_LABELS[value] }))}
							onChange={props.onPhaseChange}
							className="w-full"
						/>
					</SidebarField>
				)}
				<SidebarField label="Games">
					<FilterSelect
						label="Games"
						value={props.split}
						options={GAME_LOG_SPLITS}
						onChange={props.onSplitChange}
						className="w-full"
					/>
				</SidebarField>
				<SidebarField label="Show">
					<FilterSelect
						label="Stat mode"
						value={props.mode}
						options={MODES}
						onChange={props.onModeChange}
						className="w-full"
					/>
				</SidebarField>
			</div>
			{props.showSections && (
				<SectionNav sections={STAT_SECTIONS} color={props.color} label="Stat sections" />
			)}
		</aside>
	);
}

// --- Box score ---

interface Comparison {
	/** Season numbers for the same phase and mode; null when nothing is filtered */
	season: GameLogSummary | null;
	seasonAdvanced: AdvancedStats | null;
}

function BoxScoreCard({
	summary,
	phaseGames,
	mode,
	compare,
	color,
}: {
	summary: GameLogSummary;
	/** Games in the phase before the filter narrows them */
	phaseGames: number;
	mode: StatMode;
	compare: Comparison;
	color: string;
}) {
	const s = summary.stats;
	const base = compare.season?.stats;
	// Totals shrink with fewer games, so they aren't compared
	const showDelta = base !== undefined && mode !== "totals";
	const decimals = mode === "totals" ? 0 : 1;
	const delta = (key: keyof typeof s, better: Better = "higher") =>
		showDelta ? <Delta value={s[key] - base[key]} better={better} /> : undefined;

	return (
		<Card classNames={{ inner: "flex-col p-0" }}>
			<div className="grid grid-cols-2 divide-border/60 sm:grid-cols-4 sm:divide-x [&>*]:border-border/60 max-sm:[&>*:nth-child(-n+2)]:border-b max-sm:[&>*:nth-child(odd)]:border-r">
				<HeadlineStat
					label="Games"
					value={String(summary.games)}
					delta={
						<span className="text-xs tabular-nums text-muted-foreground">
							{summary.games !== phaseGames && `of ${phaseGames} · `}
							{summary.wins}-{summary.losses}
						</span>
					}
					color={color}
				/>
				<HeadlineStat label="Points" value={fixed(s.pts, decimals)} delta={delta("pts")} color={color} />
				<HeadlineStat label="Rebounds" value={fixed(s.reb, decimals)} delta={delta("reb")} color={color} />
				<HeadlineStat label="Assists" value={fixed(s.ast, decimals)} delta={delta("ast")} color={color} />
			</div>
			<div className="grid grid-cols-3 border-t border-border/60 bg-muted/40 sm:grid-cols-6">
				<MinorStat label="MIN" value={fixed(s.min, decimals)} delta={delta("min", "neither")} />
				<MinorStat label="STL" value={fixed(s.stl, decimals)} delta={delta("stl")} />
				<MinorStat label="BLK" value={fixed(s.blk, decimals)} delta={delta("blk")} />
				<MinorStat label="TOV" value={fixed(s.tov, decimals)} delta={delta("tov", "lower")} />
				<MinorStat
					label="+/-"
					value={signed(summary.plusMinus)}
					delta={
						compare.season ? (
							<Delta value={diff(summary.plusMinus, compare.season.plusMinus)} />
						) : undefined
					}
				/>
				<MinorStat
					label="Game Score"
					value={fixed(summary.gameScore)}
					delta={
						compare.season ? (
							<Delta value={diff(summary.gameScore, compare.season.gameScore)} />
						) : undefined
					}
				/>
			</div>
		</Card>
	);
}

// --- Shooting ---

function ShootingCard({
	summary,
	advanced,
	mode,
	compare,
	color,
}: {
	summary: GameLogSummary;
	advanced: AdvancedStats;
	mode: StatMode;
	compare: Comparison;
	color: string;
}) {
	const s = summary.stats;
	const decimals = mode === "totals" ? 0 : 1;
	const per = mode === "totals" ? "" : mode === "per36" ? " per 36" : " a game";
	const makes = (made: number, attempted: number) =>
		`${made.toFixed(decimals)}-${attempted.toFixed(decimals)}${per}`;
	const season = compare.season;
	const seasonAdv = compare.seasonAdvanced;
	return (
		<Card classNames={{ inner: "flex-col p-0 divide-y divide-border/60" }}>
			<ShootingRow
				label="FG%"
				detail={makes(s.fgm, s.fga)}
				pct={summary.fgPct}
				seasonPct={season?.fgPct}
				color={color}
			/>
			<ShootingRow
				label="3P%"
				detail={makes(s.tpm, s.tpa)}
				pct={summary.tpPct}
				seasonPct={season?.tpPct}
				color={color}
			/>
			<ShootingRow
				label="FT%"
				detail={makes(s.ftm, s.fta)}
				pct={summary.ftPct}
				seasonPct={season?.ftPct}
				color={color}
			/>
			<ShootingRow
				label="eFG%"
				detail="3s worth 1.5"
				pct={advanced.efgPct}
				seasonPct={seasonAdv?.efgPct}
				color={color}
			/>
			<ShootingRow
				label="TS%"
				detail="With free throws"
				pct={advanced.tsPct}
				seasonPct={seasonAdv?.tsPct}
				color={color}
			/>
		</Card>
	);
}

// --- Game by game ---

const CHART_STATS: Array<{ key: string; label: string; value: (row: PlayerGameLogRow) => number }> = [
	{ key: "pts", label: "PTS", value: (r) => r.pts },
	{ key: "reb", label: "REB", value: (r) => r.reb },
	{ key: "ast", label: "AST", value: (r) => r.ast },
	{ key: "min", label: "MIN", value: (r) => r.min },
	{ key: "gmsc", label: "GmSc", value: gameScore },
];

/** Losses: an outline in the full team color over a light tint, so they stay readable */
function lossStyle(color: string) {
	return {
		backgroundColor: `color-mix(in oklab, ${color} 22%, transparent)`,
		boxShadow: `inset 0 0 0 1.5px ${color}`,
	};
}

function GameChart({
	rows,
	color,
	onOpen,
}: {
	rows: PlayerGameLogRow[];
	color: string;
	onOpen: (espnGameId: string) => void;
}) {
	const [statKey, setStatKey] = useState("pts");
	const stat = CHART_STATS.find((option) => option.key === statKey) ?? CHART_STATS[0];
	// Oldest on the left
	const games = useMemo(() => [...rows].reverse(), [rows]);
	const values = games.map(stat.value);
	const average = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
	const max = Math.max(...values, average, 1) * 1.1;
	const labelled = games.length <= 15;

	return (
		<Card classNames={{ inner: "flex-col gap-4 p-4" }}>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-4 text-xs text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
						Win
					</span>
					<span className="flex items-center gap-1.5">
						<span className="size-2.5 rounded-sm" style={lossStyle(color)} />
						Loss
					</span>
					<span className="flex items-center gap-1.5">
						<span className="w-4 border-t-2 border-dashed border-foreground/60" />
						Average {average.toFixed(1)}
					</span>
				</div>
				<Tabs value={statKey} onValueChange={setStatKey} size="sm">
					<TabsList responsive={false}>
						{CHART_STATS.map((option) => (
							<TabsTrigger key={option.key} value={option.key}>
								{option.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			</div>
			<div className="relative flex h-44 items-end gap-[3px] md:h-52">
				<div
					className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-foreground/60"
					style={{ bottom: `${(average / max) * 100}%` }}
					aria-hidden
				/>
				{games.map((row, index) => {
					const value = values[index];
					const label = `${shortDate(row.gameDate)} ${row.isHome ? "vs" : "@"} ${row.opponent}: ${
						statKey === "gmsc" ? value.toFixed(1) : value
					} ${stat.label}`;
					return (
						<button
							key={row.espnGameId}
							type="button"
							onClick={() => onOpen(row.espnGameId)}
							className="group relative flex h-full min-w-0 max-w-10 flex-1 cursor-pointer flex-col items-center justify-end rounded-t-[3px] transition-colors hover:bg-muted focus:outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring"
							title={label}
							aria-label={label}
						>
							{labelled && (
								<span className="mb-1 text-[11px] font-medium tabular-nums text-muted-foreground group-hover:text-foreground">
									{statKey === "gmsc" ? value.toFixed(0) : value}
								</span>
							)}
							<span
								className="w-full rounded-t-[3px] transition-[height] duration-500 ease-out"
								style={{
									height: `${(Math.max(value, 0) / max) * 100}%`,
									...(isWin(row) ? { backgroundColor: color } : lossStyle(color)),
								}}
							/>
						</button>
					);
				})}
			</div>
			{labelled && (
				<div className="-mt-2 flex gap-[3px]" aria-hidden>
					{games.map((row) => (
						<span
							key={row.espnGameId}
							className="min-w-0 max-w-10 flex-1 truncate text-center text-[10px] text-muted-foreground"
						>
							{row.opponent}
						</span>
					))}
				</div>
			)}
		</Card>
	);
}

// --- Advanced ---

interface AdvancedItem {
	key: keyof AdvancedStats;
	label: string;
	hint: string;
	better: Better;
}

const ADVANCED_GROUPS: Array<{ title: string; items: AdvancedItem[] }> = [
	{
		title: "Scoring",
		items: [
			{ key: "usgPct", label: "Usage", hint: "Team plays used while on the floor", better: "neither" },
			{ key: "threePointRate", label: "3PA rate", hint: "Shots taken from three", better: "neither" },
			{ key: "freeThrowRate", label: "FT rate", hint: "Free throws per shot", better: "higher" },
		],
	},
	{
		title: "Playmaking",
		items: [
			{ key: "astPct", label: "Assist %", hint: "Teammates' baskets they assisted", better: "higher" },
			{ key: "tovPct", label: "Turnover %", hint: "Their plays ending in a turnover", better: "lower" },
		],
	},
	{
		title: "Rebounding",
		items: [
			{ key: "rebPct", label: "Rebound %", hint: "Available rebounds they grabbed", better: "higher" },
			{ key: "orebPct", label: "Offensive", hint: "Own team's misses", better: "higher" },
			{ key: "drebPct", label: "Defensive", hint: "Opponent misses", better: "higher" },
		],
	},
	{
		title: "Defense",
		items: [
			{ key: "stlPct", label: "Steal %", hint: "Opponent plays ended by a steal", better: "higher" },
			{ key: "blkPct", label: "Block %", hint: "Opponent 2s they blocked", better: "higher" },
		],
	},
];

function AdvancedCard({ advanced, compare }: { advanced: AdvancedStats; compare: Comparison }) {
	return (
		<div className="grid gap-4 md:grid-cols-2">
			{ADVANCED_GROUPS.map((group) => (
				<Card key={group.title} classNames={{ inner: "flex-col justify-start p-0" }}>
					<h3 className="border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{group.title}
					</h3>
					<dl className="divide-y divide-border/60">
						{group.items.map((item) => (
							<div key={item.key} className="flex items-start justify-between gap-4 px-4 py-3">
								<dt>
									<div className="font-medium">{item.label}</div>
									<div className="text-xs text-muted-foreground">{item.hint}</div>
								</dt>
								<dd className="flex shrink-0 flex-col items-end">
									<span className="text-lg font-semibold tabular-nums">
										{fixed(advanced[item.key], 1, "%")}
									</span>
									{compare.seasonAdvanced && (
										<Delta
											value={diff(advanced[item.key], compare.seasonAdvanced[item.key])}
											better={item.better}
											suffix=" pts"
										/>
									)}
								</dd>
							</div>
						))}
					</dl>
				</Card>
			))}
		</div>
	);
}

export function StatsTab({
	games,
	isLoading,
	league,
	player,
	openGameId,
	onOpenGame,
}: StatsTabProps) {
	const teamVars = teamColorVars(league, player.team);
	// Every chart and accent reads the theme-aware variable
	const color = teamVars ? "var(--team)" : "var(--foreground)";
	const phases = useMemo(() => phasesIn(games), [games]);
	const [phaseChoice, setPhase] = useState<GameLogPhase | null>(null);
	const phase = phaseChoice && phases.includes(phaseChoice) ? phaseChoice : (phases[0] ?? "regular");
	const [split, setSplit] = useState<GameLogSplit>("all");
	const [mode, setMode] = useState<StatMode>("perGame");

	const phaseRows = useMemo(() => filterGameLog(games, phase, "all"), [games, phase]);
	const rows = useMemo(() => filterGameLog(games, phase, split), [games, phase, split]);
	const summary = useMemo(() => summarizeGameLog(rows, mode), [rows, mode]);
	const advanced = useMemo(() => advancedStats(rows), [rows]);
	const newestFirst = useMemo(
		() => [...rows].sort((a, b) => b.scheduledStart - a.scheduledStart),
		[rows],
	);

	// A shared link can name a game outside the current filters, so look in
	// the whole log; previous and next only step through the filtered games
	const openRow = openGameId ? (games.find((row) => row.espnGameId === openGameId) ?? null) : null;
	const openIndex = openRow ? newestFirst.indexOf(openRow) : -1;
	const step = (by: number) => {
		const next = openIndex >= 0 ? newestFirst[openIndex + by] : undefined;
		return next ? () => onOpenGame(next.espnGameId) : undefined;
	};
	const compare = useMemo<Comparison>(
		() =>
			split === "all"
				? { season: null, seasonAdvanced: null }
				: {
						season: summarizeGameLog(phaseRows, mode),
						seasonAdvanced: advancedStats(phaseRows),
					},
		[split, phaseRows, mode],
	);

	return (
		<div
			className={cn(
				"space-y-6 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8 lg:space-y-0",
				TEAM_COLOR_CLASS,
			)}
			style={teamVars}
		>
			<FilterBar
				phases={phases}
				phase={phase}
				onPhaseChange={setPhase}
				split={split}
				onSplitChange={setSplit}
				mode={mode}
				onModeChange={setMode}
				color={color}
			/>
			<div className="hidden lg:contents">
				<FilterSidebar
					phases={phases}
					phase={phase}
					onPhaseChange={setPhase}
					split={split}
					onSplitChange={setSplit}
					mode={mode}
					onModeChange={setMode}
					color={color}
					showSections={!isLoading && rows.length > 0}
				/>
			</div>

			<div className="min-w-0">
			{isLoading ? (
				<p className="py-12 text-center text-sm text-muted-foreground">Loading stats...</p>
			) : rows.length === 0 ? (
				<Card>
					<p className="w-full px-4 py-10 text-center text-sm text-muted-foreground">
						{games.length === 0
							? "No games played yet this season"
							: "No games match this filter"}
					</p>
				</Card>
			) : (
				<TabContentMotion>
					<div className="space-y-10">
						<section id="stats-averages" className="scroll-mt-6">
							<BoxScoreCard
								summary={summary}
								phaseGames={phaseRows.length}
								mode={mode}
								compare={compare}
								color={color}
							/>
						</section>

						<section id="stats-game-by-game" className="scroll-mt-6">
							<SectionHeader icon={BarChart3} title="Game by Game" />
							<GameChart rows={rows} color={color} onOpen={onOpenGame} />
						</section>

						<section id="stats-shooting" className="scroll-mt-6">
							<SectionHeader icon={Crosshair} title="Shooting" />
							<ShootingCard
								summary={summary}
								advanced={advanced}
								mode={mode}
								compare={compare}
								color={color}
							/>
						</section>

						<section id="stats-advanced" className="scroll-mt-6">
							<SectionHeader icon={Sparkles} title="Advanced" />
							<AdvancedCard advanced={advanced} compare={compare} />
						</section>
					</div>
				</TabContentMotion>
			)}
			</div>
			<GamePerformanceDialog
				row={openRow}
				games={games}
				player={player}
				league={league}
				onClose={() => onOpenGame(null)}
				onPrevious={step(-1)}
				onNext={step(1)}
			/>
		</div>
	);
}

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDarkMode } from "@/lib/use-is-dark-mode";
import { Card } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import { TeamFlickeringGrid } from "@/components/team-flickering-grid";
import { getTeamStaticData } from "@/lib/teams";
import {
	formatExperience,
	getPlayerAge,
	type PlayerProfileData,
} from "@/lib/players/mock-data";
import type { League } from "@/lib/shared/league";
import { leaguePlayerRoutes } from "@/lib/league-routes";
import { readableTeamColor } from "@/lib/shared/team-color-contrast";
import { PlayerSearch, type PlayerOption } from "./player-search";
import { TabContentMotion } from "./tab-content-motion";

interface ComparisonTabProps {
	player: PlayerProfileData;
	league: League;
	season: string;
	compareId: string;
	selected: PlayerOption | null;
	onCompareChange: (player: PlayerOption | null) => void;
	isLoading: boolean;
	comparedPlayer: PlayerProfileData | undefined;
}

interface StatDef {
	/** Short label, for narrow screens */
	label: string;
	name: string;
	value: (player: PlayerProfileData) => number;
	decimals: number;
	suffix?: string;
}

const STAT_GROUPS: Array<{ title: string; stats: StatDef[] }> = [
	{
		title: "Per game",
		stats: [
			{ label: "GP", name: "Games played", value: (p) => p.basicStats.games, decimals: 0 },
			{ label: "MIN", name: "Minutes", value: (p) => p.basicStats.minutes, decimals: 1 },
			{ label: "PTS", name: "Points", value: (p) => p.basicStats.points, decimals: 1 },
			{ label: "REB", name: "Rebounds", value: (p) => p.basicStats.rebounds, decimals: 1 },
			{ label: "AST", name: "Assists", value: (p) => p.basicStats.assists, decimals: 1 },
			{ label: "STL", name: "Steals", value: (p) => p.basicStats.steals, decimals: 1 },
			{ label: "BLK", name: "Blocks", value: (p) => p.basicStats.blocks, decimals: 1 },
			{ label: "TOV", name: "Turnovers", value: (p) => p.basicStats.turnovers, decimals: 1 },
		],
	},
	{
		title: "Shooting",
		stats: [
			{ label: "FG%", name: "Field goal %", value: (p) => p.shooting.fieldGoalPct, decimals: 1, suffix: "%" },
			{ label: "3P%", name: "Three-point %", value: (p) => p.shooting.threePointPct, decimals: 1, suffix: "%" },
			{ label: "FT%", name: "Free throw %", value: (p) => p.shooting.freeThrowPct, decimals: 1, suffix: "%" },
			{ label: "eFG%", name: "Effective FG %", value: (p) => p.shooting.effectiveFgPct, decimals: 1, suffix: "%" },
			{ label: "TS%", name: "True shooting %", value: (p) => p.calculatedStats.trueShootingPct, decimals: 1, suffix: "%" },
		],
	},
	{
		title: "Efficiency",
		stats: [
			{ label: "EFF", name: "Efficiency", value: (p) => p.calculatedStats.efficiency, decimals: 1 },
			{ label: "AST/TO", name: "Assist to turnover", value: (p) => p.calculatedStats.assistToTurnover, decimals: 2 },
		],
	},
];

/** The side with more, whether or not more is better (turnovers) */
type Edge = "left" | "right" | "even";

interface ComparedStat {
	def: StatDef;
	left: number;
	right: number;
	edge: Edge;
	/** Gap between the two, as displayed */
	diff: number;
}

function compareStat(def: StatDef, left: PlayerProfileData, right: PlayerProfileData): ComparedStat {
	// Compare what is displayed, so 22.25 vs 22.3 is even
	const round = (value: number) => Number(value.toFixed(def.decimals));
	const l = round(def.value(left));
	const r = round(def.value(right));
	const diff = round(Math.abs(l - r));
	const edge: Edge = l === r ? "even" : l > r ? "left" : "right";
	return { def, left: l, right: r, edge, diff };
}

interface SideTheme {
	/** CSS color for this side's bars and ring (3:1 on the card) */
	color: string;
	/** CSS color for this side's team-colored text (4.5:1 on the card) */
	text: string;
	logo?: string;
	/** Team colors for the corner grid */
	grid?: { dark: string; light: string };
}

const NEUTRAL_THEME: SideTheme = {
	color: "var(--muted-foreground)",
	text: "var(--foreground)",
};

function teamTheme(league: League, abbreviation: string, isDark: boolean): SideTheme {
	const team = getTeamStaticData(league, abbreviation);
	if (!team) return NEUTRAL_THEME;
	const mode = isDark ? "dark" : "light";
	const display = team.colors.display[mode];
	return {
		color: `#${readableTeamColor(display, mode, "graphic")}`,
		text: `#${readableTeamColor(display, mode, "text")}`,
		logo: `/api/${league}/logo/${team.logoSlug}`,
		grid: {
			dark: readableTeamColor(team.colors.display.dark, "dark", "graphic"),
			light: readableTeamColor(team.colors.display.light, "light", "graphic"),
		},
	};
}

function tint(color: string, percent: number) {
	return `color-mix(in oklab, ${color} ${percent}%, transparent)`;
}

function PlayerAvatar({ player, color }: { player: PlayerProfileData; color: string }) {
	const initials = player.name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 3)
		.toUpperCase();

	return (
		<div
			className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-bold text-muted-foreground md:size-24 md:text-2xl"
			style={{ outline: `2px solid ${color}`, outlineOffset: 3 }}
		>
			{player.headshot ? (
				<Image src={player.headshot} alt={player.name} className="h-full w-full object-cover" />
			) : (
				initials
			)}
		</div>
	);
}

function PlayerSide({
	player,
	theme,
	side,
	league,
}: {
	player: PlayerProfileData;
	theme: SideTheme;
	side: "left" | "right";
	/** Links the name to the player's page */
	league?: League;
}) {
	const age = getPlayerAge(player.bio);
	const experience = formatExperience(player.bio.experienceYears);
	const details = [player.position, age !== undefined ? `Age ${age}` : undefined, experience].filter(Boolean);

	return (
		<div className="relative flex flex-col items-center gap-3 overflow-hidden px-3 py-6 text-center md:py-8">
			{/* Team color grid in the outer corner, as on the scores cards */}
			{theme.grid && (
				<div
					className={cn(
						"pointer-events-none absolute top-0 isolate size-40",
						side === "left" ? "left-0" : "right-0",
					)}
				>
					<div
						className={cn(
							"absolute inset-0 z-1 from-card from-40% to-transparent",
							side === "left" ? "bg-linear-to-tl" : "bg-linear-to-tr",
						)}
					/>
					<TeamFlickeringGrid
						className="absolute inset-0"
						dark={theme.grid.dark}
						light={theme.grid.light}
						grid={{ width: 160, height: 160 }}
					/>
				</div>
			)}

			<div className="relative">
				<PlayerAvatar player={player} color={theme.color} />
			</div>
			<div className="relative min-w-0">
				<p className="text-base font-bold leading-tight tracking-tight md:text-2xl">
					{league ? (
						<Link
							to={leaguePlayerRoutes[league]}
							params={{ id: player.id }}
							className="underline-offset-4 hover:underline"
						>
							{player.name}
						</Link>
					) : (
						player.name
					)}
				</p>
				<p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
					{theme.logo && <img src={theme.logo} alt="" aria-hidden className="size-4" />}
					<span className="font-medium text-foreground/80">{player.team}</span>
					{details.length > 0 && <span className="hidden sm:inline">· {details.join(" · ")}</span>}
				</p>
			</div>
		</div>
	);
}

function EmptySide({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-col items-center gap-3 px-3 py-6 text-center md:py-8">
			<div className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-border md:size-24">
				{children}
			</div>
		</div>
	);
}

function DiffChip({ stat, theme }: { stat: ComparedStat; theme: SideTheme }) {
	return (
		<span
			className="rounded-full border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
			style={{ borderColor: tint(theme.color, 45), color: theme.text }}
		>
			<span className="sr-only">more by </span>+{stat.diff.toFixed(stat.def.decimals)}
		</span>
	);
}

function StatRow({
	stat,
	left,
	right,
}: {
	stat: ComparedStat;
	left: SideTheme;
	right: SideTheme;
}) {
	const max = Math.max(Math.abs(stat.left), Math.abs(stat.right));
	const width = (value: number) => (max > 0 ? (Math.abs(value) / max) * 100 : 0);
	const format = (value: number) => `${value.toFixed(stat.def.decimals)}${stat.def.suffix ?? ""}`;
	const valueClass = "text-lg font-semibold tabular-nums md:text-xl";
	// The side with less gets a slightly softer bar; numbers stay as they are
	const barOpacity = (side: "left" | "right") =>
		stat.edge === "even" || stat.edge === side ? 1 : 0.7;

	return (
		<div className="px-4 py-3 md:px-6">
			<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
				<div className="flex items-center gap-2">
					<span className={valueClass}>{format(stat.left)}</span>
					{stat.edge === "left" && <DiffChip stat={stat} theme={left} />}
				</div>
				<div className="w-14 text-center md:w-36">
					<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						<span className="md:hidden">{stat.def.label}</span>
						<span className="hidden md:inline">{stat.def.name}</span>
					</span>
					{stat.edge === "even" && (
						<span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
							Even
						</span>
					)}
				</div>
				<div className="flex items-center justify-end gap-2">
					{stat.edge === "right" && <DiffChip stat={stat} theme={right} />}
					<span className={valueClass}>{format(stat.right)}</span>
				</div>
			</div>

			{/* Bars grow out from the center line */}
			<div className="mt-2 grid grid-cols-2 gap-1">
				<div className="flex h-1.5 justify-end overflow-hidden rounded-l-full bg-muted">
					<div
						className="rounded-l-full transition-[width] duration-500 ease-out"
						style={{ width: `${width(stat.left)}%`, backgroundColor: left.color, opacity: barOpacity("left") }}
					/>
				</div>
				<div className="flex h-1.5 overflow-hidden rounded-r-full bg-muted">
					<div
						className="rounded-r-full transition-[width] duration-500 ease-out"
						style={{ width: `${width(stat.right)}%`, backgroundColor: right.color, opacity: barOpacity("right") }}
					/>
				</div>
			</div>
		</div>
	);
}

export function ComparisonTab({
	player,
	league,
	season,
	compareId,
	selected,
	onCompareChange,
	isLoading,
	comparedPlayer,
}: ComparisonTabProps) {
	const isDark = useIsDarkMode();
	const leftTheme = teamTheme(league, player.team, isDark);
	const rightTheme = comparedPlayer
		? comparedPlayer.team === player.team
			? // Teammates: keep the two sides apart
				{ ...teamTheme(league, comparedPlayer.team, isDark), color: "var(--foreground)", text: "var(--foreground)" }
			: teamTheme(league, comparedPlayer.team, isDark)
		: NEUTRAL_THEME;

	const showStats = comparedPlayer && !isLoading;

	return (
		<div>
			{/* Title, season and search, above the card */}
			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h2 className="flex items-center gap-2 text-lg font-semibold">
					<GitCompareArrows className="size-4.5 text-muted-foreground" />
					Player Comparison
					{season && (
						<span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
							{season} season
						</span>
					)}
				</h2>
				<PlayerSearch
					id="compare-player"
					league={league}
					season={season}
					excludeId={player.id}
					value={selected}
					onValueChange={onCompareChange}
					placeholder="Compare with a player"
					className="w-full sm:w-72"
				/>
			</div>

			<TabContentMotion>
				<Card classNames={{ inner: "flex-col p-0" }}>
					{/* Matchup */}
					<div className="relative grid grid-cols-[1fr_auto_1fr] items-center">
						<PlayerSide player={player} theme={leftTheme} side="left" />
						<span className="relative z-10 flex size-9 items-center justify-center rounded-full border border-border bg-card text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
							vs
						</span>
						{isLoading ? (
							<EmptySide>
								<div className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
							</EmptySide>
						) : comparedPlayer ? (
							<PlayerSide player={comparedPlayer} theme={rightTheme} side="right" league={league} />
						) : (
							<EmptySide>
								<span className="text-2xl font-light text-muted-foreground">?</span>
							</EmptySide>
						)}
					</div>

					{showStats ? (
						STAT_GROUPS.map((group) => (
							<div key={group.title}>
								<h3 className="border-y border-border/50 bg-muted/30 px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground md:px-6">
									{group.title}
								</h3>
								<div className="divide-y divide-border/40">
									{group.stats.map((def) => (
										<StatRow
											key={def.label}
											stat={compareStat(def, player, comparedPlayer)}
											left={leftTheme}
											right={rightTheme}
										/>
									))}
								</div>
							</div>
						))
					) : (
						!isLoading && (
							<p className="border-t border-border/50 px-4 py-8 text-center text-sm text-muted-foreground">
								{compareId
									? "We could not find that player this season"
									: `Search for a player to compare with ${player.name}`}
							</p>
						)
					)}
				</Card>
			</TabContentMotion>
		</div>
	);
}

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Player, GameDetailsTeam } from "@/lib/nba/game-details.server";
import { playerProfileQueryOptions } from "@/lib/nba/player-profile.queries";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import { ChevronUp, ChevronDown } from "lucide-react";

interface PlayerBoxScoreProps {
	team: GameDetailsTeam;
	accentColor: string;
	isLive?: boolean;
}

type SortColumn =
	| "name"
	| "minutes"
	| "points"
	| "rebounds"
	| "assists"
	| "fg"
	| "3pt"
	| "ft"
	| "steals"
	| "blocks"
	| "plusMinus";

type SortDirection = "asc" | "desc";
type GroupBy = "none" | "starter" | "active";

const GROUP_BY_STORAGE_KEY = "nba-boxscore-group-by";
const GROUP_BY_CHANGE_EVENT = "nba-boxscore-group-by-change";

function useGroupBy(isLive?: boolean): [GroupBy, (value: GroupBy) => void] {
	const [groupBy, setGroupByState] = useState<GroupBy>(() => {
		if (typeof window === "undefined") return "starter";
		const stored = localStorage.getItem(GROUP_BY_STORAGE_KEY);
		if (stored === "active" && !isLive) return "starter";
		if (stored === "none" || stored === "starter" || stored === "active") {
			return stored;
		}
		return "starter";
	});

	useEffect(() => {
		const handleChange = (e: CustomEvent<GroupBy>) => {
			const newValue = e.detail;
			if (newValue === "active" && !isLive) {
				setGroupByState("starter");
			} else {
				setGroupByState(newValue);
			}
		};

		window.addEventListener(GROUP_BY_CHANGE_EVENT, handleChange as EventListener);
		return () => window.removeEventListener(GROUP_BY_CHANGE_EVENT, handleChange as EventListener);
	}, [isLive]);

	const setGroupBy = (value: GroupBy) => {
		setGroupByState(value);
		localStorage.setItem(GROUP_BY_STORAGE_KEY, value);
		window.dispatchEvent(new CustomEvent(GROUP_BY_CHANGE_EVENT, { detail: value }));
	};

	return [groupBy, setGroupBy];
}

function SortableHeader({
	children,
	column,
	currentSort,
	currentDirection,
	onSort,
	className,
}: {
	children: React.ReactNode;
	column: SortColumn;
	currentSort: SortColumn;
	currentDirection: SortDirection;
	onSort: (column: SortColumn) => void;
	className?: string;
}) {
	const isActive = currentSort === column;

	return (
		<button
			type="button"
			onClick={() => onSort(column)}
			className={cn(
				"px-2 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider",
				"hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer select-none",
				"flex items-center justify-center gap-0.5",
				isActive && "text-foreground",
				className,
			)}
		>
			{children}
			<span className="w-3 h-3 flex items-center justify-center">
				{isActive && (
					currentDirection === "asc" ? (
						<ChevronUp className="w-3 h-3" />
					) : (
						<ChevronDown className="w-3 h-3" />
					)
				)}
			</span>
		</button>
	);
}

function StatCell({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"px-2 py-2 text-center tabular-nums text-sm",
				className,
			)}
		>
			{children}
		</div>
	);
}

function formatShortName(fullName: string): string {
	const parts = fullName.trim().split(" ");
	if (parts.length === 1) return fullName;
	const firstName = parts[0];
	const lastName = parts.slice(1).join(" ");
	return `${firstName.charAt(0)}. ${lastName}`;
}

function PlayerHeadshot({
	src,
	fallback,
	accentColor,
}: {
	src: string | null | undefined;
	fallback: string;
	accentColor: string;
}) {
	const [error, setError] = useState(false);

	if (!src || error) {
		return (
			<div
				className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold shrink-0"
				style={{ backgroundColor: `#${accentColor}20` }}
			>
				{fallback}
			</div>
		);
	}

	return (
		<img
			src={src}
			alt=""
			className="w-12 h-12 rounded-full object-cover bg-muted shrink-0"
			onError={() => setError(true)}
		/>
	);
}

function PlayerTooltipContent({
	player,
	accentColor,
	isHovered,
}: {
	player: Player;
	accentColor: string;
	isHovered: boolean;
}) {
	const { data: profile, isLoading } = useQuery({
		...playerProfileQueryOptions(player.id),
		enabled: isHovered,
	});

	return (
		<div className="w-64">
			{/* Player Header */}
			<div
				className="px-3 py-3 border-b border-border"
				style={{ backgroundColor: `#${accentColor}10` }}
			>
				<div className="flex items-center gap-3">
					<PlayerHeadshot
						src={profile?.headshot}
						fallback={player.jersey}
						accentColor={accentColor}
					/>
					<div className="flex flex-col min-w-0">
						<span className="font-semibold truncate">{player.name}</span>
						<span className="text-xs text-muted-foreground">
							#{player.jersey} · {player.position}
							{player.starter && " · Starter"}
						</span>
						{profile && (profile.height || profile.weight) && (
							<span className="text-xs text-muted-foreground">
								{[profile.height, profile.weight].filter(Boolean).join(" · ")}
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Season Stats */}
			<div className="p-3">
				<div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
					Season Averages
				</div>
				{isLoading ? (
					<div className="flex items-center justify-center py-4">
						<div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
					</div>
				) : profile?.seasonStats ? (
					<div className="grid grid-cols-4 gap-2">
						<StatBox
							label="PPG"
							value={profile.seasonStats.pointsPerGame.toFixed(1)}
							highlight
						/>
						<StatBox
							label="RPG"
							value={profile.seasonStats.reboundsPerGame.toFixed(1)}
						/>
						<StatBox
							label="APG"
							value={profile.seasonStats.assistsPerGame.toFixed(1)}
						/>
						<StatBox
							label="FG%"
							value={profile.seasonStats.fieldGoalPct.toFixed(1)}
						/>
					</div>
				) : (
					<p className="text-xs text-muted-foreground text-center py-2">
						Season stats not available
					</p>
				)}
			</div>

			{/* Bio Info */}
			{profile && (profile.college || profile.experience) && (
				<div className="px-3 pb-3 pt-1 border-t border-border">
					<div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
						{profile.college && <span>{profile.college}</span>}
						{profile.experience && <span>{profile.experience}</span>}
					</div>
				</div>
			)}
		</div>
	);
}

function StatBox({
	label,
	value,
	highlight,
	small,
}: {
	label: string;
	value: string | number;
	highlight?: boolean;
	small?: boolean;
}) {
	return (
		<div className="flex flex-col items-center rounded bg-muted/50 px-2 py-1.5">
			<span
				className={cn(
					"font-semibold tabular-nums",
					highlight ? "text-base" : small ? "text-xs" : "text-sm",
				)}
			>
				{value}
			</span>
			<span className="text-[10px] text-muted-foreground uppercase">{label}</span>
		</div>
	);
}

function PlayerName({
	player,
	accentColor,
	isLive,
}: {
	player: Player;
	accentColor: string;
	isLive?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const shortName = formatShortName(player.name);

	return (
		<div
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={() => setOpen(false)}
		>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger className="flex flex-col min-w-0 text-left cursor-pointer hover:text-primary transition-colors">
					<span className="text-sm font-medium truncate">{shortName}</span>
					<span className="text-xs text-muted-foreground">
						{player.position}
						{player.starter && " · Starter"}
						{isLive && player.active && <span className="text-green-500"> · In</span>}
					</span>
				</PopoverTrigger>
				<PopoverContent className="p-0" align="start" sideOffset={8}>
					<PlayerTooltipContent
						player={player}
						accentColor={accentColor}
						isHovered={open}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}

function PlayerRow({
	player,
	accentColor,
	isLive,
}: {
	player: Player;
	accentColor: string;
	isLive?: boolean;
}) {
	const didNotPlay = player.stats.minutes === "0" || player.stats.minutes === "--";

	return (
		<div
			className={cn(
				"grid grid-cols-[minmax(120px,1fr)_repeat(10,minmax(36px,1fr))] items-center border-b border-border/50 last:border-0",
				didNotPlay && "opacity-50",
			)}
		>
			<div className="flex items-center px-3 py-2">
				<PlayerName player={player} accentColor={accentColor} isLive={isLive} />
			</div>
			<StatCell>{player.stats.minutes}</StatCell>
			<StatCell className="font-semibold">{player.stats.points}</StatCell>
			<StatCell>{player.stats.totalRebounds}</StatCell>
			<StatCell>{player.stats.assists}</StatCell>
			<StatCell>{player.stats.fieldGoals}</StatCell>
			<StatCell>{player.stats.threePointers}</StatCell>
			<StatCell>{player.stats.freeThrows}</StatCell>
			<StatCell>{player.stats.steals}</StatCell>
			<StatCell>{player.stats.blocks}</StatCell>
			<StatCell
				className={cn(
					player.stats.plusMinus?.startsWith("-")
						? "text-red-500"
						: player.stats.plusMinus && player.stats.plusMinus !== "0" && "text-green-500",
				)}
			>
				{player.stats.plusMinus && player.stats.plusMinus !== "0" && !player.stats.plusMinus.startsWith("-") && !player.stats.plusMinus.startsWith("+")
					? `+${player.stats.plusMinus}`
					: player.stats.plusMinus ?? "0"}
			</StatCell>
		</div>
	);
}

function SectionHeader({ title, isFirst }: { title: string; isFirst?: boolean }) {
	return (
		<div className={cn("px-3 py-1.5 bg-muted/30 border-border/50", isFirst ? "border-b" : "border-y")}>
			<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
				{title}
			</span>
		</div>
	);
}

function parseMinutes(minutes: string): number {
	if (minutes === "--" || minutes === "") return -1;
	const parts = minutes.split(":");
	if (parts.length === 2) {
		return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
	}
	return parseInt(minutes, 10) || 0;
}

function parsePlusMinus(pm: string | undefined): number {
	if (!pm || pm === "--") return 0;
	return parseInt(pm, 10) || 0;
}

function parseShootingStat(stat: string): number {
	const parts = stat.split("-");
	return parseInt(parts[0], 10) || 0;
}

function sortPlayers(
	players: Player[],
	sortColumn: SortColumn,
	sortDirection: SortDirection,
): Player[] {
	const sorted = [...players];

	sorted.sort((a, b) => {
		let comparison = 0;

		switch (sortColumn) {
			case "name":
				comparison = a.name.localeCompare(b.name);
				break;
			case "minutes":
				comparison = parseMinutes(a.stats.minutes) - parseMinutes(b.stats.minutes);
				break;
			case "points":
				comparison = a.stats.points - b.stats.points;
				break;
			case "rebounds":
				comparison = a.stats.totalRebounds - b.stats.totalRebounds;
				break;
			case "assists":
				comparison = a.stats.assists - b.stats.assists;
				break;
			case "fg":
				comparison = parseShootingStat(a.stats.fieldGoals) - parseShootingStat(b.stats.fieldGoals);
				break;
			case "3pt":
				comparison = parseShootingStat(a.stats.threePointers) - parseShootingStat(b.stats.threePointers);
				break;
			case "ft":
				comparison = parseShootingStat(a.stats.freeThrows) - parseShootingStat(b.stats.freeThrows);
				break;
			case "steals":
				comparison = a.stats.steals - b.stats.steals;
				break;
			case "blocks":
				comparison = a.stats.blocks - b.stats.blocks;
				break;
			case "plusMinus":
				comparison = parsePlusMinus(a.stats.plusMinus) - parsePlusMinus(b.stats.plusMinus);
				break;
		}

		return sortDirection === "asc" ? comparison : -comparison;
	});

	return sorted;
}

export function PlayerBoxScore({ team, accentColor, isLive }: PlayerBoxScoreProps) {
	const [sortColumn, setSortColumn] = useState<SortColumn>("minutes");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [groupBy, setGroupBy] = useGroupBy(isLive);

	const handleSort = (column: SortColumn) => {
		if (sortColumn === column) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortColumn(column);
			setSortDirection(column === "name" ? "asc" : "desc");
		}
	};

	const { topSection, bottomSection } = useMemo(() => {
		if (groupBy === "none") {
			return {
				topSection: { title: null, players: sortPlayers(team.players, sortColumn, sortDirection) },
				bottomSection: null,
			};
		}

		const filterKey = groupBy === "starter" ? "starter" : "active";
		const topPlayers = team.players.filter((p) => p[filterKey]);
		const bottomPlayers = team.players.filter((p) => !p[filterKey]);

		return {
			topSection: {
				title: groupBy === "starter" ? "Starters" : "Checked In",
				players: sortPlayers(topPlayers, sortColumn, sortDirection),
			},
			bottomSection: {
				title: "Bench",
				players: sortPlayers(bottomPlayers, sortColumn, sortDirection),
			},
		};
	}, [team.players, groupBy, sortColumn, sortDirection]);

	if (team.players.length === 0) {
		return (
			<Card classNames={{ inner: "p-8 text-center justify-center" }}>
				<p className="text-muted-foreground">
					Player stats not available for this game
				</p>
			</Card>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{/* Team Header */}
			<div className="flex items-center justify-between gap-3 px-2">
				<div className="flex items-center gap-2">
					<Image
						src={team.logo}
						alt={team.name ?? "Team"}
						className="h-6 w-6 object-contain"
					/>
					<span className="font-semibold">{team.name}</span>
					<span className="text-sm text-muted-foreground">
						{team.players.length} players
					</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">Group by</span>
					<Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
						<SelectTrigger />
						<SelectContent>
							<SelectItem value="starter">Starter</SelectItem>
							{isLive && <SelectItem value="active">Checked In</SelectItem>}
							<SelectItem value="none">None</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Stats Table */}
			<Card classNames={{ inner: "flex-col" }}>
				<div className="overflow-x-auto">
				{/* Header */}
				<div className="grid grid-cols-[minmax(120px,1fr)_repeat(10,minmax(36px,1fr))] border-b border-border bg-muted/50 sticky top-0">
					<SortableHeader
						column="name"
						currentSort={sortColumn}
						currentDirection={sortDirection}
						onSort={handleSort}
						className="justify-start px-3"
					>
						Player
					</SortableHeader>
					<SortableHeader
						column="minutes"
						currentSort={sortColumn}
						currentDirection={sortDirection}
						onSort={handleSort}
					>
						MIN
					</SortableHeader>
					<SortableHeader
						column="points"
						currentSort={sortColumn}
						currentDirection={sortDirection}
						onSort={handleSort}
					>
						PTS
					</SortableHeader>
					<SortableHeader
						column="rebounds"
						currentSort={sortColumn}
						currentDirection={sortDirection}
						onSort={handleSort}
					>
						REB
					</SortableHeader>
					<SortableHeader
						column="assists"
						currentSort={sortColumn}
						currentDirection={sortDirection}
						onSort={handleSort}
					>
						AST
					</SortableHeader>
					<SortableHeader
						column="fg"
						currentSort={sortColumn}
						currentDirection={sortDirection}
						onSort={handleSort}
					>
						FG
					</SortableHeader>
					<SortableHeader
						column="3pt"
						currentSort={sortColumn}
						currentDirection={sortDirection}
						onSort={handleSort}
					>
						3PT
					</SortableHeader>
					<SortableHeader
						column="ft"
						currentSort={sortColumn}
						currentDirection={sortDirection}
						onSort={handleSort}
					>
						FT
					</SortableHeader>
					<SortableHeader
						column="steals"
						currentSort={sortColumn}
						currentDirection={sortDirection}
						onSort={handleSort}
					>
						STL
					</SortableHeader>
					<SortableHeader
						column="blocks"
						currentSort={sortColumn}
						currentDirection={sortDirection}
						onSort={handleSort}
					>
						BLK
					</SortableHeader>
					<SortableHeader
						column="plusMinus"
						currentSort={sortColumn}
						currentDirection={sortDirection}
						onSort={handleSort}
					>
						+/-
					</SortableHeader>
				</div>

				{/* Top Section */}
				{topSection.title && topSection.players.length > 0 && (
					<SectionHeader title={topSection.title} isFirst />
				)}
				{topSection.players.length > 0 && (
					<div>
						{topSection.players.map((player) => (
							<PlayerRow
								key={player.id}
								player={player}
								accentColor={accentColor}
								isLive={isLive}
							/>
						))}
					</div>
				)}

				{/* Bottom Section */}
				{bottomSection && bottomSection.players.length > 0 && (
					<>
						<SectionHeader title={bottomSection.title} />
						<div>
							{bottomSection.players.map((player) => (
								<PlayerRow
									key={player.id}
									player={player}
									accentColor={accentColor}
									isLive={isLive}
								/>
							))}
						</div>
					</>
				)}
				</div>
			</Card>
		</div>
	);
}

import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { gameScore } from "@/lib/players/game-log-stats";
import type {
	GamesSortDir,
	GamesSortKey,
	PlayerGameTableRow,
} from "@convex/shared/playerGames";
import { shortDate, signed } from "./stat-parts";

export interface GameLogSort {
	key: GamesSortKey;
	dir: GamesSortDir;
}

type StatKey = Exclude<GamesSortKey, "date">;

const COLUMNS: Array<{ key: StatKey; label: string }> = [
	{ key: "min", label: "MIN" },
	{ key: "pts", label: "PTS" },
	{ key: "reb", label: "REB" },
	{ key: "ast", label: "AST" },
	{ key: "stl", label: "STL" },
	{ key: "blk", label: "BLK" },
	{ key: "tov", label: "TOV" },
	{ key: "fg", label: "FG" },
	{ key: "tp", label: "3P" },
	{ key: "ft", label: "FT" },
	{ key: "pm", label: "+/-" },
	{ key: "gmsc", label: "GmSc" },
];

function cellText(key: StatKey, row: PlayerGameTableRow) {
	switch (key) {
		case "fg":
			return `${row.fgm}-${row.fga}`;
		case "tp":
			return `${row.tpm}-${row.tpa}`;
		case "ft":
			return `${row.ftm}-${row.fta}`;
		case "pm":
			return row.plusMinus === undefined ? "—" : signed(row.plusMinus, 0);
		case "gmsc":
			return gameScore(row).toFixed(1);
		default:
			return String(row[key]);
	}
}

export function GameLogTable({
	sorted,
	sort,
	onSortChange,
	onOpen,
	onOpenInjury,
}: {
	/** Rows in display order */
	sorted: PlayerGameTableRow[];
	/** Leave out for a fixed list, such as a player's latest games */
	sort?: GameLogSort;
	onSortChange?: (sort: GameLogSort) => void;
	onOpen: (espnGameId: string) => void;
	/** Takes the row's `injuryIndex` */
	onOpenInjury: (injuryIndex: number) => void;
}) {
	// Stats sort high-to-low first; a second click flips it
	const toggle = (key: GamesSortKey) =>
		onSortChange?.({
			key,
			dir: sort?.key === key && sort.dir === "desc" ? "asc" : "desc",
		});

	const header = (key: GamesSortKey, label: string, className?: string) => {
		const active = sort?.key === key;
		return (
			<th
				key={key}
				className={cn("px-3 py-2", className)}
				aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : undefined}
			>
				{onSortChange ? (
					<button
						type="button"
						onClick={() => toggle(key)}
						className={cn(
							"inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground",
							active && "text-foreground",
						)}
					>
						{label}
						{active &&
							(sort.dir === "desc" ? (
								<ArrowDown className="size-3" />
							) : (
								<ArrowUp className="size-3" />
							))}
					</button>
				) : (
					<span className="uppercase tracking-wide">{label}</span>
				)}
			</th>
		);
	};

	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[1040px] text-left text-sm tabular-nums">
				<thead className="bg-muted/60 text-xs text-muted-foreground">
					<tr>
						{header("date", "Date")}
						<th className="px-3 py-2 uppercase tracking-wide">Opp</th>
						<th className="px-3 py-2 uppercase tracking-wide">Result</th>
						<th className="px-3 py-2 uppercase tracking-wide">Status</th>
						{COLUMNS.map((column) => header(column.key, column.label))}
					</tr>
				</thead>
				<tbody>
					{sorted.map((row) => {
						const win = row.teamScore > row.oppScore;
						const missed = row.missedReason !== undefined;
						return (
							<tr
								key={row.espnGameId}
								onClick={missed ? undefined : () => onOpen(row.espnGameId)}
								className={cn(
									"border-t border-border/70",
									missed ? "bg-muted/50 text-muted-foreground" : "cursor-pointer hover:bg-muted/40",
								)}
							>
								<td
									className={cn(
										"whitespace-nowrap px-3 py-2 text-muted-foreground",
										missed && "border-l-2 border-l-muted-foreground/50",
									)}
								>
									{missed ? (
										shortDate(row.gameDate)
									) : (
										// The row is clickable; this button is how keyboards reach it
										<button
											type="button"
											onClick={(event) => {
												event.stopPropagation();
												onOpen(row.espnGameId);
											}}
											aria-label={`${shortDate(row.gameDate)} ${row.isHome ? "vs" : "at"} ${row.opponent}: open game`}
											className="rounded-sm underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-current focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											{shortDate(row.gameDate)}
										</button>
									)}
								</td>
								<td className="whitespace-nowrap px-3 py-2 font-medium">
									<span className="text-muted-foreground">{row.isHome ? "vs" : "@"}</span>{" "}
									{row.opponent}
								</td>
								<td className="whitespace-nowrap px-3 py-2">
									<span
										className={cn(
											"font-semibold",
											win ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400",
										)}
									>
										{win ? "W" : "L"}
									</span>{" "}
									{row.teamScore}-{row.oppScore}
								</td>
								<td
									title={row.missedReason}
									className={cn(
										"max-w-48 truncate whitespace-nowrap px-3 py-2",
										missed ? "font-medium text-foreground" : "text-muted-foreground",
									)}
								>
									{row.injuryIndex !== undefined ? (
										<button
											type="button"
											onClick={() => onOpenInjury(row.injuryIndex!)}
											aria-label={`Injured: ${row.missedReason}`}
											className="rounded-sm underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-current focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											Injured
										</button>
									) : (
										(row.missedReason ?? (row.starter ? "Started" : "Bench"))
									)}
								</td>
								{COLUMNS.map((column) => (
									<td
										key={column.key}
										className={cn("px-3 py-2", !missed && column.key === "pts" && "font-semibold")}
									>
										{cellText(column.key, row)}
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

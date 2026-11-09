import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Info, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Image } from "@/components/ui/image";
import { getTeamStaticData } from "@/lib/teams";
import { leagueGameRoutes } from "@/lib/league-routes";
import { TEAM_COLOR_CLASS, teamColorVars } from "@/lib/shared/team-color-vars";
import type { League } from "@/lib/shared/league";
import {
	PHASE_LABELS,
	filterGameLog,
	gameScore,
	isWin,
	summarizeGameLog,
	type GameLogSummary,
	type PlayerGameLogRow,
} from "@/lib/players/game-log-stats";
import {
	Delta,
	HeadlineStat,
	MinorStat,
	ShootingRow,
	signed,
	type Better,
} from "./stat-parts";

export interface PerformancePlayer {
	name: string;
	position: string;
	headshot?: string;
}

/** "20261030" → "Thursday, Oct 30, 2026" */
function longDate(gameDate: string) {
	const date = new Date(
		Number(gameDate.slice(0, 4)),
		Number(gameDate.slice(4, 6)) - 1,
		Number(gameDate.slice(6, 8)),
	);
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function initials(name: string) {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase();
}

const NAV_BUTTON =
	"rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

function CopyLinkButton() {
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) return;
		const timeout = window.setTimeout(() => setCopied(false), 2000);
		return () => window.clearTimeout(timeout);
	}, [copied]);
	return (
		<button
			type="button"
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(window.location.href);
					setCopied(true);
				} catch {
					// Clipboard blocked; the address bar still has the link
				}
			}}
			className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			{copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
			<span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
		</button>
	);
}

interface GamePerformanceDialogProps {
	/** The open game; null closes the dialog */
	row: PlayerGameLogRow | null;
	/** The whole game log, for the averages each game is read against */
	games: PlayerGameLogRow[];
	player: PerformancePlayer;
	league: League;
	onClose: () => void;
	onPrevious?: () => void;
	onNext?: () => void;
}

/**
 * One player's line in one game. Opened from the game log and linkable
 * through the stats page's `game` search param, so it has to say whose
 * performance it is without the page around it.
 */
export function GamePerformanceDialog({
	row,
	games,
	player,
	league,
	onClose,
	onPrevious,
	onNext,
}: GamePerformanceDialogProps) {
	// Keep the last game on screen while the dialog animates closed
	const [shown, setShown] = useState(row);
	if (row && row !== shown) setShown(row);
	const game = row ?? shown;

	return (
		<Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className={cn("max-w-xl", TEAM_COLOR_CLASS)}
				// The color of the team they played for that night
				style={game ? teamColorVars(league, game.teamAbbreviation) : undefined}
				onKeyDown={(event) => {
					if (event.key === "ArrowLeft") onPrevious?.();
					if (event.key === "ArrowRight") onNext?.();
				}}
			>
				{game && <PerformanceBody row={game} games={games} player={player} league={league} />}
				<div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-6">
					<div className="flex gap-1">
						<button
							type="button"
							onClick={onPrevious}
							disabled={!onPrevious}
							aria-label="Previous game in the list"
							className={NAV_BUTTON}
						>
							<ChevronLeft className="size-4" />
						</button>
						<button
							type="button"
							onClick={onNext}
							disabled={!onNext}
							aria-label="Next game in the list"
							className={NAV_BUTTON}
						>
							<ChevronRight className="size-4" />
						</button>
					</div>
					<div className="flex items-center gap-3">
						<CopyLinkButton />
						{game && (
							<Link
								to={leagueGameRoutes[league]}
								params={{ gameId: game.espnGameId }}
								className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
							>
								Box score
								<ArrowUpRight className="size-4" />
							</Link>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function TeamScore({
	league,
	abbreviation,
	score,
	align,
	bold,
}: {
	league: League;
	abbreviation: string;
	score: number;
	align: "left" | "right";
	bold: boolean;
}) {
	const team = getTeamStaticData(league, abbreviation);
	return (
		<div className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse")}>
			{team && (
				<Image src={`/api/${league}/logo/${team.logoSlug}`} alt="" className="size-7 object-contain" />
			)}
			<span className="text-sm font-medium text-muted-foreground">{abbreviation}</span>
			<span className={cn("text-xl tabular-nums", bold ? "font-bold" : "font-medium text-muted-foreground")}>
				{score}
			</span>
		</div>
	);
}

function PerformanceBody({
	row,
	games,
	player,
	league,
}: {
	row: PlayerGameLogRow;
	games: PlayerGameLogRow[];
	player: PerformancePlayer;
	league: League;
}) {
	// Read against the same part of the season, whatever the page is filtered to
	const season: GameLogSummary = useMemo(
		() => summarizeGameLog(filterGameLog(games, row.phase, "all"), "perGame"),
		[games, row.phase],
	);
	const win = isWin(row);
	const opponent = getTeamStaticData(league, row.opponent);
	const team = getTeamStaticData(league, row.teamAbbreviation);
	const s = season.stats;
	const color = "var(--team)";
	const against = "average";
	const vs = (value: number, average: number, better: Better = "higher") => (
		<Delta value={value - average} better={better} against={against} />
	);
	const pct = (made: number, attempted: number) => (attempted > 0 ? (made / attempted) * 100 : null);
	const away = { abbreviation: row.isHome ? row.opponent : row.teamAbbreviation };
	const home = { abbreviation: row.isHome ? row.teamAbbreviation : row.opponent };
	const awayScore = row.isHome ? row.oppScore : row.teamScore;
	const homeScore = row.isHome ? row.teamScore : row.oppScore;

	return (
		<>
			<DialogHeader className="gap-4 pr-12">
				<div className="flex items-center gap-4">
					<div
						className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-lg font-bold text-muted-foreground"
						style={{ outline: "2px solid var(--team)", outlineOffset: 3 }}
					>
						{player.headshot ? (
							<Image src={player.headshot} alt="" className="size-full object-cover" />
						) : (
							initials(player.name)
						)}
					</div>
					<div className="min-w-0 space-y-1.5">
						<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Game performance
						</p>
						<DialogTitle className="text-xl font-bold">
							{player.name}
							<span className="sr-only">
								{" "}
								{row.isHome ? "vs" : "at"} {opponent?.fullName ?? row.opponent}
							</span>
						</DialogTitle>
						<DialogDescription>
							{[team?.fullName ?? row.teamAbbreviation, player.position].filter(Boolean).join(" · ")}
						</DialogDescription>
					</div>
				</div>

				{/* The game, away team first like the scoreboard */}
				<div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
					<div className="flex items-center justify-between gap-3">
						<TeamScore
							league={league}
							abbreviation={away.abbreviation}
							score={awayScore}
							align="left"
							bold={awayScore > homeScore}
						/>
						<span
							className={cn(
								"rounded-full px-2 py-0.5 text-xs font-semibold",
								win
									? "bg-green-500/15 text-green-700 dark:text-green-400"
									: "bg-red-500/15 text-red-700 dark:text-red-400",
							)}
						>
							{win ? "Win" : "Loss"}
						</span>
						<TeamScore
							league={league}
							abbreviation={home.abbreviation}
							score={homeScore}
							align="right"
							bold={homeScore > awayScore}
						/>
					</div>
					<p className="mt-1.5 text-center text-xs text-muted-foreground">
						{longDate(row.gameDate)} · {row.starter ? "Started" : "Off the bench"}
					</p>
				</div>
			</DialogHeader>

			<div className="grid grid-cols-3 divide-x divide-border/60">
				<HeadlineStat label="Points" value={String(row.pts)} delta={vs(row.pts, s.pts)} color={color} />
				<HeadlineStat label="Rebounds" value={String(row.reb)} delta={vs(row.reb, s.reb)} color={color} />
				<HeadlineStat label="Assists" value={String(row.ast)} delta={vs(row.ast, s.ast)} color={color} />
			</div>
			{/* Hairlines between the cells: right edges except the last column, bottoms on the first row */}
			<div className="grid grid-cols-4 border-y border-border/60 bg-muted/40 [&>*]:border-border/60 [&>*:not(:nth-child(4n))]:border-r [&>*:nth-child(-n+4)]:border-b">
				<MinorStat label="MIN" value={String(row.min)} delta={vs(row.min, s.min, "neither")} />
				<MinorStat label="STL" value={String(row.stl)} delta={vs(row.stl, s.stl)} />
				<MinorStat label="BLK" value={String(row.blk)} delta={vs(row.blk, s.blk)} />
				<MinorStat label="TOV" value={String(row.tov)} delta={vs(row.tov, s.tov, "lower")} />
				<MinorStat label="OREB" value={String(row.oreb)} delta={vs(row.oreb, s.oreb)} />
				<MinorStat label="Fouls" value={String(row.pf)} delta={vs(row.pf, s.pf, "lower")} />
				<MinorStat
					label="+/-"
					value={row.plusMinus === undefined ? "—" : signed(row.plusMinus, 0)}
					delta={
						row.plusMinus !== undefined && season.plusMinus !== null
							? vs(row.plusMinus, season.plusMinus)
							: undefined
					}
				/>
				<MinorStat
					label="Game Score"
					value={gameScore(row).toFixed(1)}
					delta={season.gameScore !== null ? vs(gameScore(row), season.gameScore) : undefined}
				/>
			</div>
			<div className="divide-y divide-border/60">
				<ShootingRow
					label="FG"
					detail={`${row.fgm}-${row.fga}`}
					pct={pct(row.fgm, row.fga)}
					seasonPct={season.fgPct}
					color={color}
					against={against}
				/>
				<ShootingRow
					label="3P"
					detail={`${row.tpm}-${row.tpa}`}
					pct={pct(row.tpm, row.tpa)}
					seasonPct={season.tpPct}
					color={color}
					against={against}
				/>
				<ShootingRow
					label="FT"
					detail={`${row.ftm}-${row.fta}`}
					pct={pct(row.ftm, row.fta)}
					seasonPct={season.ftPct}
					color={color}
					against={against}
				/>
			</div>
			<p className="flex items-center gap-1.5 border-t border-border/60 px-4 py-4 text-xs text-muted-foreground sm:px-6">
				<Info className="size-3.5 shrink-0" aria-hidden />
				Arrows and marks compare with their {PHASE_LABELS[row.phase].toLowerCase()} averages.
			</p>
		</>
	);
}

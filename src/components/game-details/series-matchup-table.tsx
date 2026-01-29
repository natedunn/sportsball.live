import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import type { SeasonSeries } from "@/lib/nba/game-details.server";

type League = "nba" | "wnba" | "gleague";

interface SeriesMatchupTableProps {
	allSeries: SeasonSeries[];
	league: League;
}

// Typed game link component to handle different league routes
function GameLink({
	league,
	gameId,
	children,
}: {
	league: League;
	gameId: string;
	children: React.ReactNode;
}) {
	const className = "link-text text-sm";
	const search = { tab: "matchups" as const };

	if (league === "nba") {
		return (
			<Link
				to="/nba/game/$gameId"
				params={{ gameId }}
				search={search}
				className={className}
			>
				{children}
			</Link>
		);
	}
	if (league === "wnba") {
		return (
			<Link
				to="/wnba/game/$gameId"
				params={{ gameId }}
				search={search}
				className={className}
			>
				{children}
			</Link>
		);
	}
	return (
		<Link
			to="/gleague/game/$gameId"
			params={{ gameId }}
			search={search}
			className={className}
		>
			{children}
		</Link>
	);
}

// Calculate running series record after each game
function calculateSeriesRecords(
	games: SeasonSeries["games"],
): Map<
	string,
	{ team1: string; team1Wins: number; team2: string; team2Wins: number }
> {
	const records = new Map<
		string,
		{ team1: string; team1Wins: number; team2: string; team2Wins: number }
	>();

	if (games.length === 0) return records;

	// Get consistent team ordering (alphabetically by abbreviation)
	const teams = [
		games[0].awayTeam.abbreviation,
		games[0].homeTeam.abbreviation,
	].sort();
	const [team1, team2] = teams;

	let team1Wins = 0;
	let team2Wins = 0;

	for (const game of games) {
		const winner = game.awayTeam.winner
			? game.awayTeam.abbreviation
			: game.homeTeam.abbreviation;
		if (winner === team1) {
			team1Wins++;
		} else {
			team2Wins++;
		}
		records.set(game.id, { team1, team1Wins, team2, team2Wins });
	}

	return records;
}

function formatSeriesRecord(record: {
	team1: string;
	team1Wins: number;
	team2: string;
	team2Wins: number;
}): string {
	if (record.team1Wins === record.team2Wins) {
		return `Tied ${record.team1Wins}-${record.team2Wins}`;
	}
	if (record.team1Wins > record.team2Wins) {
		return `${record.team1} ${record.team1Wins}-${record.team2Wins}`;
	}
	return `${record.team2} ${record.team2Wins}-${record.team1Wins}`;
}

interface MatchupTableProps {
	games: SeasonSeries["games"];
	records: Map<
		string,
		{ team1: string; team1Wins: number; team2: string; team2Wins: number }
	>;
	league: League;
	currentGameDate: Date | null;
}

// Striped background style for hidden results
const hiddenRowStyle = {
	background:
		"repeating-linear-gradient(135deg, transparent, transparent 4px, var(--color-muted) 4px, var(--color-muted) 5px)",
};

function MatchupTable({
	games,
	records,
	league,
	currentGameDate,
}: MatchupTableProps) {
	const [tooltip, setTooltip] = React.useState<{
		x: number;
		y: number;
	} | null>(null);
	const currentYear = new Date().getFullYear();

	const handleMouseMove = (e: React.MouseEvent) => {
		setTooltip({ x: e.clientX, y: e.clientY });
	};

	const handleMouseLeave = () => {
		setTooltip(null);
	};

	return (
		<>
			<table className="w-full">
				<thead>
					<tr className="border-b border-border/50">
						<th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">
							Outcome
						</th>
						<th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">
							Date
						</th>
						<th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">
							Series
						</th>
						<th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">
							Diff
						</th>
						<th className="text-right text-xs font-medium text-muted-foreground px-4 py-2 w-20">
							<span className="sr-only">Details</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{games.map((game, index) => {
						const gameDate = new Date(game.date);
						const gameYear = gameDate.getFullYear();
						const formattedDate = gameDate.toLocaleDateString("en-US", {
							weekday: "short",
							month: "short",
							day: "numeric",
							...(gameYear !== currentYear && { year: "numeric" }),
						});

						const isLast = index === games.length - 1;
						const record = records.get(game.id);

						// Game state flags
						const isFutureGame = currentGameDate && gameDate > currentGameDate;
						const hasNotBeenPlayed =
							!game.awayTeam.winner &&
							!game.homeTeam.winner &&
							game.awayTeam.score === 0 &&
							game.homeTeam.score === 0;
						const hideResults = isFutureGame || hasNotBeenPlayed;
						const showSpoilerTooltip = Boolean(isFutureGame && !hasNotBeenPlayed);

						// Tooltip handlers for spoiler cells
						const spoilerCellProps = showSpoilerTooltip
							? {
									onMouseMove: handleMouseMove,
									onMouseLeave: handleMouseLeave,
								}
							: {};

						const cellClass = (base: string) =>
							`${base}${showSpoilerTooltip ? " cursor-help" : ""}`;

						return (
							<tr
								key={game.id}
								className={`${!isLast ? "border-b border-border/50" : ""} ${game.isCurrent ? "bg-primary/10" : ""}`}
								style={hideResults ? hiddenRowStyle : undefined}
							>
								<td
									{...spoilerCellProps}
									className={cellClass("px-4 py-2.5")}
								>
									<div className="flex items-center gap-3">
										{hideResults ? (
											<>
												<span className="font-medium text-muted-foreground">
													{game.awayTeam.abbreviation}
												</span>
												<span className="text-muted-foreground text-sm">@</span>
												<span className="font-medium text-muted-foreground">
													{game.homeTeam.abbreviation}
												</span>
											</>
										) : (
											<>
												<div className="flex items-center gap-1.5">
													<span
														className={`font-medium ${game.awayTeam.winner ? "" : "text-muted-foreground"}`}
													>
														{game.awayTeam.abbreviation}
													</span>
													<span
														className={`tabular-nums ${game.awayTeam.winner ? "font-bold" : "text-muted-foreground"}`}
													>
														{game.awayTeam.score}
													</span>
												</div>
												<span className="text-muted-foreground text-sm">@</span>
												<div className="flex items-center gap-1.5">
													<span
														className={`tabular-nums ${game.homeTeam.winner ? "font-bold" : "text-muted-foreground"}`}
													>
														{game.homeTeam.score}
													</span>
													<span
														className={`font-medium ${game.homeTeam.winner ? "" : "text-muted-foreground"}`}
													>
														{game.homeTeam.abbreviation}
													</span>
												</div>
												{game.statusDetail?.toLowerCase().includes("ot") && (
													<span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
														OT
													</span>
												)}
											</>
										)}
									</div>
								</td>
								<td
									{...spoilerCellProps}
									className={cellClass(
										"px-4 py-2.5 text-sm text-muted-foreground",
									)}
								>
									{formattedDate}
								</td>
								<td
									{...spoilerCellProps}
									className={cellClass(
										"px-4 py-2.5 text-sm text-muted-foreground",
									)}
								>
									{!hideResults && record && formatSeriesRecord(record)}
								</td>
								<td
									{...spoilerCellProps}
									className={cellClass(
										"px-4 py-2.5 text-right text-sm tabular-nums text-muted-foreground",
									)}
								>
									{!hideResults &&
										`+${Math.abs(game.awayTeam.score - game.homeTeam.score)}`}
								</td>
								<td className="px-4 py-2.5 text-right">
									{game.isCurrent ? (
										<span className="text-primary text-sm">Current</span>
									) : (
										<GameLink league={league} gameId={game.id}>
											{hasNotBeenPlayed ? "Preview" : "View"}
										</GameLink>
									)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			{tooltip && (
				<div
					className="fixed z-50 pointer-events-none px-2 py-1 text-xs text-background bg-foreground rounded-md shadow-md max-w-48"
					style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
				>
					Results hidden to avoid spoilers. Click View to see the outcome.
				</div>
			)}
		</>
	);
}

export function SeriesMatchupTable({
	allSeries,
	league,
}: SeriesMatchupTableProps) {
	// Find the current game's date across all series
	const currentGameDate = React.useMemo(() => {
		const currentGame = allSeries.flatMap((s) => s.games).find((g) => g.isCurrent);
		return currentGame ? new Date(currentGame.date) : null;
	}, [allSeries]);

	// Sort: regular season first, then playoffs (chronological order)
	const sortedSeries = React.useMemo(
		() =>
			[...allSeries].sort((a, b) => {
				if (a.type === "season" && b.type === "playoff") return -1;
				if (a.type === "playoff" && b.type === "season") return 1;
				return 0;
			}),
		[allSeries],
	);

	return (
		<div className="mx-auto w-full space-y-6">
			{sortedSeries.map((series, seriesIndex) => {
				const seriesRecords = calculateSeriesRecords(series.games);
				const isPlayoffs = series.type === "playoff";

				return (
					<div key={`${series.type}-${seriesIndex}`} className="space-y-3">
						<div className="text-center">
							<h3 className="text-lg font-semibold">{series.summary}</h3>
							<p className="text-sm text-muted-foreground">
								{series.title}
								{!isPlayoffs && series.completed && " · Complete"}
							</p>
						</div>

						<Card classNames={{ inner: "flex-col p-0" }}>
							<MatchupTable
								games={series.games}
								records={seriesRecords}
								league={league}
								currentGameDate={currentGameDate}
							/>
						</Card>
					</div>
				);
			})}
		</div>
	);
}

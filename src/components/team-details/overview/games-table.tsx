import { Link } from "@tanstack/react-router";
import { Image } from "@/components/ui/image";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatGameDate } from "@/lib/date";
import type { ScheduleGame } from "@/lib/types/team";

type League = "nba" | "wnba" | "gleague";

interface GamesTableProps {
	recentGames: ScheduleGame[];
	upcomingGames: ScheduleGame[];
	league: League;
}

const gameRoutes: Record<League, string> = {
	nba: "/nba/game/$gameId",
	wnba: "/wnba/game/$gameId",
	gleague: "/gleague/game/$gameId",
};

export function GamesTable({ recentGames, upcomingGames, league }: GamesTableProps) {
	// Last 3 recent games (most recent first, then reverse for chronological)
	const last3 = recentGames.slice(0, 3).reverse();
	// Next 3 upcoming games
	const next3 = upcomingGames.slice(0, 3);

	// Combine: last 3 (chronological) + next 3
	const games = [...last3, ...next3];

	if (games.length === 0) {
		return (
			<Card classNames={{ inner: "flex-col p-0" }}>
				<p className="text-sm text-muted-foreground text-center py-8">
					No games to display
				</p>
			</Card>
		);
	}

	return (
		<Card classNames={{ inner: "flex-col p-0" }}>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-muted/50">
							<th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
								Date
							</th>
							<th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
								Opponent
							</th>
							<th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
								Result
							</th>
						</tr>
					</thead>
					<tbody>
						{games.map((game) => {
							return (
								<tr
									key={game.id}
									className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
								>
									{/* Date */}
									<td className="px-4 py-2.5 whitespace-nowrap">
										<div className="text-muted-foreground">
											{formatGameDate(new Date(game.date), { format: "short" })}
										</div>
									</td>

									{/* Opponent */}
									<td className="px-4 py-2.5">
										<Link
											to={gameRoutes[league]}
											params={{ gameId: game.id }}
											className="flex items-center gap-2.5 hover:underline"
										>
											<div className="relative h-6 w-6 flex-shrink-0 rounded bg-muted/50 p-0.5">
												<Image
													src={game.opponent.logo}
													alt={game.opponent.name}
													className="h-full w-full object-contain"
												/>
											</div>
											<span className="font-medium">
												<span className="text-muted-foreground text-xs mr-1">
													{game.isHome ? "vs" : "@"}
												</span>
												{game.opponent.name}
											</span>
										</Link>
									</td>

									{/* Result */}
									<td className="px-4 py-2.5 text-right">
										{game.result ? (
											<span
												className={cn(
													"inline-flex items-center gap-1.5 font-bold",
													game.result.isWin
														? "text-green-600 dark:text-green-400"
														: "text-red-600 dark:text-red-400"
												)}
											>
												<span>{game.result.isWin ? "W" : "L"}</span>
												<span className="tabular-nums text-foreground font-normal">
													{game.result.score}-{game.result.opponentScore}
												</span>
											</span>
										) : (
											<span className="text-xs text-muted-foreground">
												{game.statusDetail}
											</span>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</Card>
	);
}

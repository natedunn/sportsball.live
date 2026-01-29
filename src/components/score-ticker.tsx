import { Link } from "@tanstack/react-router";
import type { GameData } from "@/lib/types";

type League = "nba" | "wnba" | "gleague";

const leagueGameRoutes: Record<League, string> = {
	nba: "/nba/game/$gameId",
	wnba: "/wnba/game/$gameId",
	gleague: "/gleague/game/$gameId",
};

export function ScoreTicker({
	games,
	league,
}: {
	games: GameData[];
	league: League;
}) {
	if (games.length === 0) {
		return (
			<div className="text-sm text-muted-foreground">No games today</div>
		);
	}

	return (
		<div className="flex gap-3 overflow-x-auto pb-2">
			{games.map((game) => (
				<Link
					key={game.id}
					to={leagueGameRoutes[league]}
					params={{ gameId: game.id }}
					className="flex min-w-[140px] flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
				>
					<div className="flex items-center justify-between gap-2">
						<span className="truncate text-xs font-medium">
							{game.away.name}
						</span>
						<span className="text-xs font-bold tabular-nums">
							{game.state !== "pre" ? game.away.score : "-"}
						</span>
					</div>
					<div className="flex items-center justify-between gap-2">
						<span className="truncate text-xs font-medium">
							{game.home.name}
						</span>
						<span className="text-xs font-bold tabular-nums">
							{game.state !== "pre" ? game.home.score : "-"}
						</span>
					</div>
					<div className="mt-1 text-[10px] text-muted-foreground">
						{game.state === "in" && (
							<span className="font-medium text-green-600 dark:text-green-400">
								LIVE
							</span>
						)}
						{game.state === "post" && "Final"}
						{game.state === "pre" && game.time.detail}
					</div>
				</Link>
			))}
		</div>
	);
}

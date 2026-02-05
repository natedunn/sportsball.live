import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Competitor } from "./competitor";
import { Score } from "./score";
import { formatGameDate } from "@/lib/date";
import { useFavorites } from "@/lib/use-favorites";
import { leagueLabels, type League } from "@/lib/teams";
import { leagueGameRoutes } from "@/lib/league-routes";
import type { GameData } from "@/lib/types";

interface ScoreboardProps {
	game: GameData;
	currentDate?: string;
	league?: League;
	showLeagueTag?: boolean;
}

export function Scoreboard({
	game,
	currentDate,
	league = "nba",
	showLeagueTag = false,
}: ScoreboardProps) {
	const { isFavorited } = useFavorites();
	const homeTeam = game.home;
	const awayTeam = game.away;

	const classes = {
		wrapper: "p-4 md:min-w-32.5",
	};

	return (
		<Card>
			{showLeagueTag && (
				<span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-b bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
					{leagueLabels[league]}
				</span>
			)}
			<Competitor homeAway="away" classes={classes} team={awayTeam} isFavorited={isFavorited(league, awayTeam.id)} />
			<div className="flex flex-col items-center justify-center gap-2">
				<div>
					{(game.state === "in" || game.state === "post") && (
						<Score
							awayScore={Number(awayTeam.score)}
							homeScore={Number(homeTeam.score)}
							gameState={game.state}
						/>
					)}
				</div>
				<div className="flex items-center justify-center gap-2">
					{game.time.detail && (
						<span className="text-muted-foreground">
							{game.state === "pre" && game.time.start
								? `Starts ${formatGameDate(new Date(game.time.start), true)}`
								: game.time.detail}
						</span>
					)}
					{(game.state === "in" || game.state === "post") && (
						<>
							<span className="text-muted-foreground">|</span>
							<Link
								to={leagueGameRoutes[league]}
								params={{ gameId: game.id }}
								search={currentDate ? { fromDate: currentDate } : undefined}
								className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground hover:underline focus:text-foreground focus:underline"
							>
								<span>Box score</span>
							</Link>
						</>
					)}
				</div>
			</div>
			<Competitor homeAway="home" classes={classes} team={homeTeam} isFavorited={isFavorited(league, homeTeam.id)} />
		</Card>
	);
}

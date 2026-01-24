import { Card } from "@/components/ui/card";
import { Competitor } from "./competitor";
import { Score } from "./score";
import { formatGameDate } from "@/lib/date";
import type { GameData } from "@/lib/types";

interface ScoreboardProps {
	game: GameData;
	showInfoLink?: boolean;
}

export function Scoreboard({ game, showInfoLink = false }: ScoreboardProps) {
	const homeTeam = game.home;
	const awayTeam = game.away;

	const classes = {
		wrapper: "p-4 md:min-w-[130px]",
	};

	return (
		<Card>
			<Competitor homeAway="away" classes={classes} team={awayTeam} />
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
					{showInfoLink && (
						<>
							<span className="text-muted-foreground">|</span>
							<a
								href={`/nba/game/${game.id}`}
								className="inline-flex items-center gap-2 hover:text-foreground hover:underline focus:text-foreground focus:underline"
							>
								<span>Game info</span>
							</a>
						</>
					)}
				</div>
			</div>
			<Competitor homeAway="home" classes={classes} team={homeTeam} />
		</Card>
	);
}

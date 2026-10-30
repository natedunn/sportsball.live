import { PlayerBoxScore } from "./player-box-score";
import { TeamStatsCard } from "./team-stats-card";
import { SeriesMatchupTable } from "./series-matchup-table";
import { useGameDetails } from "./game-details-layout";

// Game tab pages. Each league's game child routes render these; the data
// comes from the game layout route.

export function GameBoxScorePage() {
	const { game } = useGameDetails();
	return (
		<div className="flex flex-col gap-6">
			<PlayerBoxScore
				team={game.away}
				accentColor={game.away.darkColor}
				isLive={game.state === "in"}
			/>
			<PlayerBoxScore
				team={game.home}
				accentColor={game.home.darkColor}
				isLive={game.state === "in"}
			/>
		</div>
	);
}

export function GameTeamStatsPage() {
	const { game } = useGameDetails();
	return (
		<div className="mx-auto">
			<TeamStatsCard away={game.away} home={game.home} />
		</div>
	);
}

export function GameMatchupsPage() {
	const { game, league } = useGameDetails();

	if (!game.allSeries || game.allSeries.length === 0) {
		return (
			<p className="py-16 text-center text-muted-foreground">
				No season matchups between these teams yet.
			</p>
		);
	}

	return <SeriesMatchupTable allSeries={game.allSeries} league={league} />;
}

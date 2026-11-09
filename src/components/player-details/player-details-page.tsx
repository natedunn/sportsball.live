import { Link } from "@tanstack/react-router";
import { playerStatus } from "@/lib/players/player-status";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { leaguePlayersRoutes } from "@/lib/league-routes";
import type { League } from "@/lib/shared/league";
import { useCurrentSeasonName } from "@/lib/use-current-season";
import { useRouteTab } from "@/lib/route-tabs";
import {
	PLAYER_TABS,
	PlayerDetailsLayout,
	PlayerDetailsPending,
} from "@/components/player-details/player-details-layout";
import { api } from "~api";
import type { PlayerGamesOptions } from "@convex/shared/playerGames";

interface PlayerDetailsPageProps {
	league: League;
	playerId: string;
	/** The tab page, from the layout route's `<Outlet />` */
	children: ReactNode;
}

export { PlayerDetailsPending };

const playerDetailsQueries = {
	nba: api.nba.queries.getPlayerDetails,
	wnba: api.wnba.queries.getPlayerDetails,
	gleague: api.gleague.queries.getPlayerDetails,
};

/** The player page's data. The player layout routes prime it in their loader. */
export function playerDetailsQuery(
	league: League,
	season: string,
	espnPlayerId: string,
) {
	return convexQuery(playerDetailsQueries[league], { season, espnPlayerId });
}

const playerGameLogQueries = {
	nba: api.nba.queries.getPlayerGameLog,
	wnba: api.wnba.queries.getPlayerGameLog,
	gleague: api.gleague.queries.getPlayerGameLog,
};

const playerGamesQueries = {
	nba: api.nba.queries.getPlayerGames,
	wnba: api.wnba.queries.getPlayerGames,
	gleague: api.gleague.queries.getPlayerGames,
};

/** The latest games shown on the games tab */
export const GAMES_PREVIEW_SIZE = 20;

/** One page of the player's games, with their availability for the season */
export function playerGamesQuery(
	league: League,
	season: string,
	espnPlayerId: string,
	options: PlayerGamesOptions,
) {
	return convexQuery(playerGamesQueries[league], { season, espnPlayerId, ...options });
}

/** Every game with both teams' box scores. Costly: load it only when it's needed */
export function playerGameLogQuery(league: League, season: string, espnPlayerId: string) {
	return convexQuery(playerGameLogQueries[league], { season, espnPlayerId });
}

export function PlayerDetailsPage({
	league,
	playerId,
	children,
}: PlayerDetailsPageProps) {
	const activeTab = useRouteTab(PLAYER_TABS);
	const season = useCurrentSeasonName(league);
	const { data, isLoading } = useQuery({
		...playerDetailsQuery(league, season ?? "", playerId),
		enabled: !!season,
	});

	const player = data?.player;
	const teammates = data?.teammates ?? [];
	const status = playerStatus(data?.injuryReport);

	if (isLoading) {
		return <PlayerDetailsPending />;
	}

	if (!player) {
		return (
			<div className="container py-12">
				<h1 className="text-2xl font-bold">Player not found</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					We could not find this player id. Return to the player rankings page.
				</p>
				<Link
					to={leaguePlayersRoutes[league]}
					className="mt-4 inline-flex text-orange-600 hover:underline dark:text-orange-400"
				>
					Back to players
				</Link>
			</div>
		);
	}

	return (
		<PlayerDetailsLayout
			player={player}
			teammates={teammates}
			status={status}
			league={league}
			season={season ?? ""}
			activeTab={activeTab}
		>
			{children}
		</PlayerDetailsLayout>
	);
}

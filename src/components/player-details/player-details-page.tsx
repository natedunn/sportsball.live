import { Link } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
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
	const allPlayers = data?.allPlayers ?? [];
	const teammates = useMemo(() => {
		if (!player) return [];
		const allById = new Map(allPlayers.map((entry: any) => [entry.id, entry]));
		return player.teammateIds
			.map((teammateId: string) => allById.get(teammateId))
			.filter(Boolean);
	}, [allPlayers, player]);

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
			allPlayers={allPlayers}
			league={league}
			activeTab={activeTab}
		>
			{children}
		</PlayerDetailsLayout>
	);
}

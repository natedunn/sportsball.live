import { createFileRoute } from "@tanstack/react-router";
import { PlayerGameLogPage } from "@/components/player-details/player-pages";
import {
	gameLogOptions,
	loadPlayerGames,
	playerStatsSeo,
	validateGameLogSearch,
} from "@/lib/players/stats-route";

export const Route = createFileRoute("/_default/nba/player/$id/games_/log")({
	validateSearch: validateGameLogSearch,
	loaderDeps: ({ search }) => search,
	loader: ({ context, params, deps }) =>
		loadPlayerGames(context.queryClient, "nba", params.id, deps.game, gameLogOptions(deps)),
	head: ({ params, loaderData }) => ({
		meta: playerStatsSeo("nba", params.id, loaderData?.performance),
	}),
	component: GameLogRoute,
});

function GameLogRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<PlayerGameLogPage
			search={search}
			onSearchChange={(change) =>
				navigate({ search: (current) => ({ ...current, ...change }), resetScroll: false })
			}
		/>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { PlayerGamesPage } from "@/components/player-details/player-pages";
import {
	gamesOptions,
	loadPlayerGames,
	playerStatsSeo,
	validateGamesSearch,
} from "@/lib/players/stats-route";

export const Route = createFileRoute("/_default/wnba/player/$id/games")({
	validateSearch: validateGamesSearch,
	loaderDeps: ({ search }) => search,
	loader: ({ context, params, deps }) =>
		loadPlayerGames(context.queryClient, "wnba", params.id, deps.game, gamesOptions(deps)),
	head: ({ params, loaderData }) => ({
		meta: playerStatsSeo("wnba", params.id, loaderData?.performance),
	}),
	component: GamesRoute,
});

function GamesRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<PlayerGamesPage
			search={search}
			onSearchChange={(change) =>
				navigate({ search: (current) => ({ ...current, ...change }), resetScroll: false })
			}
		/>
	);
}

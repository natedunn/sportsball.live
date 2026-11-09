import { createFileRoute } from "@tanstack/react-router";
import { PlayerStatsPage } from "@/components/player-details/player-pages";
import { loadPlayerStats, playerStatsSeo } from "@/lib/players/stats-route";

interface StatsSearchParams {
	/**
	 * ESPN game id: opens that game's performance, so it can be shared. A
	 * number, since the router would quote a numeric string in the URL.
	 */
	game?: number;
}

export const Route = createFileRoute("/_default/gleague/player/$id/stats")({
	validateSearch: (search: Record<string, unknown>): StatsSearchParams => ({
		game: Number.isSafeInteger(Number(search.game)) && Number(search.game) > 0 ? Number(search.game) : undefined,
	}),
	loaderDeps: ({ search }) => ({ game: search.game }),
	loader: ({ context, params, deps }) =>
		loadPlayerStats(context.queryClient, "gleague", params.id, deps.game),
	head: ({ params, loaderData }) => ({
		meta: playerStatsSeo("gleague", params.id, loaderData?.performance),
	}),
	component: StatsRoute,
});

function StatsRoute() {
	const { game } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<PlayerStatsPage
			game={game === undefined ? undefined : String(game)}
			onGameChange={(next) =>
				navigate({ search: { game: next ? Number(next) : undefined }, resetScroll: false })
			}
		/>
	);
}

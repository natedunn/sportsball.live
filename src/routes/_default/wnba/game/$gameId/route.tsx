import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { useMemo } from "react";
import { convexGameDetailsToGameDetails } from "@/lib/shared/convex-adapters";
import { syncLiveGame } from "@/lib/shared/sync.server";
import { useLiveScoreSync } from "@/lib/shared/live-score-sync";
import {
	GAME_TABS,
	GameDetailsLayout,
	GameDetailsPending,
} from "@/components/game-details/game-details-layout";
import { useRouteTab } from "@/lib/route-tabs";
import { toGameMeta } from "@/lib/og/game-meta";
import { gameSeo } from "@/lib/seo";

interface GameSearchParams {
	fromDate?: string;
}

export const Route = createFileRoute("/_default/wnba/game/$gameId")({
	validateSearch: (search: Record<string, unknown>): GameSearchParams => {
		return {
			fromDate:
				typeof search.fromDate === "string" ? search.fromDate : undefined,
		};
	},
	loader: async ({ context, params }) => {
		// Pre-populate Convex data for SSR
		const details = await context.queryClient.ensureQueryData(
			convexQuery(api.wnba.queries.getGameDetails, { espnGameId: params.gameId }),
		);
		// Trigger ESPN→Convex sync (throttled to 15s)
		await syncLiveGame({ data: { espnGameId: params.gameId, league: "wnba" } });
		return { gameMeta: toGameMeta(details) };
	},
	head: ({ params, loaderData }) => ({
		meta: gameSeo("wnba", params.gameId, loaderData?.gameMeta),
	}),
	pendingComponent: GameDetailsPending,
	component: WnbaGameDetailsPage,
});

function WnbaGameDetailsPage() {
	const { gameId } = Route.useParams();
	const { fromDate } = Route.useSearch();
	const activeTab = useRouteTab(GAME_TABS);

	const { data: rawGame, refetch } = useQuery(
		convexQuery(api.wnba.queries.getGameDetails, { espnGameId: gameId }),
	);

	useLiveScoreSync({
		league: "wnba",
		rawGames: rawGame ? [rawGame as any] : [],
		refetch,
	});

	const game = useMemo(
		() => convexGameDetailsToGameDetails(rawGame, "wnba"),
		[rawGame],
	);

	if (!game) {
		return (
			<div className="container py-12">
				<p className="text-center text-muted-foreground">Game not found</p>
			</div>
		);
	}

	return (
		<GameDetailsLayout
			game={game}
			league="wnba"
			fromDate={fromDate}
			activeTab={activeTab}
		>
			<Outlet />
		</GameDetailsLayout>
	);
}

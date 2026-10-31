import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
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

export const Route = createFileRoute("/_default/nba/game/$gameId")({
	validateSearch: (search: Record<string, unknown>): GameSearchParams => {
		return {
			fromDate:
				typeof search.fromDate === "string" ? search.fromDate : undefined,
		};
	},
	loader: async ({ context, params }) => {
		// Pre-populate Convex data for SSR
		const details = await context.queryClient.ensureQueryData(
			convexQuery(api.nba.queries.getGameDetails, { espnGameId: params.gameId }),
		);
		// Trigger ESPN→Convex sync (throttled to 15s)
		await syncLiveGame({ data: { espnGameId: params.gameId, league: "nba" } });
		return { gameMeta: toGameMeta(details) };
	},
	head: ({ params, loaderData }) => ({
		meta: gameSeo("nba", params.gameId, loaderData?.gameMeta),
	}),
	pendingComponent: GameDetailsPending,
	component: NbaGameDetailsPage,
});

function NbaGameDetailsPage() {
	const { gameId } = Route.useParams();
	const { fromDate } = Route.useSearch();
	const activeTab = useRouteTab(GAME_TABS);

	const { data: rawGame, refetch } = useQuery(
		convexQuery(api.nba.queries.getGameDetails, { espnGameId: gameId }),
	);

	useLiveScoreSync({
		league: "nba",
		rawGames: rawGame ? [rawGame as any] : [],
		refetch,
	});

	const game = useMemo(
		() => convexGameDetailsToGameDetails(rawGame, "nba"),
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
			league="nba"
			fromDate={fromDate}
			activeTab={activeTab}
		>
			<Outlet />
		</GameDetailsLayout>
	);
}

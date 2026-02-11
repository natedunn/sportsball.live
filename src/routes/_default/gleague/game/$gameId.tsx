import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { useState, useEffect, useMemo } from "react";
import { convexGameDetailsToGameDetails } from "@/lib/shared/convex-adapters";
import { syncLiveGame } from "@/lib/shared/sync.server";
import { useLiveScoreSync } from "@/lib/shared/live-score-sync";
import {
	GameDetailsLayout,
	GameDetailsPending,
} from "@/components/game-details/game-details-layout";

interface GameSearchParams {
	fromDate?: string;
	tab?: string;
}

export const Route = createFileRoute("/_default/gleague/game/$gameId")({
	validateSearch: (search: Record<string, unknown>): GameSearchParams => {
		return {
			fromDate:
				typeof search.fromDate === "string" ? search.fromDate : undefined,
			tab: typeof search.tab === "string" ? search.tab : undefined,
		};
	},
	loader: async ({ context, params }) => {
		// Pre-populate Convex data for SSR
		await context.queryClient.ensureQueryData(
			convexQuery(api.gleague.queries.getGameDetails, { espnGameId: params.gameId }),
		);
		// Trigger ESPN→Convex sync (throttled to 15s)
		await syncLiveGame({ data: { espnGameId: params.gameId, league: "gleague" } });
	},
	pendingComponent: GameDetailsPending,
	component: GLeagueGameDetailsPage,
});

function GLeagueGameDetailsPage() {
	const { gameId } = Route.useParams();
	const { fromDate, tab } = Route.useSearch();
	const navigate = useNavigate();

	const { data: rawGame, refetch } = useQuery(
		convexQuery(api.gleague.queries.getGameDetails, { espnGameId: gameId }),
	);

	useLiveScoreSync({
		league: "gleague",
		rawGames: rawGame ? [rawGame as any] : [],
		refetch,
	});

	const game = useMemo(
		() => convexGameDetailsToGameDetails(rawGame, "gleague"),
		[rawGame],
	);

	// Local state for immediate UI feedback
	const [activeTab, setActiveTab] = useState(tab || "box-score");

	// Sync local state when URL changes (e.g., browser back/forward)
	useEffect(() => {
		setActiveTab(tab || "box-score");
	}, [tab]);

	const handleTabChange = (newTab: string) => {
		// Immediate UI update
		setActiveTab(newTab);
		// Async URL update
		navigate({
			to: "/gleague/game/$gameId",
			params: { gameId },
			search: { fromDate, tab: newTab },
			replace: true,
		});
	};

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
			league="gleague"
			fromDate={fromDate}
			activeTab={activeTab}
			onTabChange={handleTabChange}
		/>
	);
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { gameDetailsQueryOptions } from "@/lib/nba/game-details.queries";
import {
	GameDetailsLayout,
	GameDetailsPending,
} from "@/components/game-details/game-details-layout";

interface GameSearchParams {
	fromDate?: string;
	tab?: string;
}

export const Route = createFileRoute("/_default/nba/game/$gameId")({
	validateSearch: (search: Record<string, unknown>): GameSearchParams => {
		return {
			fromDate:
				typeof search.fromDate === "string" ? search.fromDate : undefined,
			tab: typeof search.tab === "string" ? search.tab : undefined,
		};
	},
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			gameDetailsQueryOptions(params.gameId),
		);
	},
	pendingComponent: GameDetailsPending,
	component: NbaGameDetailsPage,
});

function NbaGameDetailsPage() {
	const { gameId } = Route.useParams();
	const { fromDate, tab } = Route.useSearch();
	const navigate = useNavigate();
	const { data: game } = useQuery(gameDetailsQueryOptions(gameId));

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
			to: "/nba/game/$gameId",
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
			league="nba"
			fromDate={fromDate}
			activeTab={activeTab}
			onTabChange={handleTabChange}
		/>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { gameDetailsQueryOptions } from "@/lib/nba/game-details.queries";
import {
	GameDetailsLayout,
	GameDetailsPending,
} from "@/components/game-details-layout";

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
		await context.queryClient.ensureQueryData(
			gameDetailsQueryOptions(params.gameId),
		);
	},
	pendingComponent: GameDetailsPending,
	component: NbaGameDetailsPage,
});

function NbaGameDetailsPage() {
	const { gameId } = Route.useParams();
	const { fromDate } = Route.useSearch();
	const { data: game } = useQuery(gameDetailsQueryOptions(gameId));

	if (!game) {
		return (
			<div className="container py-12">
				<p className="text-center text-muted-foreground">Game not found</p>
			</div>
		);
	}

	return <GameDetailsLayout game={game} league="nba" fromDate={fromDate} />;
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	PlayerDetailsPage,
	PlayerDetailsPending,
	type PlayerSearchParams,
} from "@/components/player-details/player-details-page";

export const Route = createFileRoute("/_default/wnba/player/$id")({
	validateSearch: (search: Record<string, unknown>): PlayerSearchParams => {
		return {
			tab: typeof search.tab === "string" ? search.tab : undefined,
			compare: typeof search.compare === "string" ? search.compare : undefined,
		};
	},
	pendingComponent: PlayerDetailsPending,
	component: WnbaPlayerDetailsPage,
});

function WnbaPlayerDetailsPage() {
	const navigate = useNavigate();
	const { id } = Route.useParams();
	const { tab, compare } = Route.useSearch();

	return (
		<PlayerDetailsPage
			league="wnba"
			playerId={id}
			tab={tab}
			compare={compare}
			onNavigate={({ id: playerId, tab: nextTab, compare: nextCompare }) => {
				navigate({
					to: "/wnba/player/$id",
					params: { id: playerId },
					search: { tab: nextTab, compare: nextCompare },
					replace: true,
				});
			}}
		/>
	);
}

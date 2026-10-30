import { createFileRoute } from "@tanstack/react-router";
import {
	PlayerComparePage,
	validatePlayerCompareSearch,
} from "@/components/player-details/player-pages";

export const Route = createFileRoute("/_default/wnba/player/$id/compare")({
	validateSearch: validatePlayerCompareSearch,
	component: WnbaPlayerComparePage,
});

function WnbaPlayerComparePage() {
	const { compare } = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<PlayerComparePage
			compare={compare}
			onCompareChange={(playerId) =>
				navigate({ search: { compare: playerId || undefined }, replace: true })
			}
		/>
	);
}

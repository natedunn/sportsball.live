import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	PlayersPageLayout,
	type RankingView,
} from "@/components/player-details/players-page-layout";

interface PlayersSearchParams {
	view?: string;
}

export const Route = createFileRoute("/_default/wnba/players")({
	validateSearch: (search: Record<string, unknown>): PlayersSearchParams => {
		return {
			view: typeof search.view === "string" ? search.view : undefined,
		};
	},
	component: WnbaPlayersPage,
});

function WnbaPlayersPage() {
	const navigate = useNavigate();
	const { view: urlView } = Route.useSearch();
	const view = (urlView as RankingView) || "scoring";

	return (
		<PlayersPageLayout
			league="wnba"
			view={view}
			onViewChange={(nextView) => {
				navigate({
					to: "/wnba/players",
					search: { view: nextView },
					replace: true,
				});
			}}
		/>
	);
}

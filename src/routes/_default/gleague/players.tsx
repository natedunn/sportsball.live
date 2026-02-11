import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	PlayersPageLayout,
	type RankingView,
} from "@/components/player-details/players-page-layout";

interface PlayersSearchParams {
	view?: string;
}

export const Route = createFileRoute("/_default/gleague/players")({
	validateSearch: (search: Record<string, unknown>): PlayersSearchParams => {
		return {
			view: typeof search.view === "string" ? search.view : undefined,
		};
	},
	component: GleaguePlayersPage,
});

function GleaguePlayersPage() {
	const navigate = useNavigate();
	const { view: urlView } = Route.useSearch();
	const view = (urlView as RankingView) || "scoring";

	return (
		<PlayersPageLayout
			league="gleague"
			view={view}
			onViewChange={(nextView) => {
				navigate({
					to: "/gleague/players",
					search: { view: nextView },
					replace: true,
				});
			}}
		/>
	);
}

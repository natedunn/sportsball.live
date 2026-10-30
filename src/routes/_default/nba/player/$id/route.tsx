import { createFileRoute, Outlet } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import {
	PlayerDetailsPage,
	PlayerDetailsPending,
	playerDetailsQuery,
} from "@/components/player-details/player-details-page";
import { PLAYER_TABS } from "@/components/player-details/player-details-layout";
import { redirectLegacyTab } from "@/lib/route-tabs";

export const Route = createFileRoute("/_default/nba/player/$id")({
	beforeLoad: ({ location, params }) => {
		redirectLegacyTab({
			search: location.search,
			basePath: "/nba/player/$id",
			params,
			tabs: PLAYER_TABS,
			legacyTabs: { last10: "last-10", comparison: "compare" },
		});
	},
	loader: async ({ context, params }) => {
		// Pre-populate Convex data for SSR
		const season = await context.queryClient.ensureQueryData(
			convexQuery(api.seasons.getCurrentName, { league: "nba" }),
		);
		if (!season) return;
		await context.queryClient.ensureQueryData(
			playerDetailsQuery("nba", season, params.id),
		);
	},
	pendingComponent: PlayerDetailsPending,
	component: NbaPlayerDetailsPage,
});

function NbaPlayerDetailsPage() {
	const { id } = Route.useParams();

	return (
		<PlayerDetailsPage league="nba" playerId={id}>
			<Outlet />
		</PlayerDetailsPage>
	);
}

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import {
	PlayerDetailsPage,
	PlayerDetailsPending,
	playerDetailsQuery,
} from "@/components/player-details/player-details-page";

export const Route = createFileRoute("/_default/gleague/player/$id")({
	loader: async ({ context, params }) => {
		// Pre-populate Convex data for SSR
		const season = await context.queryClient.ensureQueryData(
			convexQuery(api.seasons.getCurrentName, { league: "gleague" }),
		);
		if (!season) return;
		await context.queryClient.ensureQueryData(
			playerDetailsQuery("gleague", season, params.id),
		);
	},
	pendingComponent: PlayerDetailsPending,
	component: GleaguePlayerDetailsPage,
});

function GleaguePlayerDetailsPage() {
	const { id } = Route.useParams();

	return (
		<PlayerDetailsPage league="gleague" playerId={id}>
			<Outlet />
		</PlayerDetailsPage>
	);
}

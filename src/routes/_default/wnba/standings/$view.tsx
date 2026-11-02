import { createFileRoute, notFound } from "@tanstack/react-router";
import { standingsSeo } from "@/lib/seo";
import { isStandingsView, type StandingsView } from "@/lib/standings-view";
import {
	loadStandings,
	StandingsPage,
	StandingsPending,
} from "@/components/standings/standings-page";

export const Route = createFileRoute("/_default/wnba/standings/$view")({
	beforeLoad: ({ params }) => {
		if (!isStandingsView(params.view)) throw notFound();
	},
	loader: ({ context }) => loadStandings(context.queryClient, "wnba"),
	head: ({ params }) => ({
		meta: standingsSeo("wnba", params.view as StandingsView),
	}),
	pendingComponent: () => <StandingsPending league="wnba" />,
	component: Page,
});

function Page() {
	const { view } = Route.useParams();
	return <StandingsPage league="wnba" view={view as StandingsView} />;
}

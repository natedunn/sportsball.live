import { createFileRoute, notFound } from "@tanstack/react-router";
import { standingsSeo } from "@/lib/seo";
import { isStandingsView, type StandingsView } from "@/lib/standings-view";
import {
	loadStandings,
	StandingsPage,
	StandingsPending,
} from "@/components/standings/standings-page";

export const Route = createFileRoute("/_default/gleague/standings/$view")({
	beforeLoad: ({ params }) => {
		if (!isStandingsView(params.view)) throw notFound();
	},
	loader: ({ context }) => loadStandings(context.queryClient, "gleague"),
	head: ({ params }) => ({
		meta: standingsSeo("gleague", params.view as StandingsView),
	}),
	pendingComponent: () => <StandingsPending league="gleague" />,
	component: Page,
});

function Page() {
	const { view } = Route.useParams();
	return <StandingsPage league="gleague" view={view as StandingsView} />;
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	DEFAULT_STANDINGS_VIEW,
	getStoredStandingsView,
} from "@/lib/standings-view";

// The standings page last viewed, in any league
export const Route = createFileRoute("/_default/wnba/standings/")({
	beforeLoad: () => {
		throw redirect({
			to: "/wnba/standings/$view",
			params: { view: getStoredStandingsView() ?? DEFAULT_STANDINGS_VIEW.wnba },
		});
	},
});

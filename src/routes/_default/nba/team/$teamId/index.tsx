import { createFileRoute } from "@tanstack/react-router";
import { TeamOverviewPage } from "@/components/team-details/team-pages";

export const Route = createFileRoute("/_default/nba/team/$teamId/")({
	component: TeamOverviewPage,
});

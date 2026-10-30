import { createFileRoute } from "@tanstack/react-router";
import { TeamTrendsPage } from "@/components/team-details/team-pages";

export const Route = createFileRoute("/_default/gleague/team/$teamId/trends")({
	component: TeamTrendsPage,
});

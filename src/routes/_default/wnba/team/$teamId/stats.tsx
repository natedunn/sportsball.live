import { createFileRoute } from "@tanstack/react-router";
import { TeamStatsPage } from "@/components/team-details/team-pages";

export const Route = createFileRoute("/_default/wnba/team/$teamId/stats")({
	component: TeamStatsPage,
});

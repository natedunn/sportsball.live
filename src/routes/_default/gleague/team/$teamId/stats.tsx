import { createFileRoute } from "@tanstack/react-router";
import { TeamStatsPage } from "@/components/team-details/team-pages";

export const Route = createFileRoute("/_default/gleague/team/$teamId/stats")({
	component: TeamStatsPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { TeamRosterPage } from "@/components/team-details/team-pages";

export const Route = createFileRoute("/_default/nba/team/$teamId/roster")({
	component: TeamRosterPage,
});

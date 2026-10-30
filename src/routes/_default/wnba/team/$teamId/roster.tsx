import { createFileRoute } from "@tanstack/react-router";
import { TeamRosterPage } from "@/components/team-details/team-pages";

export const Route = createFileRoute("/_default/wnba/team/$teamId/roster")({
	component: TeamRosterPage,
});

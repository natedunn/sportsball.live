import { createFileRoute } from "@tanstack/react-router";
import { TeamGamesPage } from "@/components/team-details/team-pages";

export const Route = createFileRoute("/_default/wnba/team/$teamId/games")({
	component: TeamGamesPage,
});

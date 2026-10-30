import { createFileRoute } from "@tanstack/react-router";
import { GameTeamStatsPage } from "@/components/game-details/game-pages";

export const Route = createFileRoute("/_default/gleague/game/$gameId/team-stats")({
	component: GameTeamStatsPage,
});

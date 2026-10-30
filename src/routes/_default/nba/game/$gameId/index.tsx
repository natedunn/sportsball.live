import { createFileRoute } from "@tanstack/react-router";
import { GameBoxScorePage } from "@/components/game-details/game-pages";

export const Route = createFileRoute("/_default/nba/game/$gameId/")({
	component: GameBoxScorePage,
});

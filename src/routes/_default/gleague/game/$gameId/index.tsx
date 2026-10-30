import { createFileRoute } from "@tanstack/react-router";
import { GameBoxScorePage } from "@/components/game-details/game-pages";

export const Route = createFileRoute("/_default/gleague/game/$gameId/")({
	component: GameBoxScorePage,
});

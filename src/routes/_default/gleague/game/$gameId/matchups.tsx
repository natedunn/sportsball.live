import { createFileRoute } from "@tanstack/react-router";
import { GameMatchupsPage } from "@/components/game-details/game-pages";

export const Route = createFileRoute("/_default/gleague/game/$gameId/matchups")({
	component: GameMatchupsPage,
});

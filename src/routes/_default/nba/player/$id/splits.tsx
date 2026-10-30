import { createFileRoute } from "@tanstack/react-router";
import { PlayerSplitsPage } from "@/components/player-details/player-pages";

export const Route = createFileRoute("/_default/nba/player/$id/splits")({
	component: PlayerSplitsPage,
});

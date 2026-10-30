import { createFileRoute } from "@tanstack/react-router";
import { PlayerOverviewPage } from "@/components/player-details/player-pages";

export const Route = createFileRoute("/_default/nba/player/$id/")({
	component: PlayerOverviewPage,
});

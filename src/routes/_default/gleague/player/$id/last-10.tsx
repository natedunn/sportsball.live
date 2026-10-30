import { createFileRoute } from "@tanstack/react-router";
import { PlayerLast10Page } from "@/components/player-details/player-pages";

export const Route = createFileRoute("/_default/gleague/player/$id/last-10")({
	component: PlayerLast10Page,
});

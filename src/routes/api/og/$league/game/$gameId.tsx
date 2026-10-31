import { createFileRoute } from "@tanstack/react-router";
import { GameCard } from "@/lib/og/og-cards";
import { getGameCardData, isLeague } from "@/lib/og/og-data.server";
import { ogImageResponse } from "@/lib/og/og-response.server";

// The card has no score, so only a rescheduled tip-off changes it
const ONE_HOUR = 60 * 60;

export const Route = createFileRoute("/api/og/$league/game/$gameId")({
	server: {
		handlers: {
			GET: async ({ request, params }) =>
				ogImageResponse(request, ONE_HOUR, async () => {
					if (!isLeague(params.league)) return null;
					const data = await getGameCardData(params.league, params.gameId);
					return data && <GameCard data={data} />;
				}),
		},
	},
});

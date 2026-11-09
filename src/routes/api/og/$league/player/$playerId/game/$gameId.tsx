import { createFileRoute } from "@tanstack/react-router";
import { PerformanceCard } from "@/lib/og/og-cards";
import { getPerformanceCardData, isLeague } from "@/lib/og/og-data.server";
import { ogImageResponse } from "@/lib/og/og-response.server";

// Only finished games are in the game log, so the line rarely changes; a day
// still picks up ESPN's occasional stat corrections
const ONE_DAY = 60 * 60 * 24;

export const Route = createFileRoute("/api/og/$league/player/$playerId/game/$gameId")({
	server: {
		handlers: {
			GET: async ({ request, params }) =>
				ogImageResponse(request, ONE_DAY, async () => {
					if (!isLeague(params.league)) return null;
					if (!/^\d+$/.test(params.playerId) || !/^\d+$/.test(params.gameId)) return null;
					const data = await getPerformanceCardData(params.league, params.playerId, params.gameId);
					return data && <PerformanceCard data={data} />;
				}),
		},
	},
});

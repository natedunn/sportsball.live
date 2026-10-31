import { createFileRoute } from "@tanstack/react-router";
import { TeamCard } from "@/lib/og/og-cards";
import { getTeamCardData, isLeague } from "@/lib/og/og-data.server";
import { ogImageResponse } from "@/lib/og/og-response.server";

// Only the season changes, so a day is plenty
const ONE_DAY = 24 * 60 * 60;

export const Route = createFileRoute("/api/og/$league/team/$teamId")({
	server: {
		handlers: {
			GET: async ({ request, params }) =>
				ogImageResponse(request, ONE_DAY, async () => {
					if (!isLeague(params.league)) return null;
					const data = await getTeamCardData(params.league, params.teamId);
					return data && <TeamCard data={data} />;
				}),
		},
	},
});

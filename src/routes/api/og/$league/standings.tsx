import { createFileRoute } from "@tanstack/react-router";
import { StandingsCard } from "@/lib/og/og-cards";
import {
	getStandingsCardData,
	isLeague,
	parseConference,
} from "@/lib/og/og-data.server";
import { ogImageResponse } from "@/lib/og/og-response.server";

// Only the season changes, so a day is plenty
const ONE_DAY = 24 * 60 * 60;

export const Route = createFileRoute("/api/og/$league/standings")({
	server: {
		handlers: {
			GET: async ({ request, params }) =>
				ogImageResponse(request, ONE_DAY, async () => {
					if (!isLeague(params.league)) return null;
					const conference = parseConference(
						new URL(request.url).searchParams.get("conference"),
					);
					const data = await getStandingsCardData(params.league, conference);
					return data && <StandingsCard data={data} />;
				}),
		},
	},
});

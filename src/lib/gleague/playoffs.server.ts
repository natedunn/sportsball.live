import { createServerFn } from "@tanstack/react-start";
import { parsePlayoffSeeds, type PlayoffSeed } from "./playoff-seeds";

/**
 * A season's playoff seeds ("2025-26") from the G League stats API, or an
 * empty list when it can't be reached. Read from the Worker, like the G League
 * leaders.
 */
export const fetchGLeaguePlayoffSeeds = createServerFn({ method: "GET" })
	.inputValidator((season: string) => season)
	.handler(async ({ data: season }): Promise<PlayoffSeed[]> => {
		const baseUrl = process.env.GLEAGUE_STATS_API;
		if (!baseUrl) {
			console.error("[G League] GLEAGUE_STATS_API not configured");
			return [];
		}
		try {
			const response = await fetch(
				`${baseUrl}/leaguestandingsv3?LeagueID=20&Season=${encodeURIComponent(season)}&SeasonType=Regular%20Season`,
				{ headers: { "User-Agent": "Mozilla/5.0", Referer: baseUrl } },
			);
			if (!response.ok) {
				console.error(`[G League] Playoff seeds: stats API answered ${response.status}`);
				return [];
			}
			return parsePlayoffSeeds(await response.json());
		} catch (error) {
			console.error("[G League] Playoff seeds fetch failed", error);
			return [];
		}
	});

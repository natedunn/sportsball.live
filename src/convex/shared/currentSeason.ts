// The current season and its dates for league actions, from the seasons table
// (synced daily from ESPN). Nothing here guesses from the calendar.
import { api, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

type League = "nba" | "wnba" | "gleague";

type SeasonEvent = "seasonStart" | "seasonEnd" | "latestScheduledEnd";

/**
 * The league's current season. A deployment whose seasons table and games
 * know nothing yet syncs ESPN's season calendar first.
 */
export async function requireCurrentSeason(ctx: ActionCtx, league: League): Promise<string> {
	const season: string | null = await ctx.runQuery(api.seasons.getCurrentName, { league });
	if (season) return season;

	await ctx.runAction(internal.seasonSync.syncLeagueNow, { league });
	const synced: string | null = await ctx.runQuery(api.seasons.getCurrentName, { league });
	if (!synced) {
		throw new Error(`No current ${league} season: ESPN's season calendar couldn't be loaded`);
	}
	return synced;
}

/** A date (YYYYMMDD) from the league's season calendar, or null when it isn't known. */
export async function getSeasonDate(
	ctx: ActionCtx,
	league: League,
	eventType: SeasonEvent,
): Promise<string | null> {
	const date: string | null = await ctx.runQuery(api.seasons.getCurrentEventDate, {
		league,
		eventType,
	});
	return date ? date.replaceAll("-", "") : null;
}

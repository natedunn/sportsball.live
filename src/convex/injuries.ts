// Injury reports from ESPN's league-wide injuries endpoint, one request per
// league. Refreshed twice a day (crons.ts), and on game days before each
// tip-off, when people check who's playing (scheduled by each league's game
// discovery through scheduleGameDayRefreshes).
//
// Run by hand: npx convex run injuries:refreshAll
import { v } from "convex/values";
import {
	internalAction,
	internalMutation,
	query,
	type ActionCtx,
	type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { leagueValidator } from "./validators";
import { updateInjuryLog } from "./injuryHistory";
import {
	injuryRefreshTimes,
	parseInjuryReport,
	type ApiInjuriesResponse,
	type ParsedInjury,
} from "./shared/injuries";

type League = "nba" | "wnba" | "gleague";

const LEAGUES: League[] = ["nba", "wnba", "gleague"];
const ENV_PREFIX: Record<League, string> = { nba: "NBA", wnba: "WNBA", gleague: "GLEAGUE" };
const JOB = "refreshInjuries";

const injuryValidator = v.object({
	espnTeamId: v.string(),
	espnInjuryId: v.string(),
	espnPlayerId: v.optional(v.string()),
	name: v.string(),
	position: v.optional(v.string()),
	headshot: v.optional(v.string()),
	status: v.string(),
	description: v.optional(v.string()),
	shortComment: v.optional(v.string()),
	returnDate: v.optional(v.string()),
	reportedAt: v.optional(v.string()),
});

async function refresh(ctx: ActionCtx, league: League): Promise<boolean> {
	try {
		const siteApi = process.env[`${ENV_PREFIX[league]}_SITE_API`];
		if (!siteApi) throw new Error(`${ENV_PREFIX[league]}_SITE_API not configured`);
		const response = await fetch(`${siteApi}/injuries`, { headers: { "Content-Type": "application/json" } });
		if (!response.ok) throw new Error(`injuries fetch failed (${response.status})`);
		const injuries = parseInjuryReport((await response.json()) as ApiInjuriesResponse);
		if (!injuries) throw new Error("ESPN's injury report was not usable");

		const changed = await ctx.runMutation(internal.injuries.replaceLeague, { league, injuries });
		await ctx.runMutation(internal.health.recordJobRun, {
			job: JOB,
			league,
			ok: true,
			summary: `${injuries.length} players, ${changed} changed`,
		});
		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[Injuries] ${league} refresh failed: ${message}`);
		await ctx.runMutation(internal.health.recordJobRun, { job: JOB, league, ok: false, summary: message });
		return false;
	}
}

export const refreshLeague = internalAction({
	args: { league: leagueValidator },
	handler: async (ctx, { league }) => {
		await refresh(ctx, league);
	},
});

export const refreshAll = internalAction({
	args: {},
	handler: async (ctx) => {
		for (const league of LEAGUES) await refresh(ctx, league);
	},
});

/**
 * Schedule the pre-game refreshes for today's tip-offs (called from each
 * league's game discovery).
 */
export async function scheduleGameDayRefreshes(ctx: ActionCtx, league: League, tipOffs: number[]) {
	const times = injuryRefreshTimes(tipOffs, Date.now());
	for (const time of times) {
		await ctx.scheduler.runAt(time, internal.injuries.refreshLeague, { league });
	}
	if (times.length > 0) {
		console.log(
			`[Injuries] ${league}: ${times.length} pre-game refreshes, ${times.map((time) => new Date(time).toISOString()).join(", ")}`,
		);
	}
}

// Replace the league's report, writing only rows that changed so open team
// pages don't re-render on every refresh. Returns how many rows changed.
export const replaceLeague = internalMutation({
	args: { league: leagueValidator, injuries: v.array(injuryValidator) },
	handler: async (ctx, { league, injuries }) => {
		const existing = await ctx.db
			.query("injuries")
			.withIndex("by_league", (q) => q.eq("league", league))
			.collect();
		const existingById = new Map(existing.map((row) => [row.espnInjuryId, row]));
		const incomingIds = new Set(injuries.map((injury) => injury.espnInjuryId));
		let changed = 0;

		for (const row of existing) {
			if (!incomingIds.has(row.espnInjuryId)) {
				await ctx.db.delete(row._id);
				changed++;
			}
		}
		for (const injury of injuries) {
			const row = { league, ...injury };
			const current = existingById.get(injury.espnInjuryId);
			if (!current) {
				await ctx.db.insert("injuries", row);
				changed++;
			} else if (!sameInjury(current, injury)) {
				await ctx.db.replace(current._id, row);
				changed++;
			}
		}
		await updateInjuryLog(ctx, league, injuries);
		return changed;
	},
});

function sameInjury(row: ParsedInjury, injury: ParsedInjury): boolean {
	return (Object.keys(injuryValidator.fields) as Array<keyof ParsedInjury>).every(
		(field) => row[field] === injury[field],
	);
}

async function lastRefreshedAt(ctx: QueryCtx, league: League) {
	const run = await ctx.db
		.query("jobRuns")
		.withIndex("by_job_league", (q) => q.eq("job", JOB).eq("league", league))
		.unique();
	return run?.lastOkAt ?? null;
}

/**
 * A player's current injury (null if they aren't on the report), and when the
 * league's report was last refreshed, so a page can tell "healthy" from "we
 * don't know".
 */
export async function loadPlayerInjuryReport(ctx: QueryCtx, league: League, espnPlayerId: string) {
	const [injury, updatedAt] = await Promise.all([
		ctx.db
			.query("injuries")
			.withIndex("by_league_player", (q) => q.eq("league", league).eq("espnPlayerId", espnPlayerId))
			.order("desc")
			.first(),
		lastRefreshedAt(ctx, league),
	]);
	return {
		updatedAt,
		injury: injury && {
			status: injury.status,
			description: injury.description,
			shortComment: injury.shortComment,
		},
	};
}

/**
 * A team's injured players, and when the league's report was last refreshed
 * (null if it never has been), so the page can tell an empty report from a
 * missing one.
 */
export const getTeamInjuries = query({
	args: { league: leagueValidator, espnTeamId: v.string() },
	handler: async (ctx, { league, espnTeamId }) => {
		const [rows, updatedAt] = await Promise.all([
			ctx.db
				.query("injuries")
				.withIndex("by_league_team", (q) => q.eq("league", league).eq("espnTeamId", espnTeamId))
				.collect(),
			lastRefreshedAt(ctx, league),
		]);
		return {
			updatedAt,
			players: rows.map(({ _id, _creationTime, league: _league, ...injury }) => injury),
		};
	},
});

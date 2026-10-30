// Season phases (preseason, regular season, play-in, playoffs...) from ESPN,
// stored in the seasons table. Runs daily; admins can also refresh by hand.
import { v } from "convex/values";
import {
	action,
	internalAction,
	internalMutation,
	query,
	type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { leagueValidator } from "./validators";
import { buildSeasonPhases, type EspnSeasonType } from "./shared/espnSeasons";

type League = "nba" | "wnba" | "gleague";

const LEAGUES: League[] = ["nba", "wnba", "gleague"];
const ENV_PREFIX: Record<League, string> = { nba: "NBA", wnba: "WNBA", gleague: "GLEAGUE" };
// ESPN season types worth storing; 4 is the offseason
const ESPN_PHASE_TYPES = [1, 2, 3, 5];
// The cron runs daily; past this the admin pages warn that the sync is behind
const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

const phaseValidator = v.object({
	league: leagueValidator,
	startYear: v.number(),
	endYear: v.number(),
	name: v.string(),
	type: v.union(
		v.literal("tournament"),
		v.literal("pre-season"),
		v.literal("regular-season"),
		v.literal("play-in"),
		v.literal("playoffs"),
	),
	startDate: v.string(),
	endDate: v.string(),
	status: v.union(v.literal("confirmed"), v.literal("estimated")),
});

type SyncResult = {
	league: League;
	ok: boolean;
	error?: string;
	inserted: number;
	updated: number;
	skippedManual: number;
};

function getEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} not configured`);
	return value;
}

/** JSON from ESPN, or null when ESPN has nothing there (404). */
async function fetchEspn<T>(url: string): Promise<T | null> {
	const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`ESPN request failed (${res.status}): ${url}`);
	return (await res.json()) as T;
}

type EspnScoreboard = {
	leagues?: Array<{ season?: { year?: number }; calendar?: unknown[] }>;
};

async function syncLeague(ctx: ActionCtx, league: League): Promise<SyncResult> {
	try {
		const siteApi = getEnv(`${ENV_PREFIX[league]}_SITE_API`);
		const coreApi = getEnv(`${ENV_PREFIX[league]}_CORE_API`);

		// ESPN's current season year rolls over when its next season begins
		const current = await fetchEspn<EspnScoreboard>(`${siteApi}/scoreboard?limit=1`);
		const year = current?.leagues?.[0]?.season?.year;
		if (!year) throw new Error("ESPN scoreboard has no current season");

		// This season and the next one, once ESPN publishes it
		const phases = [];
		for (const espnYear of [year, year + 1]) {
			const types = (
				await Promise.all(
					ESPN_PHASE_TYPES.map((type) =>
						fetchEspn<EspnSeasonType>(`${coreApi}/seasons/${espnYear}/types/${type}`),
					),
				)
			).filter((type): type is EspnSeasonType => type !== null);
			if (types.length === 0) continue;

			const calendar = await fetchEspn<EspnScoreboard>(
				`${siteApi}/scoreboard?dates=${espnYear}&limit=1`,
			);
			const gameDays = (calendar?.leagues?.[0]?.calendar ?? []).filter(
				(day): day is string => typeof day === "string",
			);
			phases.push(...buildSeasonPhases(league, espnYear, types, gameDays));
		}
		if (phases.length === 0) throw new Error(`ESPN has no season phases for ${year}`);

		const counts = await ctx.runMutation(internal.seasonSync.applyEspnPhases, { league, phases });
		await ctx.runMutation(internal.seasonSync.recordSync, { league });
		console.log(
			`[Seasons] ${league}: ${counts.inserted} added, ${counts.updated} updated, ${counts.skippedManual} kept as manual overrides`,
		);
		return { league, ok: true, ...counts };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[Seasons] ${league} sync failed: ${message}`);
		await ctx.runMutation(internal.seasonSync.recordSync, { league, error: message });
		return { league, ok: false, error: message, inserted: 0, updated: 0, skippedManual: 0 };
	}
}

// Daily cron, before the schedule syncs read the season's dates
export const syncAll = internalAction({
	args: {},
	handler: async (ctx) => {
		for (const league of LEAGUES) {
			await syncLeague(ctx, league);
		}
	},
});

// Admin "Refresh now"
export const refreshNow = action({
	args: { league: v.optional(leagueValidator) },
	handler: async (ctx, args): Promise<SyncResult[]> => {
		const isAdmin = await ctx.runQuery(internal.admin.internalCheckIsAdmin, {});
		if (!isAdmin) throw new Error("Not authorized");

		const results: SyncResult[] = [];
		for (const league of args.league ? [args.league] : LEAGUES) {
			results.push(await syncLeague(ctx, league));
		}
		return results;
	},
});

// Store ESPN's phases, leaving rows an admin has overridden alone
export const applyEspnPhases = internalMutation({
	args: { league: leagueValidator, phases: v.array(phaseValidator) },
	handler: async (ctx, args) => {
		const counts = { inserted: 0, updated: 0, skippedManual: 0 };
		const now = Date.now();

		for (const phase of args.phases) {
			const existing = await ctx.db
				.query("seasons")
				.withIndex("by_league_years_type", (q) =>
					q
						.eq("league", args.league)
						.eq("startYear", phase.startYear)
						.eq("endYear", phase.endYear)
						.eq("type", phase.type),
				)
				.first();

			if (!existing) {
				await ctx.db.insert("seasons", { ...phase, source: "espn", updatedAt: now });
				counts.inserted += 1;
				continue;
			}
			if (existing.source === "manual") {
				counts.skippedManual += 1;
				continue;
			}
			const unchanged =
				existing.source === "espn" &&
				existing.name === phase.name &&
				existing.startDate === phase.startDate &&
				existing.endDate === phase.endDate &&
				existing.status === phase.status;
			if (unchanged) continue;

			await ctx.db.patch(existing._id, { ...phase, source: "espn", updatedAt: now });
			counts.updated += 1;
		}

		return counts;
	},
});

export const recordSync = internalMutation({
	args: { league: leagueValidator, error: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const now = Date.now();
		const existing = await ctx.db
			.query("seasonSync")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.unique();
		const update = args.error
			? { lastAttemptAt: now, lastError: args.error }
			: { lastAttemptAt: now, lastSuccessAt: now, lastError: undefined };

		if (existing) {
			await ctx.db.patch(existing._id, update);
		} else {
			await ctx.db.insert("seasonSync", { league: args.league, ...update });
		}
	},
});

/** When each league's season phases were last fetched from ESPN. */
export const getStatus = query({
	args: {},
	handler: async (ctx) => {
		const rows = await ctx.db.query("seasonSync").collect();
		return {
			staleAfterMs: STALE_AFTER_MS,
			leagues: LEAGUES.map((league) => {
				const row = rows.find((r) => r.league === league);
				return {
					league,
					lastAttemptAt: row?.lastAttemptAt ?? null,
					lastSuccessAt: row?.lastSuccessAt ?? null,
					lastError: row?.lastError ?? null,
				};
			}),
		};
	},
});

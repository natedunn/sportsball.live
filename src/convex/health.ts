// Daily data health check. Compares what we store against ESPN, repairs what it
// can through the same functions the app uses, and saves the results. The
// "Data health" GitHub Action reads getLatest and opens (or closes) an issue,
// so problems the check couldn't fix, or a check that stopped running, reach a
// person without anyone watching the app.
//
// Checks, for each league whose current season is running:
// - games: every game ESPN has as final is stored as final with box scores
// - box scores: the last few days' team box scores match ESPN's
// - team averages: recalculating every team changes nothing (a change means a
//   recalculation was missed; the recalculation is the repair)
// - standings: W-L records match ESPN's standings
// and for every league:
// - rosters: team rosters match ESPN's (for the season the roster sync targets)
// - jobs: every daily job succeeded in the last 2 days
//
// Run by hand: npx convex run health:runHealthCheck

import { v } from "convex/values";
import type { FunctionReference } from "convex/server";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getCurrentProfile } from "./auth";
import { internal } from "./_generated/api";
import { getSeasonDate, requireCurrentSeason } from "./shared/currentSeason";
import {
	formatGameDate,
	getNextSeason,
	getSeasonEndYear,
	getTodayDate,
	seasonFromEspnYear,
} from "./shared/seasonHelpers";
import {
	parseTeamBoxScore,
	type ApiGameSummaryResponse,
	type ApiSiteRosterResponse,
	type ApiStandingsResponse,
	type ApiTeamScheduleResponse,
} from "./shared/apiParser";
import {
	diffBoxScore,
	diffRoster,
	findStaleJobs,
	resultFor,
	type ExpectedJob,
	type HealthResult,
	type League,
	type TeamBoxLine,
} from "./shared/healthChecks";
import { healthResultValidator, leagueValidator } from "./validators";

const LEAGUES: League[] = ["nba", "wnba", "gleague"];
const DAY_MS = 24 * 60 * 60 * 1000;
// A job only alerts after two days without a successful run, so one bad night
// (an ESPN outage, say) fixes itself without anyone hearing about it
const JOB_MAX_AGE_MS = 50 * 60 * 60 * 1000;
const RECENT_GAME_DAYS = 3;
const MAX_GAME_REPAIRS = 30;
const FETCH_CONCURRENCY = 6;
const HEALTH_CHECKS_KEPT = 60;

// Daily jobs per league (see crons.ts), plus the cross-league season sync
const EXPECTED_JOBS: ExpectedJob[] = [
	...LEAGUES.flatMap((league) =>
		["discoverGames", "refreshStandings", "syncSchedule", "refreshPlayers"].map((job) => ({
			job,
			league,
		})),
	),
	{ job: "syncSeasons" },
];

const ENV_PREFIX: Record<League, string> = { nba: "NBA", wnba: "WNBA", gleague: "GLEAGUE" };

// Each league's functions the checks read through and repair with
type Ref<T extends "query" | "mutation" | "action"> = FunctionReference<T, "internal">;
const LEAGUE_FUNCTIONS: Record<
	League,
	{
		getHealthSnapshot: Ref<"query">;
		recalculateTeamAverages: Ref<"mutation">;
		updateLeagueRankings: Ref<"mutation">;
		syncLiveGameData: Ref<"action">;
		refreshStandings: Ref<"action">;
		syncRosters: Ref<"action">;
	}
> = {
	nba: {
		getHealthSnapshot: internal.nba.queries.getHealthSnapshot,
		recalculateTeamAverages: internal.nba.mutations.recalculateTeamAverages,
		updateLeagueRankings: internal.nba.mutations.updateLeagueRankings,
		syncLiveGameData: internal.nba.actions.syncLiveGameData,
		refreshStandings: internal.nba.actions.refreshStandings,
		syncRosters: internal.nba.actions.syncRosters,
	},
	wnba: {
		getHealthSnapshot: internal.wnba.queries.getHealthSnapshot,
		recalculateTeamAverages: internal.wnba.mutations.recalculateTeamAverages,
		updateLeagueRankings: internal.wnba.mutations.updateLeagueRankings,
		syncLiveGameData: internal.wnba.actions.syncLiveGameData,
		refreshStandings: internal.wnba.actions.refreshStandings,
		syncRosters: internal.wnba.actions.syncRosters,
	},
	gleague: {
		getHealthSnapshot: internal.gleague.queries.getHealthSnapshot,
		recalculateTeamAverages: internal.gleague.mutations.recalculateTeamAverages,
		updateLeagueRankings: internal.gleague.mutations.updateLeagueRankings,
		syncLiveGameData: internal.gleague.actions.syncLiveGameData,
		refreshStandings: internal.gleague.actions.refreshStandings,
		syncRosters: internal.gleague.actions.syncRosters,
	},
};

type Snapshot = {
	teams: Array<{ id: string; espnTeamId: string; abbreviation: string; wins?: number; losses?: number }>;
	games: Array<{ id: string; espnGameId: string; eventStatus: string; seasonType?: number; gameDate: string }>;
	teamEvents: Array<TeamBoxLine & { gameId: string; teamId: string }>;
	rosters: Array<{ espnPlayerId: string; teamId: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = any;

function getSiteApi(league: League): string {
	const url = process.env[`${ENV_PREFIX[league]}_SITE_API`];
	if (!url) throw new Error(`${ENV_PREFIX[league]}_SITE_API not configured`);
	return url;
}

async function fetchJson<T>(url: string): Promise<T | null> {
	try {
		const response = await fetch(url, { headers: { "Content-Type": "application/json" } });
		if (!response.ok) return null;
		return (await response.json()) as T;
	} catch {
		return null;
	}
}

async function mapConcurrent<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(FETCH_CONCURRENCY, items.length) }, async () => {
			while (next < items.length) {
				const index = next++;
				results[index] = await fn(items[index]);
			}
		}),
	);
	return results;
}

// Placeholder teams (TBD) and exhibition opponents have no usable ESPN data
const realTeams = (snapshot: Snapshot) => snapshot.teams.filter((team) => /^\d+$/.test(team.espnTeamId));

async function getSnapshot(ctx: Ctx, league: League, season: string): Promise<Snapshot> {
	return await ctx.runQuery(LEAGUE_FUNCTIONS[league].getHealthSnapshot, { season });
}

// ---------- games ----------

// Every game ESPN has as final (any season type but preseason) is stored as
// final with both teams' box scores. Repair: sync the game.
async function checkGames(ctx: Ctx, league: League, season: string, snapshot: Snapshot) {
	const site = getSiteApi(league);
	const espnYear = getSeasonEndYear(season);
	const schedules = await mapConcurrent(
		realTeams(snapshot).flatMap((team) => [2, 3, 5].map((type) => ({ team, type }))),
		({ team, type }) =>
			fetchJson<ApiTeamScheduleResponse>(
				`${site}/teams/${team.espnTeamId}/schedule?seasontype=${type}&season=${espnYear}`,
			),
	);
	const espnFinals = new Set<string>();
	for (const schedule of schedules) {
		for (const event of schedule?.events ?? []) {
			if (event.competitions?.[0]?.status?.type?.completed) espnFinals.add(event.id);
		}
	}

	const findMissing = (snap: Snapshot) => {
		const eventCounts = new Map<string, number>();
		for (const event of snap.teamEvents) {
			eventCounts.set(event.gameId, (eventCounts.get(event.gameId) ?? 0) + 1);
		}
		const stored = new Map(snap.games.map((game) => [game.espnGameId, game]));
		return [...espnFinals].filter((espnGameId) => {
			const game = stored.get(espnGameId);
			return !game || game.eventStatus !== "completed" || (eventCounts.get(game.id) ?? 0) < 2;
		});
	};

	const missing = findMissing(snapshot);
	for (const espnGameId of missing.slice(0, MAX_GAME_REPAIRS)) {
		await ctx.runAction(LEAGUE_FUNCTIONS[league].syncLiveGameData, { espnGameId });
	}
	const stillMissing = missing.length > 0 ? findMissing(await getSnapshot(ctx, league, season)) : [];

	return resultFor(league, "games", missing.map((id) => `game ${id}`), stillMissing.map((id) => `game ${id}`), {
		ok: `All ${espnFinals.size} final games stored`,
		repaired: `Synced ${missing.length} final games that were missing or unfinished`,
		failing: `${stillMissing.length} final games still missing or unfinished after syncing`,
	});
}

// ---------- recent box scores ----------

// The last few days' team box scores match ESPN's (ESPN revises them after the
// final). Repair: re-sync the game, which recalculates both teams.
async function checkRecentBoxScores(ctx: Ctx, league: League, season: string, snapshot: Snapshot) {
	const site = getSiteApi(league);
	const since = formatGameDate(Date.now() - RECENT_GAME_DAYS * DAY_MS);
	const today = getTodayDate();
	const recent = snapshot.games.filter(
		(game) => game.eventStatus === "completed" && game.gameDate >= since && game.gameDate <= today,
	);
	const teamIdByEspnId = new Map(snapshot.teams.map((team) => [team.espnTeamId, team.id]));

	const espnBoxes = await mapConcurrent(recent, async (game) => {
		const summary = await fetchJson<ApiGameSummaryResponse>(`${site}/summary?event=${game.espnGameId}`);
		const competitors = summary?.header?.competitions?.[0]?.competitors ?? [];
		const lines: Array<{ teamId: string; line: TeamBoxLine }> = [];
		for (const boxTeam of summary?.boxscore?.teams ?? []) {
			const teamId = teamIdByEspnId.get(boxTeam.team.id);
			const score = Number.parseInt(competitors.find((c) => c.team.id === boxTeam.team.id)?.score ?? "", 10);
			if (!teamId || !Number.isFinite(score)) continue;
			const parsed = parseTeamBoxScore(boxTeam.statistics);
			lines.push({ teamId, line: { ...parsed, score } });
		}
		return { game, lines };
	});

	const findDiffs = (snap: Snapshot) => {
		const diffs: string[] = [];
		for (const { game, lines } of espnBoxes) {
			for (const { teamId, line } of lines) {
				const ours = snap.teamEvents.find((event) => event.gameId === game.id && event.teamId === teamId);
				const abbreviation = snap.teams.find((team) => team.id === teamId)?.abbreviation ?? teamId;
				if (!ours) {
					diffs.push(`${game.espnGameId} ${abbreviation}: no box score stored`);
					continue;
				}
				const changed = diffBoxScore(ours, line);
				if (changed.length > 0) diffs.push(`${game.espnGameId} ${abbreviation}: ${changed.join(", ")}`);
			}
		}
		return diffs;
	};

	const diffs = findDiffs(snapshot);
	const gamesToSync = new Set(diffs.map((diff) => diff.split(" ")[0]));
	for (const espnGameId of [...gamesToSync].slice(0, MAX_GAME_REPAIRS)) {
		await ctx.runAction(LEAGUE_FUNCTIONS[league].syncLiveGameData, { espnGameId });
	}
	const stillDiff = diffs.length > 0 ? findDiffs(await getSnapshot(ctx, league, season)) : [];

	return resultFor(league, "box scores", diffs, stillDiff, {
		ok: `${recent.length} games from the last ${RECENT_GAME_DAYS} days match ESPN`,
		repaired: `Re-synced ${gamesToSync.size} games ESPN had revised`,
		failing: `${stillDiff.length} team box scores still differ from ESPN after re-syncing`,
	});
}

// ---------- team averages ----------

// Recalculating every team from its box scores should change nothing; a change
// means a recalculation was missed. The recalculation itself is the repair.
async function checkTeamAverages(ctx: Ctx, league: League, season: string, snapshot: Snapshot) {
	const changed: string[] = [];
	for (const team of snapshot.teams) {
		const didChange: boolean = await ctx.runMutation(LEAGUE_FUNCTIONS[league].recalculateTeamAverages, {
			teamId: team.id,
		});
		if (didChange) changed.push(team.abbreviation);
	}
	await ctx.runMutation(LEAGUE_FUNCTIONS[league].updateLeagueRankings, { season });

	return resultFor(league, "team averages", changed, [], {
		ok: `All ${snapshot.teams.length} teams' averages were current`,
		repaired: `Recalculated ${changed.length} teams whose averages were stale`,
		failing: "",
	});
}

// ---------- standings ----------

// W-L records match ESPN's standings. Repair: refresh standings.
async function checkStandings(ctx: Ctx, league: League, season: string, snapshot: Snapshot) {
	const site = getSiteApi(league);
	const standings = await fetchJson<ApiStandingsResponse>(`${site.replace("/site/v2/", "/v2/")}/standings`);
	const espnYear = standings?.season?.year;
	if (!standings || espnYear === undefined || seasonFromEspnYear(league, espnYear) !== season) {
		return {
			league,
			check: "standings",
			status: "skipped" as const,
			message: "ESPN's standings aren't available for this season",
		};
	}

	const espnRecords = new Map<string, { wins: number; losses: number }>();
	for (const child of standings.children ?? []) {
		for (const entry of child.standings?.entries ?? []) {
			const stat = (name: string) => entry.stats.find((s) => s.name === name)?.value ?? 0;
			espnRecords.set(entry.team.id, { wins: stat("wins"), losses: stat("losses") });
		}
	}

	const findDiffs = (snap: Snapshot) =>
		realTeams(snap).flatMap((team) => {
			const espn = espnRecords.get(team.espnTeamId);
			if (!espn || (espn.wins === team.wins && espn.losses === team.losses)) return [];
			return [`${team.abbreviation}: ${team.wins ?? "?"}-${team.losses ?? "?"} vs ESPN ${espn.wins}-${espn.losses}`];
		});

	const diffs = findDiffs(snapshot);
	if (diffs.length > 0) await ctx.runAction(LEAGUE_FUNCTIONS[league].refreshStandings, {});
	const stillDiff = diffs.length > 0 ? findDiffs(await getSnapshot(ctx, league, season)) : [];

	return resultFor(league, "standings", diffs, stillDiff, {
		ok: `All ${espnRecords.size} records match ESPN`,
		repaired: `Refreshed standings for ${diffs.length} teams`,
		failing: `${stillDiff.length} records still differ from ESPN after refreshing`,
	});
}

// ---------- rosters ----------

// Team rosters match ESPN's, for the season the roster sync targets (the next
// one once the current season has ended). Repair: run the roster sync.
async function checkRosters(ctx: Ctx, league: League, currentSeason: string, seasonEnd: string | null) {
	const season =
		seasonEnd !== null && getTodayDate() > seasonEnd ? getNextSeason(league, currentSeason) : currentSeason;
	const snapshot = await getSnapshot(ctx, league, season);
	const site = getSiteApi(league);

	const espnRosters = (
		await mapConcurrent(realTeams(snapshot), async (team) => {
			const roster = await fetchJson<ApiSiteRosterResponse>(`${site}/teams/${team.espnTeamId}/roster`);
			const year = roster?.season?.year;
			const ids = (roster?.athletes ?? []).map((athlete) => athlete.id);
			// Same rules as the roster sync: skip empty or other-season rosters
			if (ids.length === 0 || year === undefined || seasonFromEspnYear(league, year) !== season) return null;
			return { team, ids };
		})
	).filter((roster) => roster !== null);

	if (espnRosters.length === 0) {
		return {
			league,
			check: "rosters",
			status: "skipped" as const,
			message: `ESPN has no ${season} rosters yet`,
		};
	}

	const findDiffs = (snap: Snapshot) =>
		espnRosters.flatMap(({ team, ids }) => {
			const ours = snap.rosters.filter((p) => p.teamId === team.id).map((p) => p.espnPlayerId);
			const { missing, extra } = diffRoster(ours, ids);
			if (missing.length === 0 && extra.length === 0) return [];
			return [`${team.abbreviation}: ${missing.length} missing, ${extra.length} no longer on the team`];
		});

	const diffs = findDiffs(snapshot);
	if (diffs.length > 0) await ctx.runAction(LEAGUE_FUNCTIONS[league].syncRosters, {});
	const stillDiff = diffs.length > 0 ? findDiffs(await getSnapshot(ctx, league, season)) : [];

	return resultFor(league, "rosters", diffs, stillDiff, {
		ok: `${espnRosters.length} ${season} rosters match ESPN`,
		repaired: `Synced ${diffs.length} rosters that differed from ESPN`,
		failing: `${stillDiff.length} rosters still differ from ESPN after syncing`,
	});
}

// ---------- per league ----------

async function checkLeague(ctx: Ctx, league: League): Promise<HealthResult[]> {
	const season = await requireCurrentSeason(ctx, league);
	const [seasonStart, seasonEnd] = await Promise.all([
		getSeasonDate(ctx, league, "seasonStart"),
		getSeasonDate(ctx, league, "seasonEnd"),
	]);
	const today = getTodayDate();
	const running = (seasonStart === null || today >= seasonStart) && (seasonEnd === null || today <= seasonEnd);

	const results: HealthResult[] = [];
	if (running) {
		const snapshot = await getSnapshot(ctx, league, season);
		results.push(await checkGames(ctx, league, season, snapshot));
		results.push(await checkRecentBoxScores(ctx, league, season, await getSnapshot(ctx, league, season)));
		results.push(await checkTeamAverages(ctx, league, season, await getSnapshot(ctx, league, season)));
		results.push(await checkStandings(ctx, league, season, await getSnapshot(ctx, league, season)));
	} else {
		results.push({
			league,
			check: "games",
			status: "skipped",
			message: `The ${season} season isn't running`,
		});
	}
	results.push(await checkRosters(ctx, league, season, seasonEnd));
	return results;
}

// ---------- entry points ----------

export const runHealthCheck = internalAction({
	args: {},
	handler: async (ctx) => {
		const startedAt = Date.now();
		const results: HealthResult[] = [];

		for (const league of LEAGUES) {
			try {
				results.push(...(await checkLeague(ctx, league)));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`[Health] ${league} check failed:`, error);
				results.push({ league, check: "health check", status: "failing", message: `Check crashed: ${message}` });
			}
		}

		const runs = await ctx.runQuery(internal.health.listJobRuns, {});
		const staleJobs = findStaleJobs(runs, EXPECTED_JOBS, Date.now(), JOB_MAX_AGE_MS);
		results.push(
			staleJobs.length === 0
				? { check: "jobs", status: "ok", message: `All ${EXPECTED_JOBS.length} daily jobs succeeded in the last 2 days` }
				: { check: "jobs", status: "failing", message: `${staleJobs.length} daily jobs haven't succeeded in 2 days`, details: staleJobs },
		);

		const repaired = results.filter((r) => r.status === "repaired").length;
		const failing = results.filter((r) => r.status === "failing").length;
		await ctx.runMutation(internal.health.saveHealthCheck, {
			ranAt: startedAt,
			durationMs: Date.now() - startedAt,
			ok: failing === 0,
			repaired,
			failing,
			results,
		});
		console.log(`[Health] ${failing} failing, ${repaired} repaired, ${results.length} checks`);
		return { failing, repaired };
	},
});

export const saveHealthCheck = internalMutation({
	args: {
		ranAt: v.number(),
		durationMs: v.number(),
		ok: v.boolean(),
		repaired: v.number(),
		failing: v.number(),
		results: v.array(healthResultValidator),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("healthChecks", args);
		const old = await ctx.db.query("healthChecks").withIndex("by_ranAt").order("desc").collect();
		for (const check of old.slice(HEALTH_CHECKS_KEPT)) await ctx.db.delete(check._id);
	},
});

// Record a scheduled job's completion, for the health check's "jobs" check
export const recordJobRun = internalMutation({
	args: {
		job: v.string(),
		league: v.optional(leagueValidator),
		ok: v.boolean(),
		summary: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("jobRuns")
			.withIndex("by_job_league", (q) => q.eq("job", args.job).eq("league", args.league))
			.unique();
		const now = Date.now();
		const run = {
			job: args.job,
			league: args.league,
			lastRanAt: now,
			lastOk: args.ok,
			lastOkAt: args.ok ? now : existing?.lastOkAt,
			summary: args.summary,
		};
		if (existing) await ctx.db.replace(existing._id, run);
		else await ctx.db.insert("jobRuns", run);
	},
});

export const listJobRuns = internalQuery({
	args: {},
	handler: async (ctx) => {
		const runs = await ctx.db.query("jobRuns").collect();
		return runs.map(({ job, league, lastRanAt, lastOk, lastOkAt, summary }) => ({
			job,
			league,
			lastRanAt,
			lastOk,
			lastOkAt,
			summary,
		}));
	},
});

// Latest health check, public so the "Data health" GitHub Action and the admin
// page can read it. Holds only sports data and job names.
export const getLatest = query({
	args: {},
	handler: async (ctx) => {
		const [latest, previous] = await ctx.db.query("healthChecks").withIndex("by_ranAt").order("desc").take(2);
		if (!latest) return null;
		const { ranAt, durationMs, ok, repaired, failing, results } = latest;
		// The GitHub Action only alerts on checks failing in both runs, so one
		// bad run (ESPN down for a minute, say) fixes itself quietly
		const previousFailing = (previous?.results ?? [])
			.filter((result) => result.status === "failing")
			.map((result) => ({ league: result.league, check: result.check }));
		return { ranAt, durationMs, ok, repaired, failing, results, previousFailing };
	},
});

// Admin "Run now": queue a health check (results show on the admin page)
export const requestHealthCheck = mutation({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentProfile(ctx);
		if (!user?.email) throw new Error("Not authenticated");
		const superAdminEmail = process.env.SUPER_ADMIN;
		if (!superAdminEmail || user.email.toLowerCase() !== superAdminEmail.toLowerCase()) {
			throw new Error("Not authorized");
		}
		await ctx.scheduler.runAfter(0, internal.health.runHealthCheck, {});
	},
});

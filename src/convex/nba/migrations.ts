// One-off data repair for games stored under the wrong season.
//
// In Oct 2026 the seasons table had no 2026-27 rows, so every new game was
// stored as 2025-26 and linked to 2025-26 team/player rows. This walks ESPN's
// scoreboard date by date and makes our data match ESPN's own season metadata:
// mis-tagged games (and their team/player box scores) move to the right
// season's rows, and every game gets its ESPN season type.
//
// Run order (dry run first):
//   npx convex run nba/migrations:retagSeasonGames '{"startDate":"20251001","dryRun":true}'
//   npx convex run nba/migrations:retagSeasonGames '{"startDate":"20251001","finalize":{"oldSeason":"2025-26","newSeason":"2026-27"}}'
// Progress and totals are logged as "[NBA Migration]".

import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ApiScoreboardResponse } from "../shared/apiParser";
import {
	getDateRange,
	getSeasonEndYear,
	getTodayDate,
	parseEspnSeason,
	sleep,
} from "../shared/seasonHelpers";

const DATES_PER_RUN = 20;
const FETCH_DELAY_MS = 150;
const PLAYERS_PER_BATCH = 100;

const totalsValidator = v.object({
	dates: v.number(),
	events: v.number(),
	missing: v.number(),
	noEspnSeason: v.number(),
	unchanged: v.number(),
	seasonTypeSet: v.number(),
	retagged: v.number(),
	failedDates: v.number(),
});

type Totals = typeof totalsValidator.type;

const emptyTotals: Totals = {
	dates: 0,
	events: 0,
	missing: 0,
	noEspnSeason: 0,
	unchanged: 0,
	seasonTypeSet: 0,
	retagged: 0,
	failedDates: 0,
};

const finalizeValidator = v.object({
	oldSeason: v.string(),
	newSeason: v.string(),
});

function getSiteApi(): string {
	const url = process.env.NBA_SITE_API;
	if (!url) throw new Error("NBA_SITE_API not configured");
	return url;
}

// Walk ESPN scoreboards from startDate to endDate and fix each stored game's
// season/seasonType. Self-schedules in chunks of DATES_PER_RUN dates.
export const retagSeasonGames = internalAction({
	args: {
		startDate: v.string(), // YYYYMMDD
		endDate: v.optional(v.string()), // YYYYMMDD, defaults to today (ET)
		dryRun: v.optional(v.boolean()),
		finalize: v.optional(finalizeValidator),
		offset: v.optional(v.number()),
		totals: v.optional(totalsValidator),
	},
	handler: async (ctx, args) => {
		const dryRun = args.dryRun ?? false;
		const endDate = args.endDate ?? getTodayDate();
		const offset = args.offset ?? 0;
		const totals: Totals = { ...(args.totals ?? emptyTotals) };
		const dates = getDateRange(args.startDate, endDate);
		const chunk = dates.slice(offset, offset + DATES_PER_RUN);
		const baseUrl = getSiteApi();

		for (const date of chunk) {
			totals.dates += 1;
			let data: ApiScoreboardResponse;
			try {
				const response = await fetch(`${baseUrl}/scoreboard?dates=${date}`, {
					headers: { "Content-Type": "application/json" },
				});
				if (!response.ok) {
					console.error(`[NBA Migration] Scoreboard fetch failed for ${date}: ${response.status}`);
					totals.failedDates += 1;
					continue;
				}
				data = (await response.json()) as ApiScoreboardResponse;
			} catch (error) {
				console.error(`[NBA Migration] Scoreboard fetch error for ${date}:`, error);
				totals.failedDates += 1;
				continue;
			}

			for (const event of data.events ?? []) {
				totals.events += 1;
				const { season, seasonType } = parseEspnSeason("nba", event.season);
				if (!season) {
					totals.noEspnSeason += 1;
					continue;
				}
				const result = await ctx.runMutation(internal.nba.migrations.applySeasonTag, {
					espnGameId: event.id,
					season,
					seasonType,
					dryRun,
				});
				totals[result] += 1;
			}

			await sleep(FETCH_DELAY_MS);
		}

		const nextOffset = offset + DATES_PER_RUN;
		if (nextOffset < dates.length) {
			console.log(
				`[NBA Migration] ${dryRun ? "(dry run) " : ""}Through ${chunk[chunk.length - 1]}: ${JSON.stringify(totals)}`,
			);
			await ctx.scheduler.runAfter(0, internal.nba.migrations.retagSeasonGames, {
				...args,
				offset: nextOffset,
				totals,
			});
			return totals;
		}

		console.log(`[NBA Migration] ${dryRun ? "(dry run) " : ""}Retag done: ${JSON.stringify(totals)}`);
		if (totals.failedDates > 0) {
			console.error(
				`[NBA Migration] ${totals.failedDates} date(s) failed to fetch; rerun before finalizing. Skipping finalize.`,
			);
			return totals;
		}
		if (args.finalize && !dryRun) {
			await ctx.scheduler.runAfter(0, internal.nba.migrations.finalizeSeasonRetag, args.finalize);
		}
		return totals;
	},
});

// Set one game's season type, and move it to the right season if ESPN disagrees.
// Moving re-links the game, its team box scores, and its player box scores to
// the target season's team/player rows (creating them if needed).
export const applySeasonTag = internalMutation({
	args: {
		espnGameId: v.string(),
		season: v.string(),
		seasonType: v.optional(v.number()),
		dryRun: v.boolean(),
	},
	handler: async (ctx, args): Promise<"missing" | "unchanged" | "seasonTypeSet" | "retagged"> => {
		const game = await ctx.db
			.query("nbaGameEvent")
			.withIndex("by_espnGameId", (q) => q.eq("espnGameId", args.espnGameId))
			.unique();
		if (!game) return "missing";

		if (game.season === args.season) {
			if (args.seasonType === undefined || game.seasonType === args.seasonType) return "unchanged";
			if (!args.dryRun) {
				await ctx.db.patch(game._id, { seasonType: args.seasonType, updatedAt: Date.now() });
			}
			return "seasonTypeSet";
		}

		if (args.dryRun) return "retagged";

		const now = Date.now();
		const teamMap = new Map<Id<"nbaTeam">, Id<"nbaTeam">>();
		const mapTeam = async (oldTeamId: Id<"nbaTeam">) => {
			const cached = teamMap.get(oldTeamId);
			if (cached) return cached;
			const oldTeam = await ctx.db.get(oldTeamId);
			if (!oldTeam) throw new Error(`Team ${oldTeamId} not found for game ${args.espnGameId}`);
			const existing = await ctx.db
				.query("nbaTeam")
				.withIndex("by_espnTeamId_season", (q) =>
					q.eq("espnTeamId", oldTeam.espnTeamId).eq("season", args.season),
				)
				.unique();
			// New rows get identity only; records come from the standings refresh
			const newTeamId =
				existing?._id ??
				(await ctx.db.insert("nbaTeam", {
					espnTeamId: oldTeam.espnTeamId,
					season: args.season,
					name: oldTeam.name,
					abbreviation: oldTeam.abbreviation,
					location: oldTeam.location,
					slug: oldTeam.slug,
					conference: oldTeam.conference,
					division: oldTeam.division,
					wins: 0,
					losses: 0,
					updatedAt: now,
				}));
			teamMap.set(oldTeamId, newTeamId);
			return newTeamId;
		};

		const mapPlayer = async (oldPlayerId: Id<"nbaPlayer">, newTeamId: Id<"nbaTeam">) => {
			const oldPlayer = await ctx.db.get(oldPlayerId);
			if (!oldPlayer) throw new Error(`Player ${oldPlayerId} not found for game ${args.espnGameId}`);
			const existing = await ctx.db
				.query("nbaPlayer")
				.withIndex("by_espnPlayerId_season", (q) =>
					q.eq("espnPlayerId", oldPlayer.espnPlayerId).eq("season", args.season),
				)
				.unique();
			if (existing) {
				// Games are processed in date order, so the latest game sets the team
				if (existing.teamId !== newTeamId) {
					await ctx.db.patch(existing._id, { teamId: newTeamId, updatedAt: now });
				}
				return existing._id;
			}
			// Bio fields only; season stats come from ESPN Core
			return await ctx.db.insert("nbaPlayer", {
				espnPlayerId: oldPlayer.espnPlayerId,
				season: args.season,
				teamId: newTeamId,
				name: oldPlayer.name,
				firstName: oldPlayer.firstName,
				lastName: oldPlayer.lastName,
				jersey: oldPlayer.jersey,
				position: oldPlayer.position,
				headshot: oldPlayer.headshot,
				height: oldPlayer.height,
				weight: oldPlayer.weight,
				age: oldPlayer.age,
				experience: oldPlayer.experience,
				college: oldPlayer.college,
				updatedAt: now,
			});
		};

		const homeTeamId = await mapTeam(game.homeTeamId);
		const awayTeamId = await mapTeam(game.awayTeamId);
		await ctx.db.patch(game._id, {
			season: args.season,
			...(args.seasonType !== undefined ? { seasonType: args.seasonType } : {}),
			homeTeamId,
			awayTeamId,
			updatedAt: now,
		});

		const teamEvents = await ctx.db
			.query("nbaTeamEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", game._id))
			.collect();
		for (const teamEvent of teamEvents) {
			await ctx.db.patch(teamEvent._id, { teamId: await mapTeam(teamEvent.teamId) });
		}

		const playerEvents = await ctx.db
			.query("nbaPlayerEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", game._id))
			.collect();
		for (const playerEvent of playerEvents) {
			const teamId = await mapTeam(playerEvent.teamId);
			const playerId = await mapPlayer(playerEvent.playerId, teamId);
			await ctx.db.patch(playerEvent._id, { teamId, playerId });
		}

		return "retagged";
	},
});

// After the retag: fix both seasons' records, rosters, and averages.
export const finalizeSeasonRetag = internalAction({
	args: finalizeValidator,
	handler: async (ctx, args) => {
		console.log(`[NBA Migration] Finalizing ${args.oldSeason} → ${args.newSeason}...`);

		// 1. Records. October discovery wrote 2026-27 standings onto 2025-26 rows,
		// so restore the old season's final standings, then refresh the current ones.
		await ctx.runAction(internal.nba.actions.refreshStandings, {
			seasonYear: getSeasonEndYear(args.oldSeason),
		});
		await ctx.runAction(internal.nba.actions.refreshStandings, {});

		// 2. Old-season player rows. October box scores re-pointed traded players
		// at their new team and created rows for rookies; undo both.
		const cutoffMs = Date.parse(`${getSeasonEndYear(args.oldSeason)}-07-01T00:00:00Z`);
		let cursor: string | null = null;
		const playerTotals = { checked: 0, teamFixed: 0, deleted: 0 };
		for (;;) {
			const result: {
				checked: number;
				teamFixed: number;
				deleted: number;
				isDone: boolean;
				continueCursor: string;
			} = await ctx.runMutation(internal.nba.migrations.repairSeasonPlayers, {
				season: args.oldSeason,
				cutoffMs,
				cursor,
			});
			playerTotals.checked += result.checked;
			playerTotals.teamFixed += result.teamFixed;
			playerTotals.deleted += result.deleted;
			if (result.isDone) break;
			cursor = result.continueCursor;
		}
		console.log(`[NBA Migration] ${args.oldSeason} players: ${JSON.stringify(playerTotals)}`);

		// 3. Team averages and league rankings for both seasons
		for (const season of [args.oldSeason, args.newSeason]) {
			const teams = await ctx.runQuery(internal.nba.queries.getAllTeamsInternal, { season });
			for (const team of teams) {
				await ctx.runMutation(internal.nba.mutations.recalculateTeamAverages, { teamId: team._id });
			}
			await ctx.runMutation(internal.nba.mutations.updateLeagueRankings, { season });
			console.log(`[NBA Migration] Recalculated ${teams.length} teams for ${season}`);
		}

		// 4. New-season rosters + ESPN Core stats. bootstrapPlayers uses the current
		// season, so only run it once that resolves to the new season.
		const currentSeason = await ctx.runQuery(api.seasons.getCurrentName, { league: "nba" });
		if (currentSeason === args.newSeason) {
			await ctx.scheduler.runAfter(0, internal.nba.actions.bootstrapPlayers, {});
			console.log(`[NBA Migration] Scheduled ${args.newSeason} roster bootstrap`);
		} else {
			console.warn(
				`[NBA Migration] Current season resolves to ${currentSeason}, not ${args.newSeason}; skipped roster bootstrap`,
			);
		}

		console.log(`[NBA Migration] Finalize complete`);
	},
});

// Point each player row at the team from its latest box score in that season,
// and delete rows created after the cutoff that have no box scores left.
export const repairSeasonPlayers = internalMutation({
	args: {
		season: v.string(),
		cutoffMs: v.number(),
		cursor: v.union(v.string(), v.null()),
	},
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query("nbaPlayer")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.paginate({ cursor: args.cursor, numItems: PLAYERS_PER_BATCH });

		let teamFixed = 0;
		let deleted = 0;
		for (const player of page.page as Doc<"nbaPlayer">[]) {
			const events = await ctx.db
				.query("nbaPlayerEvent")
				.withIndex("by_playerId", (q) => q.eq("playerId", player._id))
				.collect();

			if (events.length === 0) {
				if (player._creationTime >= args.cutoffMs) {
					await ctx.db.delete(player._id);
					deleted += 1;
				}
				continue;
			}

			const latest = events.reduce((a, b) => (b._creationTime > a._creationTime ? b : a));
			if (latest.teamId !== player.teamId) {
				await ctx.db.patch(player._id, { teamId: latest.teamId, updatedAt: Date.now() });
				teamFixed += 1;
			}
		}

		return {
			checked: page.page.length,
			teamFixed,
			deleted,
			isDone: page.isDone,
			continueCursor: page.continueCursor,
		};
	},
});

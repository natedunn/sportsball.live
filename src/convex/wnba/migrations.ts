// One-off data repair: the 2025 WNBA season stored as "2025-26".
//
// Before season phases came from ESPN, WNBA data was labelled like the NBA's
// two-year seasons, so the 2025 season was stored as "2025-26". 2026's
// preseason and opening-night games (Apr 25 – May 8, 2026) landed there too,
// before the 2026 rows existed. WNBA seasons sit inside one calendar year, so
// the label is "2025", and those 2026 games belong to "2026".
//
// Run order (dry runs first):
//   npx convex run wnba/migrations:relabelSeason '{"from":"2025-26","to":"2025","dryRun":true}'
//   npx convex run wnba/migrations:relabelSeason '{"from":"2025-26","to":"2025"}'
//   npx convex run wnba/migrations:retagSeasonGames '{"startDate":"20260101","endDate":"20260510","dryRun":true}'
//   npx convex run wnba/migrations:retagSeasonGames '{"startDate":"20260101","endDate":"20260510","finalize":{"oldSeason":"2025","newSeason":"2026"}}'
// Progress and totals are logged as "[WNBA Migration]".

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ApiScoreboardResponse } from "../shared/apiParser";
import {
	getCompetitionYear,
	getDateRange,
	getTodayDate,
	parseEspnSeason,
	sleep,
} from "../shared/seasonHelpers";

const DATES_PER_RUN = 20;
const FETCH_DELAY_MS = 150;
const ROWS_PER_BATCH = 100;

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
type SeasonCounts = { teams: number; players: number; games: number };
type TagResult = "missing" | "unchanged" | "seasonTypeSet" | "retagged";

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
	const url = process.env.WNBA_SITE_API;
	if (!url) throw new Error("WNBA_SITE_API not configured");
	return url;
}

export const countSeasonRows = internalQuery({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		const [teams, players, games] = await Promise.all([
			ctx.db.query("wnbaTeam").withIndex("by_season", (q) => q.eq("season", args.season)).collect(),
			ctx.db.query("wnbaPlayer").withIndex("by_season", (q) => q.eq("season", args.season)).collect(),
			ctx.db.query("wnbaGameEvent").withIndex("by_season", (q) => q.eq("season", args.season)).collect(),
		]);
		return { teams: teams.length, players: players.length, games: games.length };
	},
});

// Rename a season label on every team, player and game row. Refuses to run
// when the target label already has rows, since those would need merging.
export const relabelSeason = internalAction({
	args: { from: v.string(), to: v.string(), dryRun: v.optional(v.boolean()) },
	handler: async (ctx, args): Promise<SeasonCounts> => {
		const source: SeasonCounts = await ctx.runQuery(internal.wnba.migrations.countSeasonRows, { season: args.from });
		const target: SeasonCounts = await ctx.runQuery(internal.wnba.migrations.countSeasonRows, { season: args.to });
		console.log(
			`[WNBA Migration] ${args.dryRun ? "(dry run) " : ""}${args.from}: ${JSON.stringify(source)}; ${args.to}: ${JSON.stringify(target)}`,
		);
		if (target.teams + target.players + target.games > 0) {
			throw new Error(`Season ${args.to} already has rows; merge them by hand instead`);
		}
		if (args.dryRun) return source;

		const totals: SeasonCounts = { teams: 0, players: 0, games: 0 };
		for (;;) {
			const batch: SeasonCounts = await ctx.runMutation(internal.wnba.migrations.relabelSeasonBatch, {
				from: args.from,
				to: args.to,
			});
			totals.teams += batch.teams;
			totals.players += batch.players;
			totals.games += batch.games;
			if (batch.teams + batch.players + batch.games === 0) break;
		}
		console.log(`[WNBA Migration] Relabelled ${args.from} → ${args.to}: ${JSON.stringify(totals)}`);
		return totals;
	},
});

export const relabelSeasonBatch = internalMutation({
	args: { from: v.string(), to: v.string() },
	handler: async (ctx, args) => {
		// Patched rows leave the `from` range, so each call takes the next batch
		const teams = await ctx.db
			.query("wnbaTeam")
			.withIndex("by_season", (q) => q.eq("season", args.from))
			.take(ROWS_PER_BATCH);
		const players = await ctx.db
			.query("wnbaPlayer")
			.withIndex("by_season", (q) => q.eq("season", args.from))
			.take(ROWS_PER_BATCH);
		const games = await ctx.db
			.query("wnbaGameEvent")
			.withIndex("by_season", (q) => q.eq("season", args.from))
			.take(ROWS_PER_BATCH);

		for (const row of [...teams, ...players, ...games]) {
			await ctx.db.patch(row._id, { season: args.to });
		}
		return { teams: teams.length, players: players.length, games: games.length };
	},
});

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
	handler: async (ctx, args): Promise<Totals> => {
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
					console.error(`[WNBA Migration] Scoreboard fetch failed for ${date}: ${response.status}`);
					totals.failedDates += 1;
					continue;
				}
				data = (await response.json()) as ApiScoreboardResponse;
			} catch (error) {
				console.error(`[WNBA Migration] Scoreboard fetch error for ${date}:`, error);
				totals.failedDates += 1;
				continue;
			}

			for (const event of data.events ?? []) {
				totals.events += 1;
				const { season, seasonType } = parseEspnSeason("wnba", event.season);
				if (!season) {
					totals.noEspnSeason += 1;
					continue;
				}
				const result: TagResult = await ctx.runMutation(internal.wnba.migrations.applySeasonTag, {
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
				`[WNBA Migration] ${dryRun ? "(dry run) " : ""}Through ${chunk[chunk.length - 1]}: ${JSON.stringify(totals)}`,
			);
			await ctx.scheduler.runAfter(0, internal.wnba.migrations.retagSeasonGames, {
				...args,
				offset: nextOffset,
				totals,
			});
			return totals;
		}

		console.log(`[WNBA Migration] ${dryRun ? "(dry run) " : ""}Retag done: ${JSON.stringify(totals)}`);
		if (totals.failedDates > 0) {
			console.error(
				`[WNBA Migration] ${totals.failedDates} date(s) failed to fetch; rerun before finalizing. Skipping finalize.`,
			);
			return totals;
		}
		if (args.finalize && !dryRun) {
			await ctx.scheduler.runAfter(0, internal.wnba.migrations.finalizeSeasonRetag, args.finalize);
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
	handler: async (ctx, args): Promise<TagResult> => {
		const game = await ctx.db
			.query("wnbaGameEvent")
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
		const teamMap = new Map<Id<"wnbaTeam">, Id<"wnbaTeam">>();
		const mapTeam = async (oldTeamId: Id<"wnbaTeam">) => {
			const cached = teamMap.get(oldTeamId);
			if (cached) return cached;
			const oldTeam = await ctx.db.get(oldTeamId);
			if (!oldTeam) throw new Error(`Team ${oldTeamId} not found for game ${args.espnGameId}`);
			const existing = await ctx.db
				.query("wnbaTeam")
				.withIndex("by_espnTeamId_season", (q) =>
					q.eq("espnTeamId", oldTeam.espnTeamId).eq("season", args.season),
				)
				.unique();
			// New rows get identity only; records come from the standings refresh
			const newTeamId =
				existing?._id ??
				(await ctx.db.insert("wnbaTeam", {
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

		const mapPlayer = async (oldPlayerId: Id<"wnbaPlayer">, newTeamId: Id<"wnbaTeam">) => {
			const oldPlayer = await ctx.db.get(oldPlayerId);
			if (!oldPlayer) throw new Error(`Player ${oldPlayerId} not found for game ${args.espnGameId}`);
			const existing = await ctx.db
				.query("wnbaPlayer")
				.withIndex("by_espnPlayerId_season", (q) =>
					q.eq("espnPlayerId", oldPlayer.espnPlayerId).eq("season", args.season),
				)
				.unique();
			// Keep an existing row's team: the target season's own games are newer
			// than the preseason games being moved
			if (existing) return existing._id;
			// Bio fields only; season stats come from ESPN Core
			return await ctx.db.insert("wnbaPlayer", {
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
			.query("wnbaTeamEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", game._id))
			.collect();
		for (const teamEvent of teamEvents) {
			await ctx.db.patch(teamEvent._id, { teamId: await mapTeam(teamEvent.teamId) });
		}

		const playerEvents = await ctx.db
			.query("wnbaPlayerEvent")
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

// After the retag: fix the old season's rosters and records, then both
// seasons' averages, rankings, and player stats.
export const finalizeSeasonRetag = internalAction({
	args: finalizeValidator,
	handler: async (ctx, args) => {
		console.log(`[WNBA Migration] Finalizing ${args.oldSeason} → ${args.newSeason}...`);

		// 1. Old-season players. Point each at the team from its last box score,
		// and drop rows with no box scores left: they came from 2026 rosters.
		let cursor: string | null = null;
		const playerTotals = { checked: 0, teamFixed: 0, deleted: 0 };
		for (;;) {
			const result: {
				checked: number;
				teamFixed: number;
				deleted: number;
				isDone: boolean;
				continueCursor: string;
			} = await ctx.runMutation(internal.wnba.migrations.repairSeasonPlayers, {
				season: args.oldSeason,
				cursor,
			});
			playerTotals.checked += result.checked;
			playerTotals.teamFixed += result.teamFixed;
			playerTotals.deleted += result.deleted;
			if (result.isDone) break;
			cursor = result.continueCursor;
		}
		console.log(`[WNBA Migration] ${args.oldSeason} players: ${JSON.stringify(playerTotals)}`);

		// 2. Old-season teams with nothing left (2026 expansion and exhibition teams)
		const deletedTeams = await ctx.runMutation(internal.wnba.migrations.deleteUnusedTeams, {
			season: args.oldSeason,
		});
		console.log(`[WNBA Migration] Deleted unused ${args.oldSeason} teams: ${deletedTeams.join(", ") || "none"}`);

		// 3. Records. The old season's rows hold 2026 preseason records, so load
		// its final standings, then refresh the current ones.
		await ctx.runAction(internal.wnba.actions.refreshStandings, {
			seasonYear: getCompetitionYear("wnba", args.oldSeason),
		});
		await ctx.runAction(internal.wnba.actions.refreshStandings, {});

		// 4. Team averages and league rankings for both seasons
		for (const season of [args.oldSeason, args.newSeason]) {
			const teams = await ctx.runQuery(internal.wnba.queries.getAllTeamsInternal, { season });
			for (const team of teams) {
				await ctx.runMutation(internal.wnba.mutations.recalculateTeamAverages, { teamId: team._id });
			}
			await ctx.runMutation(internal.wnba.mutations.updateLeagueRankings, { season });
			console.log(`[WNBA Migration] Recalculated ${teams.length} teams for ${season}`);
		}

		// 5. Player season stats from ESPN Core. The old season's rows were read
		// with the wrong year while labelled "2025-26".
		for (const season of [args.oldSeason, args.newSeason]) {
			await ctx.scheduler.runAfter(0, internal.wnba.actions.backfillPlayerStatsFromCoreInternal, { season });
		}
		console.log(`[WNBA Migration] Finalize complete; player stats reconcile scheduled`);
	},
});

// Point each player row at the team from its latest box score in that season,
// and delete rows that have no box scores.
export const repairSeasonPlayers = internalMutation({
	args: {
		season: v.string(),
		cursor: v.union(v.string(), v.null()),
	},
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query("wnbaPlayer")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.paginate({ cursor: args.cursor, numItems: ROWS_PER_BATCH });

		let teamFixed = 0;
		let deleted = 0;
		for (const player of page.page as Doc<"wnbaPlayer">[]) {
			const events = await ctx.db
				.query("wnbaPlayerEvent")
				.withIndex("by_playerId", (q) => q.eq("playerId", player._id))
				.collect();

			if (events.length === 0) {
				await ctx.db.delete(player._id);
				deleted += 1;
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

// Delete a season's team rows that no game, box score, or player points at.
// Returns the deleted teams' abbreviations.
export const deleteUnusedTeams = internalMutation({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		const teams = await ctx.db
			.query("wnbaTeam")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();

		const deleted: string[] = [];
		for (const team of teams) {
			const [homeGame, awayGame, teamEvent, player] = await Promise.all([
				ctx.db.query("wnbaGameEvent").withIndex("by_homeTeam", (q) => q.eq("homeTeamId", team._id)).first(),
				ctx.db.query("wnbaGameEvent").withIndex("by_awayTeam", (q) => q.eq("awayTeamId", team._id)).first(),
				ctx.db.query("wnbaTeamEvent").withIndex("by_teamId", (q) => q.eq("teamId", team._id)).first(),
				ctx.db.query("wnbaPlayer").withIndex("by_teamId", (q) => q.eq("teamId", team._id)).first(),
			]);
			if (homeGame || awayGame || teamEvent || player) continue;
			await ctx.db.delete(team._id);
			deleted.push(team.abbreviation);
		}
		return deleted;
	},
});

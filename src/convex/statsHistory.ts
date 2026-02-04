import { v } from "convex/values";
import { query, action, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";

type League = "nba" | "wnba" | "gleague";

const leagueValidator = v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague"));

// Season start dates for backfill (YYYYMMDD format)
const SEASON_START_DATES: Record<League, string> = {
  nba: "20251021", // Oct 21, 2025
  wnba: "20260508", // May 8, 2026 (future - offseason)
  gleague: "20251107", // Nov 7, 2025
};

// Site API env var names by league
const SITE_API_VARS: Record<League, string> = {
  nba: "NBA_SITE_API",
  wnba: "WNBA_SITE_API",
  gleague: "GLEAGUE_SITE_API",
};

// Get the Unix timestamp for the start of the current week (Sunday at midnight UTC)
function getWeekStartDate(date: Date = new Date()): number {
	const d = new Date(date);
	const day = d.getUTCDay(); // 0 = Sunday
	d.setUTCHours(0, 0, 0, 0);
	d.setUTCDate(d.getUTCDate() - day);
	return d.getTime();
}

// Internal mutation to insert a team stats snapshot
export const insertTeamSnapshot = internalMutation({
	args: {
		league: leagueValidator,
		teamId: v.string(),
		weekStartDate: v.number(),
		wins: v.number(),
		losses: v.number(),
		pointsFor: v.number(),
		pointsAgainst: v.number(),
		pace: v.number(),
		offensiveRating: v.number(),
		defensiveRating: v.number(),
		netRating: v.number(),
		rankPpg: v.optional(v.number()),
		rankOppPpg: v.optional(v.number()),
		rankOrtg: v.optional(v.number()),
		rankDrtg: v.optional(v.number()),
		rankNetRtg: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// Check if snapshot already exists for this team/week (idempotency)
		const existing = await ctx.db
			.query("teamStatsHistory")
			.withIndex("by_league_team_week", (q) =>
				q.eq("league", args.league).eq("teamId", args.teamId).eq("weekStartDate", args.weekStartDate)
			)
			.unique();

		if (existing) {
			return { skipped: true };
		}

		await ctx.db.insert("teamStatsHistory", {
			...args,
			snapshotAt: Date.now(),
		});

		return { skipped: false };
	},
});

// Internal mutation to insert a player stats snapshot
export const insertPlayerSnapshot = internalMutation({
	args: {
		league: leagueValidator,
		playerId: v.string(),
		teamId: v.string(),
		name: v.string(),
		weekStartDate: v.number(),
		gamesPlayed: v.number(),
		gamesStarted: v.number(),
		minutesPerGame: v.number(),
		pointsPerGame: v.number(),
		reboundsPerGame: v.number(),
		assistsPerGame: v.number(),
		stealsPerGame: v.number(),
		blocksPerGame: v.number(),
		turnoversPerGame: v.number(),
		fieldGoalPct: v.number(),
		threePointPct: v.number(),
		freeThrowPct: v.number(),
	},
	handler: async (ctx, args) => {
		// Check if snapshot already exists for this player/week (idempotency)
		const existing = await ctx.db
			.query("playerStatsHistory")
			.withIndex("by_league_player_week", (q) =>
				q.eq("league", args.league).eq("playerId", args.playerId).eq("weekStartDate", args.weekStartDate)
			)
			.unique();

		if (existing) {
			return { skipped: true };
		}

		await ctx.db.insert("playerStatsHistory", {
			...args,
			snapshotAt: Date.now(),
		});

		return { skipped: false };
	},
});

// Internal action to capture snapshots for a single league
export const captureLeagueSnapshot = internalAction({
	args: {
		league: leagueValidator,
		weekStartDate: v.number(),
	},
	handler: async (ctx, args) => {
		const { league, weekStartDate } = args;
		console.log(`Capturing ${league.toUpperCase()} snapshot for week starting ${new Date(weekStartDate).toISOString()}`);

		let teamsCaptured = 0;
		let teamsSkipped = 0;
		let playersCaptured = 0;
		let playersSkipped = 0;

		// Get all current team stats
		const teamStats = await ctx.runQuery(api.teamStats.getByLeague, { league });

		for (const team of teamStats) {
			const result = await ctx.runMutation(internal.statsHistory.insertTeamSnapshot, {
				league,
				teamId: team.teamId,
				weekStartDate,
				wins: team.wins,
				losses: team.losses,
				pointsFor: team.pointsFor,
				pointsAgainst: team.pointsAgainst,
				pace: team.pace,
				offensiveRating: team.offensiveRating,
				defensiveRating: team.defensiveRating,
				netRating: team.netRating,
				rankPpg: team.rankPpg,
				rankOppPpg: team.rankOppPpg,
				rankOrtg: team.rankOrtg,
				rankDrtg: team.rankDrtg,
				rankNetRtg: team.rankNetRtg,
			});

			if (result.skipped) {
				teamsSkipped++;
			} else {
				teamsCaptured++;
			}
		}

		// Get all current player stats
		const playerStats = await ctx.runQuery(api.playerStats.getByLeague, { league });

		for (const player of playerStats) {
			const result = await ctx.runMutation(internal.statsHistory.insertPlayerSnapshot, {
				league,
				playerId: player.playerId,
				teamId: player.teamId,
				name: player.name,
				weekStartDate,
				gamesPlayed: player.gamesPlayed,
				gamesStarted: player.gamesStarted,
				minutesPerGame: player.minutesPerGame,
				pointsPerGame: player.pointsPerGame,
				reboundsPerGame: player.reboundsPerGame,
				assistsPerGame: player.assistsPerGame,
				stealsPerGame: player.stealsPerGame,
				blocksPerGame: player.blocksPerGame,
				turnoversPerGame: player.turnoversPerGame,
				fieldGoalPct: player.fieldGoalPct,
				threePointPct: player.threePointPct,
				freeThrowPct: player.freeThrowPct,
			});

			if (result.skipped) {
				playersSkipped++;
			} else {
				playersCaptured++;
			}
		}

		console.log(
			`${league.toUpperCase()} snapshot complete: ${teamsCaptured} teams captured (${teamsSkipped} skipped), ${playersCaptured} players captured (${playersSkipped} skipped)`
		);

		return {
			teams: { captured: teamsCaptured, skipped: teamsSkipped },
			players: { captured: playersCaptured, skipped: playersSkipped },
		};
	},
});

// Internal action to capture weekly snapshots for all leagues
export const captureWeeklySnapshots = internalAction({
	args: {},
	handler: async (ctx) => {
		const weekStartDate = getWeekStartDate();
		console.log(`Starting weekly snapshot capture for week starting ${new Date(weekStartDate).toISOString()}`);

		const results: Record<string, { teams: { captured: number; skipped: number }; players: { captured: number; skipped: number } }> = {};

		for (const league of ["nba", "wnba", "gleague"] as League[]) {
			try {
				const result = await ctx.runAction(internal.statsHistory.captureLeagueSnapshot, {
					league,
					weekStartDate,
				});
				results[league] = result;
			} catch (error) {
				console.error(`Failed to capture ${league} snapshot:`, error);
				results[league] = { teams: { captured: 0, skipped: 0 }, players: { captured: 0, skipped: 0 } };
			}
		}

		console.log("Weekly snapshot complete:", results);
		return results;
	},
});

// Query to get snapshot coverage - which weeks have data for each league
export const getSnapshotCoverage = query({
	args: {},
	handler: async (ctx) => {
		const leagues = ["nba", "wnba", "gleague"] as const;
		const coverage: Record<string, number[]> = {
			nba: [],
			wnba: [],
			gleague: [],
		};

		for (const league of leagues) {
			// Get all team stats history for this league
			const snapshots = await ctx.db
				.query("teamStatsHistory")
				.withIndex("by_league_team", (q) => q.eq("league", league))
				.collect();

			// Extract unique weekStartDates
			const weeks = new Set(snapshots.map((s) => s.weekStartDate));
			coverage[league] = Array.from(weeks).sort((a, b) => b - a); // Sort descending (newest first)
		}

		return coverage;
	},
});

// Query to get summary counts for a specific week
export const getWeekSnapshotSummary = query({
	args: { weekStartDate: v.number() },
	handler: async (ctx, args) => {
		const leagues = ["nba", "wnba", "gleague"] as const;
		const summary: Record<string, { teams: number; players: number }> = {};

		for (const league of leagues) {
			const teams = await ctx.db
				.query("teamStatsHistory")
				.withIndex("by_league_week", (q) =>
					q.eq("league", league).eq("weekStartDate", args.weekStartDate)
				)
				.collect();

			const players = await ctx.db
				.query("playerStatsHistory")
				.withIndex("by_league_week", (q) =>
					q.eq("league", league).eq("weekStartDate", args.weekStartDate)
				)
				.collect();

			summary[league] = {
				teams: teams.length,
				players: players.length,
			};
		}

		return summary;
	},
});

// Query to get team stats history
export const getTeamStatsHistory = query({
	args: {
		league: leagueValidator,
		teamId: v.string(),
		weeks: v.optional(v.number()), // If not specified, returns all data
	},
	handler: async (ctx, args) => {
		const cutoffDate = args.weeks
			? Date.now() - args.weeks * 7 * 24 * 60 * 60 * 1000
			: 0; // No cutoff if weeks not specified

		const history = await ctx.db
			.query("teamStatsHistory")
			.withIndex("by_league_team_week", (q) =>
				q.eq("league", args.league).eq("teamId", args.teamId)
			)
			.filter((q) => q.gte(q.field("weekStartDate"), cutoffDate))
			.collect();

		// Sort by week (oldest first for charting)
		return history.sort((a, b) => a.weekStartDate - b.weekStartDate);
	},
});

// Query to get player stats history
export const getPlayerStatsHistory = query({
	args: {
		league: leagueValidator,
		playerId: v.string(),
		weeks: v.optional(v.number()), // If not specified, returns all data
	},
	handler: async (ctx, args) => {
		const cutoffDate = args.weeks
			? Date.now() - args.weeks * 7 * 24 * 60 * 60 * 1000
			: 0; // No cutoff if weeks not specified

		const history = await ctx.db
			.query("playerStatsHistory")
			.withIndex("by_league_player_week", (q) =>
				q.eq("league", args.league).eq("playerId", args.playerId)
			)
			.filter((q) => q.gte(q.field("weekStartDate"), cutoffDate))
			.collect();

		// Sort by week (oldest first for charting)
		return history.sort((a, b) => a.weekStartDate - b.weekStartDate);
	},
});

// Query to get all stats for a specific week (for leaderboard trends)
export const getLeagueStatsHistory = query({
	args: {
		league: leagueValidator,
		weekStartDate: v.number(),
	},
	handler: async (ctx, args) => {
		const teams = await ctx.db
			.query("teamStatsHistory")
			.withIndex("by_league_week", (q) =>
				q.eq("league", args.league).eq("weekStartDate", args.weekStartDate)
			)
			.collect();

		const players = await ctx.db
			.query("playerStatsHistory")
			.withIndex("by_league_week", (q) =>
				q.eq("league", args.league).eq("weekStartDate", args.weekStartDate)
			)
			.collect();

		return { teams, players };
	},
});

// Snapshot result types
type LeagueSnapshotResult = {
	teams: { captured: number; skipped: number };
	players: { captured: number; skipped: number };
};
type AllLeaguesSnapshotResult = Record<string, LeagueSnapshotResult>;

// Public action to manually trigger a snapshot (for admin/testing)
export const triggerSnapshot = action({
	args: {
		league: v.optional(leagueValidator),
	},
	handler: async (ctx, args): Promise<LeagueSnapshotResult | AllLeaguesSnapshotResult> => {
		const weekStartDate = getWeekStartDate();

		if (args.league) {
			return await ctx.runAction(internal.statsHistory.captureLeagueSnapshot, {
				league: args.league,
				weekStartDate,
			});
		}

		return await ctx.runAction(internal.statsHistory.captureWeeklySnapshots, {});
	},
});

// Admin-protected action to trigger snapshot for current week
export const adminTriggerSnapshot = action({
	args: {},
	handler: async (ctx): Promise<AllLeaguesSnapshotResult> => {
		// Check admin status
		const isAdmin = await ctx.runQuery(internal.admin.internalCheckIsAdmin, {});
		if (!isAdmin) {
			throw new Error("Unauthorized: Admin access required");
		}

		const weekStartDate = getWeekStartDate();

		// Capture for all leagues
		const results: AllLeaguesSnapshotResult = {};
		for (const league of ["nba", "wnba", "gleague"] as League[]) {
			try {
				const result = await ctx.runAction(internal.statsHistory.captureLeagueSnapshot, {
					league,
					weekStartDate,
				});
				results[league] = result;
			} catch (error) {
				console.error(`Failed to capture ${league} snapshot:`, error);
				results[league] = { teams: { captured: 0, skipped: 0 }, players: { captured: 0, skipped: 0 } };
			}
		}

		return results;
	},
});

// Admin-protected action to clear all snapshot history
export const adminClearAllSnapshots = action({
	args: {},
	handler: async (ctx): Promise<{ teamsDeleted: number; playersDeleted: number }> => {
		// Check admin status
		const isAdmin = await ctx.runQuery(internal.admin.internalCheckIsAdmin, {});
		if (!isAdmin) {
			throw new Error("Unauthorized: Admin access required");
		}

		const result = await ctx.runMutation(internal.statsHistory.clearAllSnapshots, {});
		return result;
	},
});

// Internal mutation to clear all snapshot data
export const clearAllSnapshots = internalMutation({
	args: {},
	handler: async (ctx) => {
		let teamsDeleted = 0;
		let playersDeleted = 0;

		// Delete all team stats history
		const teamSnapshots = await ctx.db.query("teamStatsHistory").collect();
		for (const snapshot of teamSnapshots) {
			await ctx.db.delete(snapshot._id);
			teamsDeleted++;
		}

		// Delete all player stats history
		const playerSnapshots = await ctx.db.query("playerStatsHistory").collect();
		for (const snapshot of playerSnapshots) {
			await ctx.db.delete(snapshot._id);
			playersDeleted++;
		}

		console.log(`Cleared all snapshots: ${teamsDeleted} team records, ${playersDeleted} player records`);
		return { teamsDeleted, playersDeleted };
	},
});

// ============================================================================
// BACKFILL FUNCTIONALITY (Self-scheduling to avoid 10-minute timeout)
// ============================================================================

// Constants for chunked processing
const DATES_PER_CHUNK = 3; // Process 3 dates worth of scoreboards per action
const GAMES_PER_CHUNK = 5; // Process 5 games per action (with 5s delays = ~30s work)
const DELAY_BETWEEN_GAMES_MS = 5000; // 5 seconds between game fetches
const DELAY_BETWEEN_CHUNKS_MS = 2000; // 2 seconds between scheduling next chunk

// Query to get backfill progress for all leagues
export const getBackfillProgress = query({
	args: {},
	handler: async (ctx) => {
		const leagues = ["nba", "wnba", "gleague"] as const;
		const progress: Record<string, {
			status: "idle" | "collecting" | "fetching" | "processing" | "complete" | "error";
			totalGames: number;
			fetchedGames: number;
			currentDate?: string;
			error?: string;
			startedAt?: number;
			completedAt?: number;
		}> = {};

		for (const league of leagues) {
			const record = await ctx.db
				.query("backfillProgress")
				.withIndex("by_league", (q) => q.eq("league", league))
				.unique();

			if (record) {
				progress[league] = {
					status: record.status,
					totalGames: record.totalGames,
					fetchedGames: record.fetchedGames,
					currentDate: record.currentDate,
					error: record.error,
					startedAt: record.startedAt,
					completedAt: record.completedAt,
				};
			} else {
				progress[league] = {
					status: "idle",
					totalGames: 0,
					fetchedGames: 0,
				};
			}
		}

		return progress;
	},
});

// Internal mutation to update backfill progress
export const updateBackfillProgress = internalMutation({
	args: {
		league: leagueValidator,
		status: v.union(
			v.literal("idle"),
			v.literal("collecting"),
			v.literal("fetching"),
			v.literal("processing"),
			v.literal("complete"),
			v.literal("error")
		),
		datesToProcess: v.optional(v.array(v.string())),
		totalGames: v.optional(v.number()),
		fetchedGames: v.optional(v.number()),
		currentDate: v.optional(v.string()),
		error: v.optional(v.string()),
		startedAt: v.optional(v.number()),
		completedAt: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("backfillProgress")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.unique();

		const data = {
			league: args.league,
			status: args.status,
			datesToProcess: args.datesToProcess ?? existing?.datesToProcess,
			totalGames: args.totalGames ?? existing?.totalGames ?? 0,
			fetchedGames: args.fetchedGames ?? existing?.fetchedGames ?? 0,
			currentDate: args.currentDate ?? existing?.currentDate,
			error: args.error,
			startedAt: args.startedAt ?? existing?.startedAt,
			completedAt: args.completedAt,
		};

		if (existing) {
			await ctx.db.patch(existing._id, data);
		} else {
			await ctx.db.insert("backfillProgress", data);
		}
	},
});

// Internal mutation to add games to the backfill queue
export const addGamesToQueue = internalMutation({
	args: {
		league: leagueValidator,
		games: v.array(v.object({
			gameId: v.string(),
			gameDate: v.string(),
		})),
	},
	handler: async (ctx, args) => {
		let added = 0;
		for (const game of args.games) {
			// Check if already in queue
			const existing = await ctx.db
				.query("backfillGameQueue")
				.withIndex("by_league_game", (q) => q.eq("league", args.league).eq("gameId", game.gameId))
				.unique();

			if (!existing) {
				await ctx.db.insert("backfillGameQueue", {
					league: args.league,
					gameId: game.gameId,
					gameDate: game.gameDate,
					status: "pending",
				});
				added++;
			}
		}
		return { added };
	},
});

// Internal mutation to get and mark games from queue
export const claimGamesFromQueue = internalMutation({
	args: {
		league: leagueValidator,
		count: v.number(),
	},
	handler: async (ctx, args) => {
		const pending = await ctx.db
			.query("backfillGameQueue")
			.withIndex("by_league_status", (q) => q.eq("league", args.league).eq("status", "pending"))
			.take(args.count);

		return pending.map(g => ({
			id: g._id,
			gameId: g.gameId,
			gameDate: g.gameDate,
		}));
	},
});

// Internal mutation to mark a game as fetched and store raw data
export const markGameFetchedAndStoreData = internalMutation({
	args: {
		queueId: v.id("backfillGameQueue"),
		league: leagueValidator,
		teams: v.array(v.object({
			teamId: v.string(),
			teamName: v.string(),
			abbreviation: v.string(),
			gameDate: v.string(),
			won: v.boolean(),
			pointsFor: v.number(),
			pointsAgainst: v.number(),
			fgMade: v.number(),
			fgAttempted: v.number(),
			threeMade: v.number(),
			threeAttempted: v.number(),
			ftMade: v.number(),
			ftAttempted: v.number(),
			rebounds: v.number(),
			assists: v.number(),
			steals: v.number(),
			blocks: v.number(),
			turnovers: v.number(),
		})),
		players: v.array(v.object({
			playerId: v.string(),
			name: v.string(),
			teamId: v.string(),
			gameDate: v.string(),
			started: v.boolean(),
			minutes: v.number(),
			points: v.number(),
			rebounds: v.number(),
			assists: v.number(),
			steals: v.number(),
			blocks: v.number(),
			turnovers: v.number(),
			fgMade: v.number(),
			fgAttempted: v.number(),
			threeMade: v.number(),
			threeAttempted: v.number(),
			ftMade: v.number(),
			ftAttempted: v.number(),
		})),
	},
	handler: async (ctx, args) => {
		// Mark queue item as fetched
		await ctx.db.patch(args.queueId, { status: "fetched" as const });

		// Store raw team data
		for (const team of args.teams) {
			await ctx.db.insert("teamGameLog", {
				league: args.league,
				...team,
			});
		}

		// Store raw player data
		for (const player of args.players) {
			await ctx.db.insert("playerGameLog", {
				league: args.league,
				...player,
			});
		}
	},
});

// Internal mutation to mark a game as failed
export const markGameFailed = internalMutation({
	args: {
		queueId: v.id("backfillGameQueue"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.queueId, { status: "failed" as const });
	},
});

// Internal mutation to get queue stats
export const getQueueStats = internalMutation({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		const pending = await ctx.db
			.query("backfillGameQueue")
			.withIndex("by_league_status", (q) => q.eq("league", args.league).eq("status", "pending"))
			.collect();

		const fetched = await ctx.db
			.query("backfillGameQueue")
			.withIndex("by_league_status", (q) => q.eq("league", args.league).eq("status", "fetched"))
			.collect();

		return {
			pending: pending.length,
			fetched: fetched.length,
			total: pending.length + fetched.length,
		};
	},
});

// Internal mutation to clear backfill data for a league
export const clearBackfillData = internalMutation({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		// Clear queue
		const queueItems = await ctx.db
			.query("backfillGameQueue")
			.withIndex("by_league_status", (q) => q.eq("league", args.league))
			.collect();
		for (const item of queueItems) {
			await ctx.db.delete(item._id);
		}

		// Clear raw team data
		const teamData = await ctx.db
			.query("teamGameLog")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.collect();
		for (const item of teamData) {
			await ctx.db.delete(item._id);
		}

		// Clear raw player data
		const playerData = await ctx.db
			.query("playerGameLog")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.collect();
		for (const item of playerData) {
			await ctx.db.delete(item._id);
		}

		return { cleared: true };
	},
});

// Helper: Get all dates from season start to today (YYYYMMDD format)
function getDateRange(startDate: string): string[] {
	const dates: string[] = [];
	const start = new Date(
		parseInt(startDate.slice(0, 4)),
		parseInt(startDate.slice(4, 6)) - 1,
		parseInt(startDate.slice(6, 8))
	);
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// If season hasn't started yet, return empty
	if (start > today) {
		return [];
	}

	const current = new Date(start);
	while (current <= today) {
		const year = current.getFullYear();
		const month = String(current.getMonth() + 1).padStart(2, "0");
		const day = String(current.getDate()).padStart(2, "0");
		dates.push(`${year}${month}${day}`);
		current.setDate(current.getDate() + 1);
	}

	return dates;
}

// Types for raw game data
interface RawPlayerGame {
	playerId: string;
	name: string;
	teamId: string;
	gameDate: string;
	started: boolean;
	minutes: number;
	points: number;
	rebounds: number;
	assists: number;
	steals: number;
	blocks: number;
	turnovers: number;
	fgMade: number;
	fgAttempted: number;
	threeMade: number;
	threeAttempted: number;
	ftMade: number;
	ftAttempted: number;
}

interface RawTeamGame {
	teamId: string;
	teamName: string;
	abbreviation: string;
	gameDate: string;
	won: boolean;
	pointsFor: number;
	pointsAgainst: number;
	fgMade: number;
	fgAttempted: number;
	threeMade: number;
	threeAttempted: number;
	ftMade: number;
	ftAttempted: number;
	rebounds: number;
	assists: number;
	steals: number;
	blocks: number;
	turnovers: number;
}

// Helper: Calculate per-game averages from totals
function calculateAverages(totals: {
	gamesPlayed: number;
	gamesStarted: number;
	totalMinutes: number;
	totalPoints: number;
	totalRebounds: number;
	totalAssists: number;
	totalSteals: number;
	totalBlocks: number;
	totalTurnovers: number;
	totalFgMade: number;
	totalFgAttempted: number;
	totalThreeMade: number;
	totalThreeAttempted: number;
	totalFtMade: number;
	totalFtAttempted: number;
}) {
	const gp = totals.gamesPlayed || 1;
	return {
		gamesPlayed: totals.gamesPlayed,
		gamesStarted: totals.gamesStarted,
		minutesPerGame: Math.round((totals.totalMinutes / gp) * 10) / 10,
		pointsPerGame: Math.round((totals.totalPoints / gp) * 10) / 10,
		reboundsPerGame: Math.round((totals.totalRebounds / gp) * 10) / 10,
		assistsPerGame: Math.round((totals.totalAssists / gp) * 10) / 10,
		stealsPerGame: Math.round((totals.totalSteals / gp) * 10) / 10,
		blocksPerGame: Math.round((totals.totalBlocks / gp) * 10) / 10,
		turnoversPerGame: Math.round((totals.totalTurnovers / gp) * 10) / 10,
		fieldGoalPct: totals.totalFgAttempted > 0
			? Math.round((totals.totalFgMade / totals.totalFgAttempted) * 1000) / 10
			: 0,
		threePointPct: totals.totalThreeAttempted > 0
			? Math.round((totals.totalThreeMade / totals.totalThreeAttempted) * 1000) / 10
			: 0,
		freeThrowPct: totals.totalFtAttempted > 0
			? Math.round((totals.totalFtMade / totals.totalFtAttempted) * 1000) / 10
			: 0,
	};
}

// Helper: Calculate team ratings from season totals
function calculateTeamStats(games: RawTeamGame[]) {
	const gp = games.length || 1;
	const wins = games.filter(g => g.won).length;
	const losses = games.length - wins;

	let totalPointsFor = 0;
	let totalPointsAgainst = 0;
	let totalFgMade = 0;
	let totalFgAttempted = 0;
	let totalThreeMade = 0;
	let totalThreeAttempted = 0;
	let totalFtMade = 0;
	let totalFtAttempted = 0;
	let totalRebounds = 0;
	let totalTurnovers = 0;

	for (const game of games) {
		totalPointsFor += game.pointsFor;
		totalPointsAgainst += game.pointsAgainst;
		totalFgMade += game.fgMade;
		totalFgAttempted += game.fgAttempted;
		totalThreeMade += game.threeMade;
		totalThreeAttempted += game.threeAttempted;
		totalFtMade += game.ftMade;
		totalFtAttempted += game.ftAttempted;
		totalRebounds += game.rebounds;
		totalTurnovers += game.turnovers;
	}

	const ppg = totalPointsFor / gp;
	const oppPpg = totalPointsAgainst / gp;

	// Estimate possessions: 0.96 * (FGA + TO + 0.44*FTA - ORB)
	// Simplified: FGA + 0.4*FTA + TO
	const possessions = totalFgAttempted + 0.4 * totalFtAttempted + totalTurnovers;
	const possPerGame = possessions / gp;
	const pace = possPerGame * 2; // Both teams contribute to pace

	// Ratings per 100 possessions
	const ortg = possessions > 0 ? (totalPointsFor / possessions) * 100 : 0;
	const drtg = possessions > 0 ? (totalPointsAgainst / possessions) * 100 : 0;

	return {
		wins,
		losses,
		pointsFor: Math.round(ppg * 10) / 10,
		pointsAgainst: Math.round(oppPpg * 10) / 10,
		pace: Math.round(pace * 10) / 10,
		offensiveRating: Math.round(ortg * 10) / 10,
		defensiveRating: Math.round(drtg * 10) / 10,
		netRating: Math.round((ortg - drtg) * 10) / 10,
	};
}

// Internal action to process a single date's games for backfill
export const processBackfillDate = internalAction({
	args: {
		league: leagueValidator,
		date: v.string(), // YYYYMMDD
	},
	handler: async (ctx, args): Promise<{ games: Array<{ gameId: string; homeTeamId: string; awayTeamId: string }> }> => {
		const { league, date } = args;

		const apiEnvVar = SITE_API_VARS[league as League];
		const baseUrl = process.env[apiEnvVar];
		if (!baseUrl) {
			throw new Error(`${apiEnvVar} not configured`);
		}

		// Fetch scoreboard for this date
		const response = await fetch(`${baseUrl}/scoreboard?dates=${date}`, {
			headers: { "Content-Type": "application/json" },
		});

		if (!response.ok) {
			if (response.status === 429) {
				throw new Error("Rate limited - try again later");
			}
			throw new Error(`Scoreboard API error: ${response.status}`);
		}

		const data = await response.json() as { events?: Array<{
			id: string;
			status?: { type?: { state?: string } };
			competitions?: Array<{
				competitors?: Array<{
					homeAway: "home" | "away";
					team: { id: string };
				}>;
			}>;
		}> };

		if (!data.events) {
			return { games: [] };
		}

		// Only return completed games
		const completedGames = data.events
			.filter(e => e.status?.type?.state === "post")
			.map(e => {
				const competitors = e.competitions?.[0]?.competitors ?? [];
				const home = competitors.find(c => c.homeAway === "home");
				const away = competitors.find(c => c.homeAway === "away");
				return {
					gameId: e.id,
					homeTeamId: home?.team.id ?? "",
					awayTeamId: away?.team.id ?? "",
				};
			})
			.filter(g => g.homeTeamId && g.awayTeamId);

		return { games: completedGames };
	},
});

// Types for API responses
interface BoxScorePlayerData {
	athlete: {
		id: string;
		displayName?: string;
	};
	stats: string[];
	starter?: boolean;
}

interface BoxScorePlayerCategory {
	names: string[];
	athletes: BoxScorePlayerData[];
}

interface BoxScoreTeamPlayers {
	team: { id: string };
	statistics?: BoxScorePlayerCategory[];
}

interface BoxScoreTeam {
	team: {
		id: string;
		name?: string;
		abbreviation?: string;
	};
	statistics?: Array<{ name: string; displayValue: string }>;
}

interface HeaderCompetitor {
	team: { id: string };
	homeAway: "home" | "away";
	score: string;
	winner?: boolean;
}

interface GameSummaryResponse {
	header?: {
		competitions?: Array<{
			competitors?: HeaderCompetitor[];
		}>;
	};
	boxscore?: {
		teams?: BoxScoreTeam[];
		players?: BoxScoreTeamPlayers[];
	};
}

// Internal action to fetch a single game's box score
export const fetchGameBoxScore = internalAction({
	args: {
		league: leagueValidator,
		gameId: v.string(),
		gameDate: v.string(),
	},
	handler: async (ctx, args): Promise<{
		teams: RawTeamGame[];
		players: RawPlayerGame[];
	}> => {
		const { league, gameId, gameDate } = args;

		const apiEnvVar = SITE_API_VARS[league as League];
		const baseUrl = process.env[apiEnvVar];
		if (!baseUrl) {
			throw new Error(`${apiEnvVar} not configured`);
		}

		const response = await fetch(`${baseUrl}/summary?event=${gameId}`, {
			headers: { "Content-Type": "application/json" },
		});

		if (!response.ok) {
			if (response.status === 429) {
				throw new Error("Rate limited");
			}
			throw new Error(`Summary API error: ${response.status}`);
		}

		const data = await response.json() as GameSummaryResponse;

		if (!data.boxscore?.teams || data.boxscore.teams.length < 2) {
			return { teams: [], players: [] };
		}

		const teams: RawTeamGame[] = [];
		const players: RawPlayerGame[] = [];

		// Get scores from header competitors (boxscore.teams doesn't have scores)
		const headerCompetitors = data.header?.competitions?.[0]?.competitors ?? [];
		const getScoreAndWinner = (teamId: string): { score: number; winner: boolean; opponentScore: number } => {
			const competitor = headerCompetitors.find(c => c.team.id === teamId);
			const opponent = headerCompetitors.find(c => c.team.id !== teamId);
			return {
				score: parseInt(competitor?.score ?? "0", 10),
				winner: competitor?.winner ?? false,
				opponentScore: parseInt(opponent?.score ?? "0", 10),
			};
		};

		// Process teams
		for (const team of data.boxscore.teams) {
			const stats = team.statistics ?? [];
			const getStat = (name: string): number => {
				const stat = stats.find(s => s.name === name);
				if (!stat) return 0;
				if (stat.displayValue.includes("-")) {
					return parseInt(stat.displayValue.split("-")[0], 10) || 0;
				}
				return parseFloat(stat.displayValue) || 0;
			};

			const getStatParts = (name: string): [number, number] => {
				const stat = stats.find(s => s.name === name);
				if (!stat || !stat.displayValue.includes("-")) return [0, 0];
				const [made, attempted] = stat.displayValue.split("-");
				return [parseInt(made, 10) || 0, parseInt(attempted, 10) || 0];
			};

			const [fgMade, fgAttempted] = getStatParts("fieldGoalsMade-fieldGoalsAttempted");
			const [threeMade, threeAttempted] = getStatParts("threePointFieldGoalsMade-threePointFieldGoalsAttempted");
			const [ftMade, ftAttempted] = getStatParts("freeThrowsMade-freeThrowsAttempted");

			// Get score and winner from header
			const { score: pointsFor, winner: won, opponentScore: pointsAgainst } = getScoreAndWinner(team.team.id);

			teams.push({
				teamId: team.team.id,
				teamName: team.team.name ?? "Unknown",
				abbreviation: team.team.abbreviation ?? "UNK",
				gameDate,
				won,
				pointsFor,
				pointsAgainst,
				fgMade,
				fgAttempted,
				threeMade,
				threeAttempted,
				ftMade,
				ftAttempted,
				rebounds: getStat("totalRebounds"),
				assists: getStat("assists"),
				steals: getStat("steals"),
				blocks: getStat("blocks"),
				turnovers: getStat("turnovers") || getStat("totalTurnovers"),
			});
		}

		// Process players
		const boxscorePlayers = data.boxscore.players ?? [];
		for (const teamPlayers of boxscorePlayers) {
			const teamId = teamPlayers.team.id;
			const statCategory = teamPlayers.statistics?.[0];
			if (!statCategory) continue;

			const statNames = statCategory.names;
			const getIdx = (name: string) => statNames.indexOf(name);

			for (const playerData of statCategory.athletes) {
				const stats = playerData.stats ?? [];
				const minIdx = getIdx("MIN");
				const fgIdx = getIdx("FG");
				const tpIdx = getIdx("3PT");
				const ftIdx = getIdx("FT");
				const rebIdx = getIdx("REB");
				const astIdx = getIdx("AST");
				const stlIdx = getIdx("STL");
				const blkIdx = getIdx("BLK");
				const toIdx = getIdx("TO");
				const ptsIdx = getIdx("PTS");

				const getNum = (idx: number): number => {
					if (idx < 0 || !stats[idx]) return 0;
					return parseInt(stats[idx], 10) || 0;
				};

				const parseFgStat = (idx: number): [number, number] => {
					if (idx < 0 || !stats[idx]) return [0, 0];
					const parts = stats[idx].split("-");
					return [parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0];
				};

				const parseMinutes = (idx: number): number => {
					if (idx < 0 || !stats[idx]) return 0;
					// Minutes can be "32" or "32:45" format
					const val = stats[idx];
					if (val.includes(":")) {
						const [mins, secs] = val.split(":");
						return parseInt(mins, 10) + parseInt(secs, 10) / 60;
					}
					return parseInt(val, 10) || 0;
				};

				const [fgMade, fgAttempted] = parseFgStat(fgIdx);
				const [threeMade, threeAttempted] = parseFgStat(tpIdx);
				const [ftMade, ftAttempted] = parseFgStat(ftIdx);

				players.push({
					playerId: playerData.athlete.id,
					name: playerData.athlete.displayName ?? "Unknown",
					teamId,
					gameDate,
					started: playerData.starter ?? false,
					minutes: parseMinutes(minIdx),
					points: getNum(ptsIdx),
					rebounds: getNum(rebIdx),
					assists: getNum(astIdx),
					steals: getNum(stlIdx),
					blocks: getNum(blkIdx),
					turnovers: getNum(toIdx),
					fgMade,
					fgAttempted,
					threeMade,
					threeAttempted,
					ftMade,
					ftAttempted,
				});
			}
		}

		return { teams, players };
	},
});

// ============================================================================
// SELF-SCHEDULING BACKFILL ACTIONS
// ============================================================================

// Main entry point - initializes backfill and schedules first chunk
export const startBackfill = action({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		const { league } = args;

		// Check admin
		const isAdmin = await ctx.runQuery(internal.admin.internalCheckIsAdmin, {});
		if (!isAdmin) {
			throw new Error("Unauthorized: Admin access required");
		}

		// Check if already running
		const progressData = await ctx.runQuery(api.statsHistory.getBackfillProgress, {});
		const currentProgress = progressData[league];
		if (currentProgress?.status === "collecting" || currentProgress?.status === "fetching" || currentProgress?.status === "processing") {
			throw new Error(`Backfill already in progress for ${league}`);
		}

		// Check if another league is running
		for (const [l, p] of Object.entries(progressData)) {
			const progress = p as { status: string };
			if (l !== league && (progress.status === "collecting" || progress.status === "fetching" || progress.status === "processing")) {
				throw new Error(`Another backfill is in progress (${l}). Wait for it to complete.`);
			}
		}

		// Get date range
		const seasonStart = SEASON_START_DATES[league as League];
		const dates = getDateRange(seasonStart);

		if (dates.length === 0) {
			throw new Error(`${league.toUpperCase()} season hasn't started yet`);
		}

		console.log(`Starting backfill for ${league}: ${dates.length} dates from ${seasonStart}`);

		// Clear any existing backfill data for this league
		await ctx.runMutation(internal.statsHistory.clearBackfillData, { league });

		// Initialize progress with all dates to process
		await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
			league,
			status: "collecting",
			datesToProcess: dates,
			totalGames: 0,
			fetchedGames: 0,
			startedAt: Date.now(),
		});

		// Schedule the first collection chunk
		await ctx.scheduler.runAfter(100, internal.statsHistory.collectGamesChunk, { league });

		return { started: true, totalDates: dates.length };
	},
});

// Collects game IDs from scoreboards - processes DATES_PER_CHUNK dates then schedules itself
export const collectGamesChunk = internalAction({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		const { league } = args;

		// Get current progress
		const progressRecord = await ctx.runQuery(internal.statsHistory.getBackfillProgressRecord, { league });

		if (!progressRecord || progressRecord.status !== "collecting") {
			console.log(`Backfill cancelled or not in collecting state for ${league}`);
			return;
		}

		const datesToProcess = progressRecord.datesToProcess ?? [];
		if (datesToProcess.length === 0) {
			// Done collecting - move to fetching phase
			console.log(`Done collecting games for ${league}, starting fetch phase`);

			const queueStats = await ctx.runMutation(internal.statsHistory.getQueueStats, { league });

			await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
				league,
				status: "fetching",
				totalGames: queueStats.total,
				datesToProcess: [],
			});

			// Schedule first fetch chunk
			await ctx.scheduler.runAfter(DELAY_BETWEEN_CHUNKS_MS, internal.statsHistory.fetchGamesChunk, { league });
			return;
		}

		// Process up to DATES_PER_CHUNK dates
		const datesToFetch = datesToProcess.slice(0, DATES_PER_CHUNK);
		const remainingDates = datesToProcess.slice(DATES_PER_CHUNK);

		let gamesAdded = 0;
		for (const date of datesToFetch) {
			// Update current date in progress
			await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
				league,
				status: "collecting",
				currentDate: date,
				datesToProcess: remainingDates,
			});

			try {
				const result = await ctx.runAction(internal.statsHistory.processBackfillDate, {
					league,
					date,
				});

				if (result.games.length > 0) {
					const addResult = await ctx.runMutation(internal.statsHistory.addGamesToQueue, {
						league,
						games: result.games.map((g: { gameId: string }) => ({ gameId: g.gameId, gameDate: date })),
					});
					gamesAdded += addResult.added;
				}

				// Small delay between scoreboard fetches
				await new Promise(resolve => setTimeout(resolve, 1000));
			} catch (error) {
				console.error(`Error fetching scoreboard for ${date}:`, error);
				// Continue with next date
			}
		}

		console.log(`Collected ${gamesAdded} games from ${datesToFetch.length} dates, ${remainingDates.length} dates remaining`);

		// Update progress with remaining dates
		await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
			league,
			status: "collecting",
			datesToProcess: remainingDates,
		});

		// Schedule next chunk
		await ctx.scheduler.runAfter(DELAY_BETWEEN_CHUNKS_MS, internal.statsHistory.collectGamesChunk, { league });
	},
});

// Fetches game box scores - processes GAMES_PER_CHUNK games then schedules itself
export const fetchGamesChunk = internalAction({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		const { league } = args;

		// Get current progress
		const progressRecord = await ctx.runQuery(internal.statsHistory.getBackfillProgressRecord, { league });

		if (!progressRecord || progressRecord.status !== "fetching") {
			console.log(`Backfill cancelled or not in fetching state for ${league}`);
			return;
		}

		// Get pending games from queue
		const gamesToFetch = await ctx.runMutation(internal.statsHistory.claimGamesFromQueue, {
			league,
			count: GAMES_PER_CHUNK,
		});

		if (gamesToFetch.length === 0) {
			// Done fetching - move to processing phase
			console.log(`Done fetching games for ${league}, starting snapshot generation`);

			await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
				league,
				status: "processing",
			});

			// Schedule snapshot generation
			await ctx.scheduler.runAfter(DELAY_BETWEEN_CHUNKS_MS, internal.statsHistory.generateSnapshotsFromRawData, { league });
			return;
		}

		// Fetch each game's box score
		for (const game of gamesToFetch) {
			try {
				const boxScore = await ctx.runAction(internal.statsHistory.fetchGameBoxScore, {
					league,
					gameId: game.gameId,
					gameDate: game.gameDate,
				});

				// Store raw data and mark as fetched
				await ctx.runMutation(internal.statsHistory.markGameFetchedAndStoreData, {
					queueId: game.id,
					league,
					teams: boxScore.teams,
					players: boxScore.players,
				});

				// Update fetched count
				const queueStats = await ctx.runMutation(internal.statsHistory.getQueueStats, { league });
				await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
					league,
					status: "fetching",
					fetchedGames: queueStats.fetched,
				});

				// 5-second delay between game fetches
				await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_GAMES_MS));

			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : "Unknown error";
				console.error(`Error fetching game ${game.gameId}:`, errorMsg);

				// Mark as failed
				await ctx.runMutation(internal.statsHistory.markGameFailed, { queueId: game.id });

				// If rate limited, stop and mark error
				if (errorMsg.includes("Rate limited") || errorMsg.includes("429")) {
					await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
						league,
						status: "error",
						error: `Rate limited. Resume by starting backfill again.`,
					});
					return;
				}
				// Continue with next game for other errors
			}
		}

		console.log(`Fetched ${gamesToFetch.length} games for ${league}`);

		// Schedule next chunk
		await ctx.scheduler.runAfter(DELAY_BETWEEN_CHUNKS_MS, internal.statsHistory.fetchGamesChunk, { league });
	},
});

// Internal query to get backfill progress record
export const getBackfillProgressRecord = internalQuery({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("backfillProgress")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.unique();
	},
});

// Generate snapshots from stored raw data
export const generateSnapshotsFromRawData = internalAction({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		const { league } = args;

		// Get current progress
		const progressRecord = await ctx.runQuery(internal.statsHistory.getBackfillProgressRecord, { league });

		if (!progressRecord || progressRecord.status !== "processing") {
			console.log(`Backfill cancelled or not in processing state for ${league}`);
			return;
		}

		console.log(`Generating snapshots for ${league} from raw data`);

		// Load all raw team data (should be under 8192 limit)
		const teamGames: RawTeamGame[] = await ctx.runQuery(internal.statsHistory.getAllRawTeamGames, { league });

		// Load raw player data with pagination (can exceed 8192)
		const playerGames: Array<{
			playerId: string;
			name: string;
			teamId: string;
			gameDate: string;
			started: boolean;
			minutes: number;
			points: number;
			rebounds: number;
			assists: number;
			steals: number;
			blocks: number;
			turnovers: number;
			fgMade: number;
			fgAttempted: number;
			threeMade: number;
			threeAttempted: number;
			ftMade: number;
			ftAttempted: number;
		}> = [];

		let cursor: string | null = null;
		let pageNum = 0;
		let isDone = false;
		while (!isDone) {
			const result: {
				page: typeof playerGames;
				isDone: boolean;
				continueCursor: string;
			} = await ctx.runQuery(internal.statsHistory.getRawPlayerGamesPage, { league, cursor });
			playerGames.push(...result.page);
			pageNum++;
			console.log(`Loaded player games page ${pageNum}: ${result.page.length} records (total: ${playerGames.length})`);

			isDone = result.isDone;
			if (!isDone) {
				cursor = result.continueCursor;
			}
		}

		console.log(`Loaded ${teamGames.length} team-games and ${playerGames.length} player-games`);

		if (teamGames.length === 0) {
			console.log(`No team data found for ${league}`);
			await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
				league,
				status: "error",
				error: "No game data collected",
			});
			return;
		}

		// Get all unique week boundaries from season start to now
		const seasonStart = SEASON_START_DATES[league as League];
		const startDate = new Date(
			parseInt(seasonStart.slice(0, 4)),
			parseInt(seasonStart.slice(4, 6)) - 1,
			parseInt(seasonStart.slice(6, 8))
		);

		// Find all week boundaries (Sundays)
		const weeks: number[] = [];
		const current = new Date(startDate);

		// Move to first Sunday
		while (current.getUTCDay() !== 0) {
			current.setDate(current.getDate() + 1);
		}
		current.setUTCHours(0, 0, 0, 0);

		const today = new Date();
		while (current <= today) {
			weeks.push(current.getTime());
			current.setDate(current.getDate() + 7);
		}

		console.log(`Generating snapshots for ${weeks.length} weeks`);

		// For each week, calculate cumulative stats up to that point
		for (const weekStart of weeks) {
			const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000 - 1;
			const weekEndStr = new Date(weekEnd).toISOString().slice(0, 10).replace(/-/g, "");

			// Filter games up to this week
			const teamGamesUpToWeek = teamGames.filter(g => g.gameDate <= weekEndStr);
			const playerGamesUpToWeek = playerGames.filter(g => g.gameDate <= weekEndStr);

			if (teamGamesUpToWeek.length === 0) continue;

			// Group team games by team
			const teamGamesByTeam = new Map<string, typeof teamGames>();
			for (const game of teamGamesUpToWeek) {
				const existing = teamGamesByTeam.get(game.teamId) ?? [];
				existing.push(game);
				teamGamesByTeam.set(game.teamId, existing);
			}

			// Generate team snapshots
			for (const [teamId, games] of teamGamesByTeam) {
				const stats = calculateTeamStats(games);

				await ctx.runMutation(internal.statsHistory.insertTeamSnapshot, {
					league,
					teamId,
					weekStartDate: weekStart,
					wins: stats.wins,
					losses: stats.losses,
					pointsFor: stats.pointsFor,
					pointsAgainst: stats.pointsAgainst,
					pace: stats.pace,
					offensiveRating: stats.offensiveRating,
					defensiveRating: stats.defensiveRating,
					netRating: stats.netRating,
				});
			}

			// Group player games by player
			const playerGamesByPlayer = new Map<string, {
				playerId: string;
				name: string;
				teamId: string;
				games: typeof playerGamesUpToWeek;
			}>();

			for (const game of playerGamesUpToWeek) {
				const existing = playerGamesByPlayer.get(game.playerId);
				if (existing) {
					existing.games.push(game);
					existing.teamId = game.teamId;
					existing.name = game.name;
				} else {
					playerGamesByPlayer.set(game.playerId, {
						playerId: game.playerId,
						name: game.name,
						teamId: game.teamId,
						games: [game],
					});
				}
			}

			// Generate player snapshots
			for (const player of playerGamesByPlayer.values()) {
				let totalMinutes = 0;
				let totalPoints = 0;
				let totalRebounds = 0;
				let totalAssists = 0;
				let totalSteals = 0;
				let totalBlocks = 0;
				let totalTurnovers = 0;
				let totalFgMade = 0;
				let totalFgAttempted = 0;
				let totalThreeMade = 0;
				let totalThreeAttempted = 0;
				let totalFtMade = 0;
				let totalFtAttempted = 0;
				let gamesStarted = 0;

				for (const game of player.games) {
					totalMinutes += game.minutes;
					totalPoints += game.points;
					totalRebounds += game.rebounds;
					totalAssists += game.assists;
					totalSteals += game.steals;
					totalBlocks += game.blocks;
					totalTurnovers += game.turnovers;
					totalFgMade += game.fgMade;
					totalFgAttempted += game.fgAttempted;
					totalThreeMade += game.threeMade;
					totalThreeAttempted += game.threeAttempted;
					totalFtMade += game.ftMade;
					totalFtAttempted += game.ftAttempted;
					if (game.started) gamesStarted++;
				}

				const averages = calculateAverages({
					gamesPlayed: player.games.length,
					gamesStarted,
					totalMinutes,
					totalPoints,
					totalRebounds,
					totalAssists,
					totalSteals,
					totalBlocks,
					totalTurnovers,
					totalFgMade,
					totalFgAttempted,
					totalThreeMade,
					totalThreeAttempted,
					totalFtMade,
					totalFtAttempted,
				});

				await ctx.runMutation(internal.statsHistory.insertPlayerSnapshot, {
					league,
					playerId: player.playerId,
					teamId: player.teamId,
					name: player.name,
					weekStartDate: weekStart,
					...averages,
				});
			}

			console.log(`Generated snapshots for week ${new Date(weekStart).toISOString().slice(0, 10)}`);
		}

		// Mark complete
		await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
			league,
			status: "complete",
			completedAt: Date.now(),
		});

		console.log(`Backfill complete for ${league}`);
	},
});

// Query to get recent games for rolling averages
export const getTeamRecentGames = query({
	args: {
		league: leagueValidator,
		teamId: v.string(),
		limit: v.optional(v.number()), // Default 15 games
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 15;

		const games = await ctx.db
			.query("teamGameLog")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.filter((q) => q.eq(q.field("teamId"), args.teamId))
			.collect();

		// Sort by date descending and take most recent
		const sorted = games
			.sort((a, b) => b.gameDate.localeCompare(a.gameDate))
			.slice(0, limit);

		// Return in chronological order (oldest first)
		return sorted.reverse();
	},
});

// Internal query to get all raw team games
export const getAllRawTeamGames = internalQuery({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("teamGameLog")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.collect();
	},
});

// Internal query to get raw player games with pagination
export const getRawPlayerGamesPage = internalQuery({
	args: {
		league: leagueValidator,
		cursor: v.union(v.string(), v.null()),
	},
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query("playerGameLog")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.paginate({ numItems: 5000, cursor: args.cursor });

		return {
			page: result.page,
			isDone: result.isDone,
			continueCursor: result.continueCursor,
		};
	},
});

// Internal action to resume processing (callable from CLI without auth)
export const internalResumeProcessing = internalAction({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		const { league } = args;

		// Check we have raw data
		const teamGames = await ctx.runQuery(internal.statsHistory.getAllRawTeamGames, { league }) as RawTeamGame[];
		if (teamGames.length === 0) {
			throw new Error("No raw data found. Run full backfill instead.");
		}

		console.log(`Resuming backfill processing for ${league} with ${teamGames.length} team games`);

		// Set status to processing
		await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
			league,
			status: "processing",
		});

		// Schedule snapshot generation
		await ctx.scheduler.runAfter(100, internal.statsHistory.generateSnapshotsFromRawData, { league });

		return { resumed: true, teamGames: teamGames.length };
	},
});

// Action to resume backfill from processing phase (skips collecting and fetching)
export const resumeBackfillProcessing = action({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args): Promise<{ resumed: boolean; teamGames: number }> => {
		const { league } = args;

		// Check admin
		const isAdmin = await ctx.runQuery(internal.admin.internalCheckIsAdmin, {});
		if (!isAdmin) {
			throw new Error("Unauthorized: Admin access required");
		}

		// Check we have raw data
		const teamGames = await ctx.runQuery(internal.statsHistory.getAllRawTeamGames, { league }) as RawTeamGame[];
		if (teamGames.length === 0) {
			throw new Error("No raw data found. Run full backfill instead.");
		}

		console.log(`Resuming backfill processing for ${league} with ${teamGames.length} team games`);

		// Set status to processing
		await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
			league,
			status: "processing",
		});

		// Schedule snapshot generation
		await ctx.scheduler.runAfter(100, internal.statsHistory.generateSnapshotsFromRawData, { league });

		return { resumed: true, teamGames: teamGames.length };
	},
});

// Action to cancel an in-progress backfill
export const cancelBackfill = action({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		const { league } = args;

		// Check admin
		const isAdmin = await ctx.runQuery(internal.admin.internalCheckIsAdmin, {});
		if (!isAdmin) {
			throw new Error("Unauthorized: Admin access required");
		}

		// Clear backfill data
		await ctx.runMutation(internal.statsHistory.clearBackfillData, { league });

		await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
			league,
			status: "idle",
			totalGames: 0,
			fetchedGames: 0,
			datesToProcess: [],
			currentDate: undefined,
			error: undefined,
		});

		return { cancelled: true };
	},
});

// ============================================================================
// SCORE PATCHING (Fix missing scores in raw data using scoreboard endpoint)
// ============================================================================

interface ScoreboardGame {
	gameId: string;
	scores: Map<string, { score: number; winner: boolean; opponentScore: number }>;
}

// Internal action to fetch scores from scoreboard for a single date
export const fetchScoresForDate = internalAction({
	args: {
		league: leagueValidator,
		date: v.string(), // YYYYMMDD
	},
	handler: async (ctx, args): Promise<Array<{ gameId: string; teamId: string; score: number; opponentScore: number; winner: boolean }>> => {
		const { league, date } = args;

		const apiEnvVar = SITE_API_VARS[league as League];
		const baseUrl = process.env[apiEnvVar];
		if (!baseUrl) {
			throw new Error(`${apiEnvVar} not configured`);
		}

		const response = await fetch(`${baseUrl}/scoreboard?dates=${date}`, {
			headers: { "Content-Type": "application/json" },
		});

		if (!response.ok) {
			if (response.status === 429) {
				throw new Error("Rate limited");
			}
			throw new Error(`Scoreboard API error: ${response.status}`);
		}

		const data = await response.json() as {
			events?: Array<{
				id: string;
				status?: { type?: { state?: string } };
				competitions?: Array<{
					competitors?: Array<{
						team: { id: string };
						homeAway: "home" | "away";
						score: string;
						winner?: boolean;
					}>;
				}>;
			}>;
		};

		if (!data.events) {
			return [];
		}

		const results: Array<{ gameId: string; teamId: string; score: number; opponentScore: number; winner: boolean }> = [];

		for (const event of data.events) {
			// Only process completed games
			if (event.status?.type?.state !== "post") continue;

			const competitors = event.competitions?.[0]?.competitors ?? [];
			if (competitors.length < 2) continue;

			for (const competitor of competitors) {
				const opponent = competitors.find(c => c.team.id !== competitor.team.id);
				results.push({
					gameId: event.id,
					teamId: competitor.team.id,
					score: parseInt(competitor.score, 10) || 0,
					opponentScore: parseInt(opponent?.score ?? "0", 10) || 0,
					winner: competitor.winner ?? false,
				});
			}
		}

		return results;
	},
});

// Internal mutation to update scores in raw team game data
export const patchRawGameScores = internalMutation({
	args: {
		league: leagueValidator,
		updates: v.array(v.object({
			teamId: v.string(),
			gameDate: v.string(),
			pointsFor: v.number(),
			pointsAgainst: v.number(),
			won: v.boolean(),
		})),
	},
	handler: async (ctx, args) => {
		let updated = 0;
		let notFound = 0;

		for (const update of args.updates) {
			// Find the raw game record using the more selective by_league_team index
			const records = await ctx.db
				.query("teamGameLog")
				.withIndex("by_league_team", (q) =>
					q.eq("league", args.league).eq("teamId", update.teamId)
				)
				.filter((q) => q.eq(q.field("gameDate"), update.gameDate))
				.collect();

			if (records.length > 0) {
				await ctx.db.patch(records[0]._id, {
					pointsFor: update.pointsFor,
					pointsAgainst: update.pointsAgainst,
					won: update.won,
				});
				updated++;
			} else {
				notFound++;
			}
		}

		return { updated, notFound };
	},
});

// Internal query to get unique game dates from raw data
export const getRawGameDates = internalQuery({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		const games = await ctx.db
			.query("teamGameLog")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.collect();

		const dates = new Set(games.map(g => g.gameDate));
		return Array.from(dates).sort();
	},
});

// Admin action to patch all scores and regenerate snapshots
export const patchScoresAndRegenerate = action({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args): Promise<{ datesProcessed: number; recordsUpdated: number; recordsNotFound: number }> => {
		const { league } = args;

		// Check admin
		const isAdmin = await ctx.runQuery(internal.admin.internalCheckIsAdmin, {});
		if (!isAdmin) {
			throw new Error("Unauthorized: Admin access required");
		}

		console.log(`Starting score patching for ${league}`);

		// Get all unique dates from raw data
		const dates: string[] = await ctx.runQuery(internal.statsHistory.getRawGameDates, { league });
		console.log(`Found ${dates.length} dates to process`);

		if (dates.length === 0) {
			throw new Error("No raw game data found. Run full backfill first.");
		}

		let totalUpdated = 0;
		let totalNotFound = 0;

		// Process each date
		for (let i = 0; i < dates.length; i++) {
			const date = dates[i];
			console.log(`Processing date ${i + 1}/${dates.length}: ${date}`);

			try {
				// Fetch scores from scoreboard
				const scores = await ctx.runAction(internal.statsHistory.fetchScoresForDate, {
					league,
					date,
				});

				if (scores.length > 0) {
					// Update raw data
					const result = await ctx.runMutation(internal.statsHistory.patchRawGameScores, {
						league,
						updates: scores.map((s: { teamId: string; score: number; opponentScore: number; winner: boolean }) => ({
							teamId: s.teamId,
							gameDate: date,
							pointsFor: s.score,
							pointsAgainst: s.opponentScore,
							won: s.winner,
						})),
					});

					totalUpdated += result.updated;
					totalNotFound += result.notFound;
				}

				// Small delay to be nice to the API
				await new Promise(resolve => setTimeout(resolve, 500));

			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : "Unknown error";
				console.error(`Error processing date ${date}:`, errorMsg);

				if (errorMsg.includes("Rate limited") || errorMsg.includes("429")) {
					throw new Error(`Rate limited at date ${date}. Processed ${i}/${dates.length} dates. Try again later.`);
				}
			}
		}

		console.log(`Score patching complete: ${totalUpdated} updated, ${totalNotFound} not found`);

		// Clear existing snapshots for this league before regenerating
		await ctx.runMutation(internal.statsHistory.clearLeagueSnapshots, { league });

		// Regenerate snapshots
		console.log("Regenerating snapshots...");
		await ctx.runAction(internal.statsHistory.generateSnapshotsFromRawData, { league });

		return {
			datesProcessed: dates.length,
			recordsUpdated: totalUpdated,
			recordsNotFound: totalNotFound,
		};
	},
});

// Internal action to patch scores (callable from CLI without auth)
export const internalPatchScores = internalAction({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args): Promise<{ datesProcessed: number; recordsUpdated: number; recordsNotFound: number }> => {
		const { league } = args;

		console.log(`Starting score patching for ${league}`);

		// Get all unique dates from raw data
		const dates: string[] = await ctx.runQuery(internal.statsHistory.getRawGameDates, { league });
		console.log(`Found ${dates.length} dates to process`);

		if (dates.length === 0) {
			throw new Error("No raw game data found. Run full backfill first.");
		}

		let totalUpdated = 0;
		let totalNotFound = 0;

		// Process each date
		for (let i = 0; i < dates.length; i++) {
			const date = dates[i];
			if (i % 10 === 0) {
				console.log(`Processing date ${i + 1}/${dates.length}: ${date}`);
			}

			try {
				// Fetch scores from scoreboard
				const scores = await ctx.runAction(internal.statsHistory.fetchScoresForDate, {
					league,
					date,
				});

				if (scores.length > 0) {
					// Update raw data
					const result = await ctx.runMutation(internal.statsHistory.patchRawGameScores, {
						league,
						updates: scores.map((s: { teamId: string; score: number; opponentScore: number; winner: boolean }) => ({
							teamId: s.teamId,
							gameDate: date,
							pointsFor: s.score,
							pointsAgainst: s.opponentScore,
							won: s.winner,
						})),
					});

					totalUpdated += result.updated;
					totalNotFound += result.notFound;
				}

				// Small delay to be nice to the API
				await new Promise(resolve => setTimeout(resolve, 500));

			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : "Unknown error";
				console.error(`Error processing date ${date}:`, errorMsg);

				if (errorMsg.includes("Rate limited") || errorMsg.includes("429")) {
					throw new Error(`Rate limited at date ${date}. Processed ${i}/${dates.length} dates. Try again later.`);
				}
			}
		}

		console.log(`Score patching complete: ${totalUpdated} updated, ${totalNotFound} not found`);

		// Clear existing snapshots for this league before regenerating (batched for large datasets)
		console.log("Clearing old team snapshots...");
		await ctx.runMutation(internal.statsHistory.clearLeagueSnapshots, { league });

		console.log("Clearing old player snapshots...");
		await ctx.runAction(internal.statsHistory.clearAllPlayerSnapshots, { league });

		// Regenerate snapshots
		console.log("Regenerating snapshots...");
		await ctx.runAction(internal.statsHistory.generateSnapshotsFromRawData, { league });

		return {
			datesProcessed: dates.length,
			recordsUpdated: totalUpdated,
			recordsNotFound: totalNotFound,
		};
	},
});

// Internal mutation to clear snapshots for a league in batches
export const clearLeagueSnapshots = internalMutation({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		// Delete team stats history for this league (smaller dataset)
		const teamSnapshots = await ctx.db
			.query("teamStatsHistory")
			.withIndex("by_league_team", (q) => q.eq("league", args.league))
			.collect();
		for (const snapshot of teamSnapshots) {
			await ctx.db.delete(snapshot._id);
		}

		console.log(`Cleared ${teamSnapshots.length} team snapshots for ${args.league}`);
		return { teamsDeleted: teamSnapshots.length, playersDeleted: 0 };
	},
});

// Internal mutation to clear player snapshots in batches
export const clearPlayerSnapshotsBatch = internalMutation({
	args: {
		league: leagueValidator,
		batchSize: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const batchSize = args.batchSize ?? 500;

		// Get a batch of player snapshots
		const playerSnapshots = await ctx.db
			.query("playerStatsHistory")
			.withIndex("by_league_week", (q) => q.eq("league", args.league))
			.take(batchSize);

		for (const snapshot of playerSnapshots) {
			await ctx.db.delete(snapshot._id);
		}

		return { deleted: playerSnapshots.length, hasMore: playerSnapshots.length === batchSize };
	},
});

// Internal action to clear all player snapshots for a league
export const clearAllPlayerSnapshots = internalAction({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		let totalDeleted = 0;
		let hasMore = true;

		while (hasMore) {
			const result = await ctx.runMutation(internal.statsHistory.clearPlayerSnapshotsBatch, {
				league: args.league,
				batchSize: 500,
			});
			totalDeleted += result.deleted;
			hasMore = result.hasMore;

			if (hasMore) {
				console.log(`Cleared ${totalDeleted} player snapshots so far...`);
			}
		}

		console.log(`Cleared ${totalDeleted} total player snapshots for ${args.league}`);
		return { totalDeleted };
	},
});

// ============================================================================
// RETRY FAILED GAMES
// ============================================================================

// Internal mutation to reset failed games to pending
export const resetFailedGamesToPending = internalMutation({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		const failedGames = await ctx.db
			.query("backfillGameQueue")
			.withIndex("by_league_status", (q) => q.eq("league", args.league).eq("status", "failed"))
			.collect();

		for (const game of failedGames) {
			await ctx.db.patch(game._id, { status: "pending" as const });
		}

		return { reset: failedGames.length };
	},
});

// Internal action to find missing games by scanning scoreboard
export const findMissingGames = internalAction({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args): Promise<{
		missingGames: Array<{ date: string; gameId: string; teams: string[] }>;
		teamsAffected: Record<string, number>;
	}> => {
		const { league } = args;

		// Get all games we have
		const existingGames = await ctx.runQuery(internal.statsHistory.getAllRawTeamGames, { league });

		// Build a set of gameId+teamId combinations we have
		const existingSet = new Set<string>();
		const gameIdSet = new Set<string>();
		for (const game of existingGames) {
			existingSet.add(`${game.gameDate}-${game.teamId}`);
		}

		// Get unique dates from our data
		const dates = [...new Set(existingGames.map(g => g.gameDate))].sort();

		const missingGames: Array<{ date: string; gameId: string; teams: string[] }> = [];
		const teamsAffected: Record<string, number> = {};

		// Check each date against the scoreboard
		for (let i = 0; i < dates.length; i++) {
			const date = dates[i];
			if (i % 20 === 0) {
				console.log(`Scanning date ${i + 1}/${dates.length}: ${date}`);
			}

			try {
				const scores = await ctx.runAction(internal.statsHistory.fetchScoresForDate, {
					league,
					date,
				});

				// Group by gameId
				const gameTeams: Record<string, string[]> = {};
				for (const score of scores) {
					if (!gameTeams[score.gameId]) {
						gameTeams[score.gameId] = [];
					}
					gameTeams[score.gameId].push(score.teamId);
				}

				// Check each game
				for (const [gameId, teamIds] of Object.entries(gameTeams)) {
					for (const teamId of teamIds) {
						if (!existingSet.has(`${date}-${teamId}`)) {
							// This team is missing for this date
							if (!missingGames.find(m => m.gameId === gameId)) {
								missingGames.push({ date, gameId, teams: teamIds });
							}
							teamsAffected[teamId] = (teamsAffected[teamId] || 0) + 1;
						}
					}
				}

				// Small delay
				await new Promise(resolve => setTimeout(resolve, 300));
			} catch (error) {
				console.error(`Error checking date ${date}:`, error);
			}
		}

		console.log(`Found ${missingGames.length} missing games`);
		return { missingGames, teamsAffected };
	},
});

// Internal action to retry failed games
export const retryFailedGames = internalAction({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args): Promise<{ message: string; count?: number }> => {
		const { league } = args;

		// Reset failed games to pending
		const resetResult = await ctx.runMutation(internal.statsHistory.resetFailedGamesToPending, { league });
		console.log(`Reset ${resetResult.reset} failed games to pending for ${league}`);

		if (resetResult.reset === 0) {
			return { message: "No failed games to retry" };
		}

		// Set backfill status to fetching
		await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
			league,
			status: "fetching",
		});

		// Schedule fetch chunk to process them
		await ctx.scheduler.runAfter(100, internal.statsHistory.fetchGamesChunk, { league });

		return { message: `Retrying ${resetResult.reset} failed games`, count: resetResult.reset };
	},
});

// Internal action to add and process missing games
export const addAndProcessMissingGames = internalAction({
	args: {
		league: leagueValidator,
		games: v.array(v.object({
			gameId: v.string(),
			gameDate: v.string(),
		})),
	},
	handler: async (ctx, args): Promise<{ added: number; message: string }> => {
		const { league, games } = args;

		console.log(`Adding ${games.length} missing games for ${league.toUpperCase()}...`);

		// Add games to the queue
		const result = await ctx.runMutation(internal.statsHistory.addGamesToQueue, {
			league,
			games,
		});

		console.log(`Added ${result.added} games to queue`);

		if (result.added === 0) {
			return { added: 0, message: "All games already in queue" };
		}

		// Update progress
		await ctx.runMutation(internal.statsHistory.updateBackfillProgress, {
			league,
			status: "fetching",
		});

		// Start processing
		await ctx.scheduler.runAfter(100, internal.statsHistory.fetchGamesChunk, { league });

		return { added: result.added, message: `Added ${result.added} games and started processing` };
	},
});

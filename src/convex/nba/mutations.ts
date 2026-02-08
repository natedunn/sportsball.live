import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { computeTeamEventAdvancedStats, round } from "../shared/statsCalculations";

// Event status validator (must match schema)
const eventStatusValidator = v.union(
	v.literal("scheduled"),
	v.literal("in_progress"),
	v.literal("halftime"),
	v.literal("end_of_period"),
	v.literal("overtime"),
	v.literal("completed"),
	v.literal("postponed"),
	v.literal("cancelled"),
);

// Upsert a team by espnTeamId + season
export const upsertTeam = internalMutation({
	args: {
		espnTeamId: v.string(),
		season: v.string(),
		name: v.string(),
		abbreviation: v.string(),
		location: v.string(),
		slug: v.string(),
		conference: v.optional(v.string()),
		division: v.optional(v.string()),
		conferenceRank: v.optional(v.number()),
		divisionRank: v.optional(v.number()),
		wins: v.number(),
		losses: v.number(),
		winPct: v.optional(v.number()),
		streak: v.optional(v.string()),
		homeRecord: v.optional(v.string()),
		awayRecord: v.optional(v.string()),
		gamesBack: v.optional(v.string()),
		last10: v.optional(v.string()),
		divisionRecord: v.optional(v.string()),
		conferenceRecord: v.optional(v.string()),
		pointsFor: v.optional(v.number()),
		pointsAgainst: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("nbaTeam")
			.withIndex("by_espnTeamId_season", (q) =>
				q.eq("espnTeamId", args.espnTeamId).eq("season", args.season),
			)
			.unique();

		const data = {
			...args,
			updatedAt: Date.now(),
		};

		if (existing) {
			await ctx.db.patch(existing._id, data);
			return existing._id;
		} else {
			return await ctx.db.insert("nbaTeam", data);
		}
	},
});

// Upsert a player by espnPlayerId + season
export const upsertPlayer = internalMutation({
	args: {
		espnPlayerId: v.string(),
		season: v.string(),
		teamId: v.id("nbaTeam"),
		name: v.string(),
		firstName: v.optional(v.string()),
		lastName: v.optional(v.string()),
		jersey: v.optional(v.string()),
		position: v.optional(v.string()),
		headshot: v.optional(v.string()),
		height: v.optional(v.string()),
		weight: v.optional(v.string()),
		age: v.optional(v.number()),
		experience: v.optional(v.string()),
		college: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("nbaPlayer")
			.withIndex("by_espnPlayerId_season", (q) =>
				q.eq("espnPlayerId", args.espnPlayerId).eq("season", args.season),
			)
			.unique();

		const data = {
			...args,
			updatedAt: Date.now(),
		};

		if (existing) {
			await ctx.db.patch(existing._id, data);
			return existing._id;
		} else {
			return await ctx.db.insert("nbaPlayer", data);
		}
	},
});

// Upsert a game event by espnGameId
export const upsertGameEvent = internalMutation({
	args: {
		espnGameId: v.string(),
		season: v.string(),
		homeTeamId: v.id("nbaTeam"),
		awayTeamId: v.id("nbaTeam"),
		gameDate: v.string(),
		scheduledStart: v.number(),
		eventStatus: eventStatusValidator,
		statusDetail: v.optional(v.string()),
		venue: v.optional(v.string()),
		homeScore: v.optional(v.number()),
		awayScore: v.optional(v.number()),
		lastFetchedAt: v.optional(v.number()),
		checkCount: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("nbaGameEvent")
			.withIndex("by_espnGameId", (q) => q.eq("espnGameId", args.espnGameId))
			.unique();

		const data = {
			...args,
			updatedAt: Date.now(),
		};

		if (existing) {
			await ctx.db.patch(existing._id, data);
			return existing._id;
		} else {
			return await ctx.db.insert("nbaGameEvent", data);
		}
	},
});

// Upsert a team event (box score) by gameEventId + teamId
export const upsertTeamEvent = internalMutation({
	args: {
		gameEventId: v.id("nbaGameEvent"),
		teamId: v.id("nbaTeam"),
		isHome: v.boolean(),
		score: v.number(),
		oppScore: v.number(), // needed for advanced stats calculation, not stored
		winner: v.optional(v.boolean()),
		fieldGoalsMade: v.number(),
		fieldGoalsAttempted: v.number(),
		fieldGoalPct: v.number(),
		threePointMade: v.number(),
		threePointAttempted: v.number(),
		threePointPct: v.number(),
		freeThrowsMade: v.number(),
		freeThrowsAttempted: v.number(),
		freeThrowPct: v.number(),
		totalRebounds: v.number(),
		offensiveRebounds: v.number(),
		defensiveRebounds: v.number(),
		assists: v.number(),
		steals: v.number(),
		blocks: v.number(),
		turnovers: v.number(),
		fouls: v.number(),
		pointsInPaint: v.optional(v.number()),
		fastBreakPoints: v.optional(v.number()),
		largestLead: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// Compute advanced stats
		const advanced = computeTeamEventAdvancedStats({
			score: args.score,
			oppScore: args.oppScore,
			fga: args.fieldGoalsAttempted,
			fta: args.freeThrowsAttempted,
			oreb: args.offensiveRebounds,
			tov: args.turnovers,
			fgMade: args.fieldGoalsMade,
			threeMade: args.threePointMade,
		});

		// Don't store oppScore
		const { oppScore, ...rest } = args;

		const existing = await ctx.db
			.query("nbaTeamEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", args.gameEventId))
			.collect()
			.then((events) => events.find((e) => e.teamId === args.teamId));

		const data = {
			...rest,
			pace: round(advanced.pace, 1),
			offensiveRating: round(advanced.offensiveRating, 1),
			defensiveRating: round(advanced.defensiveRating, 1),
			netRating: round(advanced.netRating, 1),
			efgPct: round(advanced.efgPct, 1),
			tsPct: round(advanced.tsPct, 1),
			updatedAt: Date.now(),
		};

		if (existing) {
			await ctx.db.patch(existing._id, data);
			return existing._id;
		} else {
			return await ctx.db.insert("nbaTeamEvent", data);
		}
	},
});

// Upsert a player event (box score) by gameEventId + playerId
export const upsertPlayerEvent = internalMutation({
	args: {
		gameEventId: v.id("nbaGameEvent"),
		teamId: v.id("nbaTeam"),
		playerId: v.id("nbaPlayer"),
		starter: v.boolean(),
		active: v.boolean(),
		minutes: v.number(),
		points: v.number(),
		totalRebounds: v.number(),
		offensiveRebounds: v.number(),
		defensiveRebounds: v.number(),
		assists: v.number(),
		steals: v.number(),
		blocks: v.number(),
		turnovers: v.number(),
		fouls: v.number(),
		fieldGoalsMade: v.number(),
		fieldGoalsAttempted: v.number(),
		threePointMade: v.number(),
		threePointAttempted: v.number(),
		freeThrowsMade: v.number(),
		freeThrowsAttempted: v.number(),
		plusMinus: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("nbaPlayerEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", args.gameEventId))
			.collect()
			.then((events) => events.find((e) => e.playerId === args.playerId));

		const data = {
			...args,
			updatedAt: Date.now(),
		};

		if (existing) {
			await ctx.db.patch(existing._id, data);
			return existing._id;
		} else {
			return await ctx.db.insert("nbaPlayerEvent", data);
		}
	},
});

// Recalculate seasonal averages for a team from all nbaTeamEvent rows
export const recalculateTeamAverages = internalMutation({
	args: { teamId: v.id("nbaTeam") },
	handler: async (ctx, args) => {
		const events = await ctx.db
			.query("nbaTeamEvent")
			.withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
			.collect();

		if (events.length === 0) return;

		const gamesPlayed = events.length;

		// Sum totals
		let totalFgMade = 0, totalFgAttempted = 0;
		let totalThreeMade = 0, totalThreeAttempted = 0;
		let totalFtMade = 0, totalFtAttempted = 0;
		let totalRebounds = 0, totalOreb = 0, totalDreb = 0;
		let totalAssists = 0, totalTov = 0;
		let totalSteals = 0, totalBlocks = 0;
		let totalPoints = 0, totalOppPoints = 0;
		let totalPace = 0;

		for (const e of events) {
			totalFgMade += e.fieldGoalsMade;
			totalFgAttempted += e.fieldGoalsAttempted;
			totalThreeMade += e.threePointMade;
			totalThreeAttempted += e.threePointAttempted;
			totalFtMade += e.freeThrowsMade;
			totalFtAttempted += e.freeThrowsAttempted;
			totalRebounds += e.totalRebounds;
			totalOreb += e.offensiveRebounds;
			totalDreb += e.defensiveRebounds;
			totalAssists += e.assists;
			totalTov += e.turnovers;
			totalSteals += e.steals;
			totalBlocks += e.blocks;
			totalPoints += e.score;
			totalPace += e.pace ?? 0;

			// Get opponent score from game event
			// We need the game to get opponent score for computing team-level defensive stats
			// Since oppScore isn't stored on TeamEvent, we derive from ORtg/DRtg
			if (e.offensiveRating && e.defensiveRating && e.pace) {
				totalOppPoints += (e.defensiveRating / 100) * e.pace;
			}
		}

		const ppg = round(totalPoints / gamesPlayed, 1);
		const oppPpg = round(totalOppPoints / gamesPlayed, 1);
		const avgPace = round(totalPace / gamesPlayed, 1);

		// Compute average ratings from totals
		const ortg = avgPace > 0 ? round((ppg / avgPace) * 100, 1) : 0;
		const drtg = avgPace > 0 ? round((oppPpg / avgPace) * 100, 1) : 0;

		const fgPct = totalFgAttempted > 0 ? round((totalFgMade / totalFgAttempted) * 100, 1) : 0;
		const threePct = totalThreeAttempted > 0 ? round((totalThreeMade / totalThreeAttempted) * 100, 1) : 0;
		const ftPct = totalFtAttempted > 0 ? round((totalFtMade / totalFtAttempted) * 100, 1) : 0;
		const efgPct = totalFgAttempted > 0 ? round(((totalFgMade + 0.5 * totalThreeMade) / totalFgAttempted) * 100, 1) : 0;
		const tsTsa = 2 * (totalFgAttempted + 0.44 * totalFtAttempted);
		const tsPct = tsTsa > 0 ? round((totalPoints / tsTsa) * 100, 1) : 0;

		const astToRatio = totalTov > 0 ? round((totalAssists / gamesPlayed) / (totalTov / gamesPlayed), 2) : 0;

		await ctx.db.patch(args.teamId, {
			pointsFor: ppg,
			pointsAgainst: oppPpg,
			margin: round(ppg - oppPpg, 1),
			pace: avgPace,
			offensiveRating: ortg,
			defensiveRating: drtg,
			netRating: round(ortg - drtg, 1),
			fgPct,
			threePct,
			ftPct,
			efgPct,
			tsPct,
			rpg: round(totalRebounds / gamesPlayed, 1),
			orpg: round(totalOreb / gamesPlayed, 1),
			drpg: round(totalDreb / gamesPlayed, 1),
			apg: round(totalAssists / gamesPlayed, 1),
			tovPg: round(totalTov / gamesPlayed, 1),
			astToRatio,
			spg: round(totalSteals / gamesPlayed, 1),
			bpg: round(totalBlocks / gamesPlayed, 1),
			totalFgMade,
			totalFgAttempted,
			totalThreeMade,
			totalThreeAttempted,
			totalFtMade,
			totalFtAttempted,
			updatedAt: Date.now(),
		});
	},
});

// Recalculate seasonal averages for a player from all nbaPlayerEvent rows
export const recalculatePlayerAverages = internalMutation({
	args: { playerId: v.id("nbaPlayer") },
	handler: async (ctx, args) => {
		const events = await ctx.db
			.query("nbaPlayerEvent")
			.withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
			.collect();

		if (events.length === 0) return;

		const activeEvents = events.filter((e) => e.active && e.minutes > 0);
		const gamesPlayed = activeEvents.length;
		const gamesStarted = activeEvents.filter((e) => e.starter).length;

		if (gamesPlayed === 0) return;

		let totalMinutes = 0, totalPoints = 0;
		let totalReb = 0, totalOreb = 0, totalDreb = 0;
		let totalAst = 0, totalStl = 0, totalBlk = 0, totalTov = 0;
		let totalFgMade = 0, totalFgAttempted = 0;
		let totalThreeMade = 0, totalThreeAttempted = 0;
		let totalFtMade = 0, totalFtAttempted = 0;

		for (const e of activeEvents) {
			totalMinutes += e.minutes;
			totalPoints += e.points;
			totalReb += e.totalRebounds;
			totalOreb += e.offensiveRebounds;
			totalDreb += e.defensiveRebounds;
			totalAst += e.assists;
			totalStl += e.steals;
			totalBlk += e.blocks;
			totalTov += e.turnovers;
			totalFgMade += e.fieldGoalsMade;
			totalFgAttempted += e.fieldGoalsAttempted;
			totalThreeMade += e.threePointMade;
			totalThreeAttempted += e.threePointAttempted;
			totalFtMade += e.freeThrowsMade;
			totalFtAttempted += e.freeThrowsAttempted;
		}

		await ctx.db.patch(args.playerId, {
			gamesPlayed,
			gamesStarted,
			minutesPerGame: round(totalMinutes / gamesPlayed, 1),
			pointsPerGame: round(totalPoints / gamesPlayed, 1),
			reboundsPerGame: round(totalReb / gamesPlayed, 1),
			assistsPerGame: round(totalAst / gamesPlayed, 1),
			stealsPerGame: round(totalStl / gamesPlayed, 1),
			blocksPerGame: round(totalBlk / gamesPlayed, 1),
			turnoversPerGame: round(totalTov / gamesPlayed, 1),
			fieldGoalPct: totalFgAttempted > 0 ? round((totalFgMade / totalFgAttempted) * 100, 1) : 0,
			threePointPct: totalThreeAttempted > 0 ? round((totalThreeMade / totalThreeAttempted) * 100, 1) : 0,
			freeThrowPct: totalFtAttempted > 0 ? round((totalFtMade / totalFtAttempted) * 100, 1) : 0,
			offRebPerGame: round(totalOreb / gamesPlayed, 1),
			defRebPerGame: round(totalDreb / gamesPlayed, 1),
			totalFgMade,
			totalFgAttempted,
			totalThreeMade,
			totalThreeAttempted,
			totalFtMade,
			totalFtAttempted,
			updatedAt: Date.now(),
		});
	},
});

// Update league rankings for all teams in a season
export const updateLeagueRankings = internalMutation({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		const teams = await ctx.db
			.query("nbaTeam")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();

		// Filter to teams with valid data
		const validTeams = teams.filter((t) => (t.offensiveRating ?? 0) > 0);

		if (validTeams.length === 0) return;

		// Helper to get rank (1-indexed)
		const getRank = (sorted: typeof validTeams, team: typeof validTeams[0]) =>
			sorted.findIndex((t) => t._id === team._id) + 1;

		const getRankOptional = (
			sorted: typeof validTeams,
			team: typeof validTeams[0],
			hasValue: (t: typeof team) => boolean,
		) => {
			if (!hasValue(team)) return undefined;
			const teamsWithStat = sorted.filter(hasValue);
			const idx = teamsWithStat.findIndex((t) => t._id === team._id);
			return idx >= 0 ? idx + 1 : undefined;
		};

		const hasStat = (val: number | undefined) => val !== undefined && val > 0;

		// Sort arrays for each stat
		const byPpg = [...validTeams].sort((a, b) => (b.pointsFor ?? 0) - (a.pointsFor ?? 0));
		const byOppPpg = [...validTeams].sort((a, b) => (a.pointsAgainst ?? 0) - (b.pointsAgainst ?? 0));
		const byMargin = [...validTeams].sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));
		const byPace = [...validTeams].sort((a, b) => (b.pace ?? 0) - (a.pace ?? 0));
		const byOrtg = [...validTeams].sort((a, b) => (b.offensiveRating ?? 0) - (a.offensiveRating ?? 0));
		const byDrtg = [...validTeams].sort((a, b) => (a.defensiveRating ?? 0) - (b.defensiveRating ?? 0));
		const byNetRtg = [...validTeams].sort((a, b) => (b.netRating ?? 0) - (a.netRating ?? 0));
		const byFgPct = [...validTeams].sort((a, b) => (b.fgPct ?? 0) - (a.fgPct ?? 0));
		const byThreePct = [...validTeams].sort((a, b) => (b.threePct ?? 0) - (a.threePct ?? 0));
		const byFtPct = [...validTeams].sort((a, b) => (b.ftPct ?? 0) - (a.ftPct ?? 0));
		const byEfgPct = [...validTeams].sort((a, b) => (b.efgPct ?? 0) - (a.efgPct ?? 0));
		const byTsPct = [...validTeams].sort((a, b) => (b.tsPct ?? 0) - (a.tsPct ?? 0));
		const byRpg = [...validTeams].sort((a, b) => (b.rpg ?? 0) - (a.rpg ?? 0));
		const byOrpg = [...validTeams].sort((a, b) => (b.orpg ?? 0) - (a.orpg ?? 0));
		const byDrpg = [...validTeams].sort((a, b) => (b.drpg ?? 0) - (a.drpg ?? 0));
		const byApg = [...validTeams].sort((a, b) => (b.apg ?? 0) - (a.apg ?? 0));
		const byTov = [...validTeams].sort((a, b) => (a.tovPg ?? 999) - (b.tovPg ?? 999));
		const byAstToRatio = [...validTeams].sort((a, b) => (b.astToRatio ?? 0) - (a.astToRatio ?? 0));
		const bySpg = [...validTeams].sort((a, b) => (b.spg ?? 0) - (a.spg ?? 0));
		const byBpg = [...validTeams].sort((a, b) => (b.bpg ?? 0) - (a.bpg ?? 0));

		for (const team of validTeams) {
			await ctx.db.patch(team._id, {
				rankPpg: getRank(byPpg, team),
				rankOppPpg: getRank(byOppPpg, team),
				rankMargin: getRankOptional(byMargin, team, (t) => t.margin !== undefined),
				rankPace: getRank(byPace, team),
				rankOrtg: getRank(byOrtg, team),
				rankDrtg: getRank(byDrtg, team),
				rankNetRtg: getRank(byNetRtg, team),
				rankFgPct: getRankOptional(byFgPct, team, (t) => hasStat(t.fgPct)),
				rankThreePct: getRankOptional(byThreePct, team, (t) => hasStat(t.threePct)),
				rankFtPct: getRankOptional(byFtPct, team, (t) => hasStat(t.ftPct)),
				rankEfgPct: getRankOptional(byEfgPct, team, (t) => hasStat(t.efgPct)),
				rankTsPct: getRankOptional(byTsPct, team, (t) => hasStat(t.tsPct)),
				rankRpg: getRankOptional(byRpg, team, (t) => hasStat(t.rpg)),
				rankOrpg: getRankOptional(byOrpg, team, (t) => hasStat(t.orpg)),
				rankDrpg: getRankOptional(byDrpg, team, (t) => hasStat(t.drpg)),
				rankApg: getRankOptional(byApg, team, (t) => hasStat(t.apg)),
				rankTov: getRankOptional(byTov, team, (t) => hasStat(t.tovPg)),
				rankAstToRatio: getRankOptional(byAstToRatio, team, (t) => hasStat(t.apg) && hasStat(t.tovPg)),
				rankSpg: getRankOptional(bySpg, team, (t) => hasStat(t.spg)),
				rankBpg: getRankOptional(byBpg, team, (t) => hasStat(t.bpg)),
			});
		}
	},
});

// Update lastFetchedAt on a game event (for throttling)
export const updateGameFetchTimestamp = internalMutation({
	args: { gameEventId: v.id("nbaGameEvent") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.gameEventId, {
			lastFetchedAt: Date.now(),
			updatedAt: Date.now(),
		});
	},
});

// Update game event status and scores
export const updateGameEventStatus = internalMutation({
	args: {
		gameEventId: v.id("nbaGameEvent"),
		eventStatus: eventStatusValidator,
		statusDetail: v.optional(v.string()),
		homeScore: v.optional(v.number()),
		awayScore: v.optional(v.number()),
		checkCount: v.optional(v.number()),
		lastFetchedAt: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { gameEventId, ...updates } = args;
		await ctx.db.patch(gameEventId, {
			...updates,
			updatedAt: Date.now(),
		});
	},
});

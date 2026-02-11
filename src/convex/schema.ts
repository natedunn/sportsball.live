import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { leagueValidator } from "./validators";

// Event status validator shared across all league game event tables
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

export default defineSchema({
	// ============================================================
	// NBA Tables (Convex-first architecture)
	// ============================================================

	// NBA Team — seasonal record + averages
	nbaTeam: defineTable({
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
		// Seasonal averages (computed from nbaTeamEvent)
		pointsFor: v.optional(v.number()),
		pointsAgainst: v.optional(v.number()),
		margin: v.optional(v.number()),
		pace: v.optional(v.number()),
		offensiveRating: v.optional(v.number()),
		defensiveRating: v.optional(v.number()),
		netRating: v.optional(v.number()),
		fgPct: v.optional(v.number()),
		threePct: v.optional(v.number()),
		ftPct: v.optional(v.number()),
		efgPct: v.optional(v.number()),
		tsPct: v.optional(v.number()),
		rpg: v.optional(v.number()),
		orpg: v.optional(v.number()),
		drpg: v.optional(v.number()),
		apg: v.optional(v.number()),
		tovPg: v.optional(v.number()),
		astToRatio: v.optional(v.number()),
		spg: v.optional(v.number()),
		bpg: v.optional(v.number()),
		// Totals (for accurate % calculations from raw data)
		totalFgMade: v.optional(v.number()),
		totalFgAttempted: v.optional(v.number()),
		totalThreeMade: v.optional(v.number()),
		totalThreeAttempted: v.optional(v.number()),
		totalFtMade: v.optional(v.number()),
		totalFtAttempted: v.optional(v.number()),
		// Rankings (computed within league)
		rankPpg: v.optional(v.number()),
		rankOppPpg: v.optional(v.number()),
		rankMargin: v.optional(v.number()),
		rankPace: v.optional(v.number()),
		rankOrtg: v.optional(v.number()),
		rankDrtg: v.optional(v.number()),
		rankNetRtg: v.optional(v.number()),
		rankFgPct: v.optional(v.number()),
		rankThreePct: v.optional(v.number()),
		rankFtPct: v.optional(v.number()),
		rankEfgPct: v.optional(v.number()),
		rankTsPct: v.optional(v.number()),
		rankRpg: v.optional(v.number()),
		rankOrpg: v.optional(v.number()),
		rankDrpg: v.optional(v.number()),
		rankApg: v.optional(v.number()),
		rankTov: v.optional(v.number()),
		rankAstToRatio: v.optional(v.number()),
		rankSpg: v.optional(v.number()),
		rankBpg: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_espnTeamId_season", ["espnTeamId", "season"])
		.index("by_season", ["season"]),

	// NBA Player — seasonal record + averages
	nbaPlayer: defineTable({
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
		// Seasonal averages (computed from nbaPlayerEvent)
		gamesPlayed: v.optional(v.number()),
		gamesStarted: v.optional(v.number()),
		minutesPerGame: v.optional(v.number()),
		pointsPerGame: v.optional(v.number()),
		reboundsPerGame: v.optional(v.number()),
		assistsPerGame: v.optional(v.number()),
		stealsPerGame: v.optional(v.number()),
		blocksPerGame: v.optional(v.number()),
		turnoversPerGame: v.optional(v.number()),
		fieldGoalPct: v.optional(v.number()),
		threePointPct: v.optional(v.number()),
		freeThrowPct: v.optional(v.number()),
		offRebPerGame: v.optional(v.number()),
		defRebPerGame: v.optional(v.number()),
		// Totals (for accurate % calculations)
		totalFgMade: v.optional(v.number()),
		totalFgAttempted: v.optional(v.number()),
		totalThreeMade: v.optional(v.number()),
		totalThreeAttempted: v.optional(v.number()),
		totalFtMade: v.optional(v.number()),
		totalFtAttempted: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_espnPlayerId_season", ["espnPlayerId", "season"])
		.index("by_teamId", ["teamId"])
		.index("by_season", ["season"])
		.index("by_season_pointsPerGame", ["season", "pointsPerGame"])
		.index("by_season_assistsPerGame", ["season", "assistsPerGame"])
		.index("by_season_fieldGoalPct", ["season", "fieldGoalPct"]),

	// NBA Game Event — individual game tracking
	nbaGameEvent: defineTable({
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
		syncLockUntil: v.optional(v.number()),
		checkCount: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_espnGameId", ["espnGameId"])
		.index("by_gameDate", ["gameDate"])
		.index("by_status", ["eventStatus"])
		.index("by_season", ["season"])
		.index("by_homeTeam", ["homeTeamId"])
		.index("by_awayTeam", ["awayTeamId"]),

	// NBA Team Event — one team's box score in one game
	nbaTeamEvent: defineTable({
		gameEventId: v.id("nbaGameEvent"),
		teamId: v.id("nbaTeam"),
		isHome: v.boolean(),
		score: v.number(),
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
		// Computed per-game
		pace: v.optional(v.number()),
		offensiveRating: v.optional(v.number()),
		defensiveRating: v.optional(v.number()),
		netRating: v.optional(v.number()),
		efgPct: v.optional(v.number()),
		tsPct: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_gameEventId", ["gameEventId"])
		.index("by_teamId", ["teamId"]),

	// NBA Player Event — one player's box score in one game
	nbaPlayerEvent: defineTable({
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
		updatedAt: v.number(),
	})
		.index("by_gameEventId", ["gameEventId"])
		.index("by_playerId", ["playerId"])
		.index("by_teamId", ["teamId"]),

	// ============================================================
	// WNBA Tables (same structure, different table/ID references)
	// ============================================================

	wnbaTeam: defineTable({
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
		margin: v.optional(v.number()),
		pace: v.optional(v.number()),
		offensiveRating: v.optional(v.number()),
		defensiveRating: v.optional(v.number()),
		netRating: v.optional(v.number()),
		fgPct: v.optional(v.number()),
		threePct: v.optional(v.number()),
		ftPct: v.optional(v.number()),
		efgPct: v.optional(v.number()),
		tsPct: v.optional(v.number()),
		rpg: v.optional(v.number()),
		orpg: v.optional(v.number()),
		drpg: v.optional(v.number()),
		apg: v.optional(v.number()),
		tovPg: v.optional(v.number()),
		astToRatio: v.optional(v.number()),
		spg: v.optional(v.number()),
		bpg: v.optional(v.number()),
		totalFgMade: v.optional(v.number()),
		totalFgAttempted: v.optional(v.number()),
		totalThreeMade: v.optional(v.number()),
		totalThreeAttempted: v.optional(v.number()),
		totalFtMade: v.optional(v.number()),
		totalFtAttempted: v.optional(v.number()),
		rankPpg: v.optional(v.number()),
		rankOppPpg: v.optional(v.number()),
		rankMargin: v.optional(v.number()),
		rankPace: v.optional(v.number()),
		rankOrtg: v.optional(v.number()),
		rankDrtg: v.optional(v.number()),
		rankNetRtg: v.optional(v.number()),
		rankFgPct: v.optional(v.number()),
		rankThreePct: v.optional(v.number()),
		rankFtPct: v.optional(v.number()),
		rankEfgPct: v.optional(v.number()),
		rankTsPct: v.optional(v.number()),
		rankRpg: v.optional(v.number()),
		rankOrpg: v.optional(v.number()),
		rankDrpg: v.optional(v.number()),
		rankApg: v.optional(v.number()),
		rankTov: v.optional(v.number()),
		rankAstToRatio: v.optional(v.number()),
		rankSpg: v.optional(v.number()),
		rankBpg: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_espnTeamId_season", ["espnTeamId", "season"])
		.index("by_season", ["season"]),

	wnbaPlayer: defineTable({
		espnPlayerId: v.string(),
		season: v.string(),
		teamId: v.id("wnbaTeam"),
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
		gamesPlayed: v.optional(v.number()),
		gamesStarted: v.optional(v.number()),
		minutesPerGame: v.optional(v.number()),
		pointsPerGame: v.optional(v.number()),
		reboundsPerGame: v.optional(v.number()),
		assistsPerGame: v.optional(v.number()),
		stealsPerGame: v.optional(v.number()),
		blocksPerGame: v.optional(v.number()),
		turnoversPerGame: v.optional(v.number()),
		fieldGoalPct: v.optional(v.number()),
		threePointPct: v.optional(v.number()),
		freeThrowPct: v.optional(v.number()),
		offRebPerGame: v.optional(v.number()),
		defRebPerGame: v.optional(v.number()),
		totalFgMade: v.optional(v.number()),
		totalFgAttempted: v.optional(v.number()),
		totalThreeMade: v.optional(v.number()),
		totalThreeAttempted: v.optional(v.number()),
		totalFtMade: v.optional(v.number()),
		totalFtAttempted: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_espnPlayerId_season", ["espnPlayerId", "season"])
		.index("by_teamId", ["teamId"])
		.index("by_season", ["season"])
		.index("by_season_pointsPerGame", ["season", "pointsPerGame"])
		.index("by_season_assistsPerGame", ["season", "assistsPerGame"])
		.index("by_season_fieldGoalPct", ["season", "fieldGoalPct"]),

	wnbaGameEvent: defineTable({
		espnGameId: v.string(),
		season: v.string(),
		homeTeamId: v.id("wnbaTeam"),
		awayTeamId: v.id("wnbaTeam"),
		gameDate: v.string(),
		scheduledStart: v.number(),
		eventStatus: eventStatusValidator,
		statusDetail: v.optional(v.string()),
		venue: v.optional(v.string()),
		homeScore: v.optional(v.number()),
		awayScore: v.optional(v.number()),
		lastFetchedAt: v.optional(v.number()),
		checkCount: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_espnGameId", ["espnGameId"])
		.index("by_gameDate", ["gameDate"])
		.index("by_status", ["eventStatus"])
		.index("by_season", ["season"])
		.index("by_homeTeam", ["homeTeamId"])
		.index("by_awayTeam", ["awayTeamId"]),

	wnbaTeamEvent: defineTable({
		gameEventId: v.id("wnbaGameEvent"),
		teamId: v.id("wnbaTeam"),
		isHome: v.boolean(),
		score: v.number(),
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
		pace: v.optional(v.number()),
		offensiveRating: v.optional(v.number()),
		defensiveRating: v.optional(v.number()),
		netRating: v.optional(v.number()),
		efgPct: v.optional(v.number()),
		tsPct: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_gameEventId", ["gameEventId"])
		.index("by_teamId", ["teamId"]),

	wnbaPlayerEvent: defineTable({
		gameEventId: v.id("wnbaGameEvent"),
		teamId: v.id("wnbaTeam"),
		playerId: v.id("wnbaPlayer"),
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
		updatedAt: v.number(),
	})
		.index("by_gameEventId", ["gameEventId"])
		.index("by_playerId", ["playerId"])
		.index("by_teamId", ["teamId"]),

	// ============================================================
	// G-League Tables (same structure, different table/ID references)
	// ============================================================

	gleagueTeam: defineTable({
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
		margin: v.optional(v.number()),
		pace: v.optional(v.number()),
		offensiveRating: v.optional(v.number()),
		defensiveRating: v.optional(v.number()),
		netRating: v.optional(v.number()),
		fgPct: v.optional(v.number()),
		threePct: v.optional(v.number()),
		ftPct: v.optional(v.number()),
		efgPct: v.optional(v.number()),
		tsPct: v.optional(v.number()),
		rpg: v.optional(v.number()),
		orpg: v.optional(v.number()),
		drpg: v.optional(v.number()),
		apg: v.optional(v.number()),
		tovPg: v.optional(v.number()),
		astToRatio: v.optional(v.number()),
		spg: v.optional(v.number()),
		bpg: v.optional(v.number()),
		totalFgMade: v.optional(v.number()),
		totalFgAttempted: v.optional(v.number()),
		totalThreeMade: v.optional(v.number()),
		totalThreeAttempted: v.optional(v.number()),
		totalFtMade: v.optional(v.number()),
		totalFtAttempted: v.optional(v.number()),
		rankPpg: v.optional(v.number()),
		rankOppPpg: v.optional(v.number()),
		rankMargin: v.optional(v.number()),
		rankPace: v.optional(v.number()),
		rankOrtg: v.optional(v.number()),
		rankDrtg: v.optional(v.number()),
		rankNetRtg: v.optional(v.number()),
		rankFgPct: v.optional(v.number()),
		rankThreePct: v.optional(v.number()),
		rankFtPct: v.optional(v.number()),
		rankEfgPct: v.optional(v.number()),
		rankTsPct: v.optional(v.number()),
		rankRpg: v.optional(v.number()),
		rankOrpg: v.optional(v.number()),
		rankDrpg: v.optional(v.number()),
		rankApg: v.optional(v.number()),
		rankTov: v.optional(v.number()),
		rankAstToRatio: v.optional(v.number()),
		rankSpg: v.optional(v.number()),
		rankBpg: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_espnTeamId_season", ["espnTeamId", "season"])
		.index("by_season", ["season"]),

	gleaguePlayer: defineTable({
		espnPlayerId: v.string(),
		season: v.string(),
		teamId: v.id("gleagueTeam"),
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
		gamesPlayed: v.optional(v.number()),
		gamesStarted: v.optional(v.number()),
		minutesPerGame: v.optional(v.number()),
		pointsPerGame: v.optional(v.number()),
		reboundsPerGame: v.optional(v.number()),
		assistsPerGame: v.optional(v.number()),
		stealsPerGame: v.optional(v.number()),
		blocksPerGame: v.optional(v.number()),
		turnoversPerGame: v.optional(v.number()),
		fieldGoalPct: v.optional(v.number()),
		threePointPct: v.optional(v.number()),
		freeThrowPct: v.optional(v.number()),
		offRebPerGame: v.optional(v.number()),
		defRebPerGame: v.optional(v.number()),
		totalFgMade: v.optional(v.number()),
		totalFgAttempted: v.optional(v.number()),
		totalThreeMade: v.optional(v.number()),
		totalThreeAttempted: v.optional(v.number()),
		totalFtMade: v.optional(v.number()),
		totalFtAttempted: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_espnPlayerId_season", ["espnPlayerId", "season"])
		.index("by_teamId", ["teamId"])
		.index("by_season", ["season"])
		.index("by_season_pointsPerGame", ["season", "pointsPerGame"])
		.index("by_season_assistsPerGame", ["season", "assistsPerGame"])
		.index("by_season_fieldGoalPct", ["season", "fieldGoalPct"]),

	gleagueGameEvent: defineTable({
		espnGameId: v.string(),
		season: v.string(),
		homeTeamId: v.id("gleagueTeam"),
		awayTeamId: v.id("gleagueTeam"),
		gameDate: v.string(),
		scheduledStart: v.number(),
		eventStatus: eventStatusValidator,
		statusDetail: v.optional(v.string()),
		venue: v.optional(v.string()),
		homeScore: v.optional(v.number()),
		awayScore: v.optional(v.number()),
		lastFetchedAt: v.optional(v.number()),
		checkCount: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_espnGameId", ["espnGameId"])
		.index("by_gameDate", ["gameDate"])
		.index("by_status", ["eventStatus"])
		.index("by_season", ["season"])
		.index("by_homeTeam", ["homeTeamId"])
		.index("by_awayTeam", ["awayTeamId"]),

	gleagueTeamEvent: defineTable({
		gameEventId: v.id("gleagueGameEvent"),
		teamId: v.id("gleagueTeam"),
		isHome: v.boolean(),
		score: v.number(),
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
		pace: v.optional(v.number()),
		offensiveRating: v.optional(v.number()),
		defensiveRating: v.optional(v.number()),
		netRating: v.optional(v.number()),
		efgPct: v.optional(v.number()),
		tsPct: v.optional(v.number()),
		updatedAt: v.number(),
	})
		.index("by_gameEventId", ["gameEventId"])
		.index("by_teamId", ["teamId"]),

	gleaguePlayerEvent: defineTable({
		gameEventId: v.id("gleagueGameEvent"),
		teamId: v.id("gleagueTeam"),
		playerId: v.id("gleaguePlayer"),
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
		updatedAt: v.number(),
	})
		.index("by_gameEventId", ["gameEventId"])
		.index("by_playerId", ["playerId"])
		.index("by_teamId", ["teamId"]),

	// ============================================================
	// Bootstrap Status (tracks admin-triggered bootstrap progress per league)
	// ============================================================

	bootstrapStatus: defineTable({
		league: leagueValidator,
		status: v.union(
			v.literal("idle"),
			v.literal("running"),
			v.literal("cancelling"),
			v.literal("completed"),
			v.literal("failed"),
		),
		currentStep: v.optional(v.union(
			v.literal("teams"),
			v.literal("players"),
			v.literal("backfill"),
			v.literal("recalculate"),
		)),
		progress: v.optional(v.string()),
		startedAt: v.optional(v.number()),
		completedAt: v.optional(v.number()),
		error: v.optional(v.string()),
		updatedAt: v.number(),
	})
		.index("by_league", ["league"]),

	// Score anomaly events (for admin visibility and manual re-sync)
	scoreAnomaly: defineTable({
		league: leagueValidator,
		espnGameId: v.string(),
		anomalyType: v.string(),
		source: v.string(),
		message: v.optional(v.string()),
		eventStatus: v.optional(v.string()),
		homeScore: v.optional(v.number()),
		awayScore: v.optional(v.number()),
		rawHomeScore: v.optional(v.string()),
		rawAwayScore: v.optional(v.string()),
		firstSeenAt: v.number(),
		lastSeenAt: v.number(),
		lastResyncedAt: v.optional(v.number()),
		resolvedAt: v.optional(v.number()),
		occurrenceCount: v.number(),
		updatedAt: v.number(),
	})
		.index("by_lastSeenAt", ["lastSeenAt"])
		.index("by_league_lastSeenAt", ["league", "lastSeenAt"])
		.index("by_league_game_type", ["league", "espnGameId", "anomalyType"]),

	// ============================================================
  // Cached images from external CDN
  cachedImages: defineTable({
    originalUrl: v.string(),
    storageId: v.id("_storage"),
    contentType: v.string(),
    cachedAt: v.number(),
    expiresAt: v.number(),
  }).index("by_originalUrl", ["originalUrl"]),

  // Public profile data (synced from Better Auth via triggers)
  // Better Auth manages authentication; this table is for public profile queries
  profile: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerified: v.boolean(),
    username: v.optional(v.string()),
    displayUsername: v.optional(v.string()),
    authUserId: v.optional(v.string()), // Better Auth component's internal user ID (for favorites lookup)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_username", ["username"]),

  // Sessions for Better Auth (managed by component, kept for schema compatibility)
  sessions: defineTable({
    userId: v.id("profile"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_token", ["token"]),

  // User favorite teams
  favoriteTeams: defineTable({
    userId: v.string(), // User ID from Better Auth (stored as string for compatibility)
    league: leagueValidator, // "nba" | "wnba" | "gleague"
    teamId: v.string(), // API provider team ID (e.g., "1")
    teamSlug: v.string(), // For routing (e.g., "atl")
    addedAt: v.number(), // Timestamp
  })
    .index("by_user", ["userId"])
    .index("by_user_league", ["userId", "league"])
    .index("by_user_team", ["userId", "league", "teamId"]),

  // OAuth accounts (managed by Better Auth component, kept for schema compatibility)
  accounts: defineTable({
    userId: v.id("profile"),
    providerId: v.string(),
    accountId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    idToken: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_provider_accountId", ["providerId", "accountId"]),
});

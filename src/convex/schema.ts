import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { leagueValidator } from "./validators";

export default defineSchema({
	// Player stats (updated nightly via cron)
	// Stores stats not available from the roster endpoint (GP, 3P%, minutes, etc.)
	playerStats: defineTable({
		league: leagueValidator,
		playerId: v.string(), // ESPN player ID
		teamId: v.string(), // ESPN team ID
		// Basic info (for display without needing another API call)
		name: v.string(),
		// Season stats
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
		// Metadata
		updatedAt: v.number(),
	})
		.index("by_league", ["league"])
		.index("by_league_team", ["league", "teamId"])
		.index("by_league_player", ["league", "playerId"]),

	// Team stats with calculated ratings (updated nightly)
	// NOTE: Static data (logos, colors) comes from src/lib/teams registry - not stored here
	teamStats: defineTable({
		league: leagueValidator,
		teamId: v.string(),
		teamName: v.string(),
		abbreviation: v.string(),
		wins: v.number(),
		losses: v.number(),
		// Per-game scoring stats
		pointsFor: v.number(), // PPG
		pointsAgainst: v.number(), // OPP PPG
		// Calculated advanced stats
		pace: v.number(), // Possessions per game
		offensiveRating: v.number(), // Points per 100 possessions
		defensiveRating: v.number(), // Points allowed per 100 possessions
		netRating: v.number(), // ORTG - DRTG
		// Derived scoring stats
		margin: v.optional(v.number()), // PPG - OPP PPG
		// Shooting stats
		fgPct: v.optional(v.number()),
		threePct: v.optional(v.number()),
		ftPct: v.optional(v.number()),
		efgPct: v.optional(v.number()), // (FGM + 0.5 * 3PM) / FGA
		tsPct: v.optional(v.number()), // PTS / (2 * (FGA + 0.44 * FTA))
		// Rebounding stats
		rpg: v.optional(v.number()),
		orpg: v.optional(v.number()),
		drpg: v.optional(v.number()),
		// Playmaking stats
		apg: v.optional(v.number()),
		tovPg: v.optional(v.number()),
		// Defense stats
		spg: v.optional(v.number()),
		bpg: v.optional(v.number()),
		// League rankings (calculated during cron update)
		// Scoring ranks
		rankPpg: v.optional(v.number()),
		rankOppPpg: v.optional(v.number()),
		rankMargin: v.optional(v.number()),
		rankPace: v.optional(v.number()),
		rankOrtg: v.optional(v.number()),
		rankDrtg: v.optional(v.number()),
		rankNetRtg: v.optional(v.number()),
		// Shooting ranks
		rankFgPct: v.optional(v.number()),
		rankThreePct: v.optional(v.number()),
		rankFtPct: v.optional(v.number()),
		rankEfgPct: v.optional(v.number()),
		rankTsPct: v.optional(v.number()),
		// Rebounding ranks
		rankRpg: v.optional(v.number()),
		rankOrpg: v.optional(v.number()),
		rankDrpg: v.optional(v.number()),
		// Playmaking ranks
		rankApg: v.optional(v.number()),
		rankTov: v.optional(v.number()),
		rankAstToRatio: v.optional(v.number()),
		// Defense ranks
		rankSpg: v.optional(v.number()),
		rankBpg: v.optional(v.number()),
		// Metadata
		updatedAt: v.number(),
	})
		.index("by_league", ["league"])
		.index("by_league_team", ["league", "teamId"]),

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

  // Game queue for smart player stats polling
  // Tracks games to check for completion and trigger player stats updates
  gameQueue: defineTable({
    league: leagueValidator,
    gameId: v.string(), // ESPN game ID
    homeTeamId: v.string(),
    awayTeamId: v.string(),
    scheduledStart: v.number(), // Unix timestamp (ms)
    firstCheckTime: v.number(), // scheduledStart + 2h15m
    status: v.union(
      v.literal("pending"), // Waiting for first check time
      v.literal("checking"), // Actively being polled
      v.literal("processed"), // Stats fetched, done
      v.literal("abandoned") // Gave up after 5+ hours
    ),
    checkCount: v.number(), // Number of times we've checked
    processedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_league_game", ["league", "gameId"])
    .index("by_first_check_time", ["firstCheckTime"]),

  // Historical team stats snapshots (weekly)
  teamStatsHistory: defineTable({
    league: leagueValidator,
    teamId: v.string(),
    weekStartDate: v.number(), // Unix timestamp of Sunday
    // Snapshot of stats at this point in time
    wins: v.number(),
    losses: v.number(),
    pointsFor: v.number(),
    pointsAgainst: v.number(),
    pace: v.number(),
    offensiveRating: v.number(),
    defensiveRating: v.number(),
    netRating: v.number(),
    // Optional rankings
    rankPpg: v.optional(v.number()),
    rankOppPpg: v.optional(v.number()),
    rankOrtg: v.optional(v.number()),
    rankDrtg: v.optional(v.number()),
    rankNetRtg: v.optional(v.number()),
    // Metadata
    snapshotAt: v.number(),
  })
    .index("by_league_team", ["league", "teamId"])
    .index("by_league_team_week", ["league", "teamId", "weekStartDate"])
    .index("by_league_week", ["league", "weekStartDate"]),

  // Historical player stats snapshots (weekly)
  playerStatsHistory: defineTable({
    league: leagueValidator,
    playerId: v.string(),
    teamId: v.string(),
    name: v.string(),
    weekStartDate: v.number(), // Unix timestamp of Sunday
    // Snapshot of stats
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
    // Metadata
    snapshotAt: v.number(),
  })
    .index("by_league_player", ["league", "playerId"])
    .index("by_league_player_week", ["league", "playerId", "weekStartDate"])
    .index("by_league_team_week", ["league", "teamId", "weekStartDate"])
    .index("by_league_week", ["league", "weekStartDate"]),

  // Backfill progress tracking for historical stats
  backfillProgress: defineTable({
    league: leagueValidator,
    status: v.union(
      v.literal("idle"),
      v.literal("collecting"), // Fetching scoreboards to find games
      v.literal("fetching"),   // Fetching individual game box scores
      v.literal("processing"), // Generating snapshots
      v.literal("complete"),
      v.literal("error")
    ),
    // For collecting phase
    datesToProcess: v.optional(v.array(v.string())), // Remaining dates to check
    currentDate: v.optional(v.string()), // YYYYMMDD being fetched
    // For fetching phase
    totalGames: v.number(),
    fetchedGames: v.number(),
    // Metadata
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_league", ["league"]),

  // Queue of games to fetch during backfill
  backfillGameQueue: defineTable({
    league: leagueValidator,
    gameId: v.string(),
    gameDate: v.string(), // YYYYMMDD
    status: v.union(v.literal("pending"), v.literal("fetched"), v.literal("failed")),
  })
    .index("by_league_status", ["league", "status"])
    .index("by_league_game", ["league", "gameId"]),

  // Game-by-game box score data for teams
  // Used for rolling averages (Last 5, Last 10) and historical analysis
  teamGameLog: defineTable({
    league: leagueValidator,
    teamId: v.string(),
    teamName: v.string(),
    abbreviation: v.string(),
    gameDate: v.string(), // YYYYMMDD format
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
  })
    .index("by_league", ["league"])
    .index("by_league_team", ["league", "teamId"]),

  // Game-by-game box score data for players
  // Used for player game logs and historical analysis
  playerGameLog: defineTable({
    league: leagueValidator,
    playerId: v.string(),
    name: v.string(),
    teamId: v.string(),
    gameDate: v.string(), // YYYYMMDD format
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
  })
    .index("by_league", ["league"])
    .index("by_league_player", ["league", "playerId"])
    .index("by_league_team", ["league", "teamId"]),

  // User favorite teams
  favoriteTeams: defineTable({
    userId: v.string(), // User ID from Better Auth (stored as string for compatibility)
    league: leagueValidator, // "nba" | "wnba" | "gleague"
    teamId: v.string(), // ESPN team ID (e.g., "1")
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

import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";

// Get all games for a specific date (scoreboard)
export const getScoreboard = query({
	args: { gameDate: v.string() },
	handler: async (ctx, args) => {
		const games = await ctx.db
			.query("wnbaGameEvent")
			.withIndex("by_gameDate", (q) => q.eq("gameDate", args.gameDate))
			.collect();

		// Enrich each game with team info
		const enriched = await Promise.all(
			games.map(async (game) => {
				const homeTeam = await ctx.db.get(game.homeTeamId);
				const awayTeam = await ctx.db.get(game.awayTeamId);
				return { ...game, homeTeam, awayTeam };
			}),
		);

		return enriched;
	},
});

// Get full game details (game + team events + player events)
export const getGameDetails = query({
	args: { espnGameId: v.string() },
	handler: async (ctx, args) => {
		const game = await ctx.db
			.query("wnbaGameEvent")
			.withIndex("by_espnGameId", (q) => q.eq("espnGameId", args.espnGameId))
			.unique();

		if (!game) return null;

		// Fetch team events
		const teamEvents = await ctx.db
			.query("wnbaTeamEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", game._id))
			.collect();

		// Fetch player events
		const playerEvents = await ctx.db
			.query("wnbaPlayerEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", game._id))
			.collect();

		// Fetch team info
		const homeTeam = await ctx.db.get(game.homeTeamId);
		const awayTeam = await ctx.db.get(game.awayTeamId);

		const homeTeamEvent = teamEvents.find((te) => te.isHome);
		const awayTeamEvent = teamEvents.find((te) => !te.isHome);

		// Enrich player events with player info
		const enrichPlayerEvents = async (events: typeof playerEvents) => {
			return Promise.all(
				events.map(async (pe) => {
					const player = await ctx.db.get(pe.playerId);
					return { ...pe, player };
				}),
			);
		};

		const homePlayerEvents = await enrichPlayerEvents(
			playerEvents.filter((pe) => pe.teamId === game.homeTeamId),
		);
		const awayPlayerEvents = await enrichPlayerEvents(
			playerEvents.filter((pe) => pe.teamId === game.awayTeamId),
		);

		return {
			game,
			homeTeam,
			awayTeam,
			homeTeamEvent,
			awayTeamEvent,
			homePlayerEvents,
			awayPlayerEvents,
		};
	},
});

// Get a single game event (for throttle checking in sync)
export const getGameEvent = query({
	args: { espnGameId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaGameEvent")
			.withIndex("by_espnGameId", (q) => q.eq("espnGameId", args.espnGameId))
			.unique();
	},
});

// Get team info, record, seasonal averages, ranks
export const getTeam = query({
	args: { espnTeamId: v.string(), season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaTeam")
			.withIndex("by_espnTeamId_season", (q) =>
				q.eq("espnTeamId", args.espnTeamId).eq("season", args.season),
			)
			.unique();
	},
});

// Get all game events for a team (schedule)
export const getTeamSchedule = query({
	args: { teamId: v.id("wnbaTeam") },
	handler: async (ctx, args) => {
		const homeGames = await ctx.db
			.query("wnbaGameEvent")
			.withIndex("by_homeTeam", (q) => q.eq("homeTeamId", args.teamId))
			.collect();

		const awayGames = await ctx.db
			.query("wnbaGameEvent")
			.withIndex("by_awayTeam", (q) => q.eq("awayTeamId", args.teamId))
			.collect();

		const allGames = [...homeGames, ...awayGames].sort(
			(a, b) => a.scheduledStart - b.scheduledStart,
		);

		// Enrich with opponent info
		const enriched = await Promise.all(
			allGames.map(async (game) => {
				const isHome = game.homeTeamId === args.teamId;
				const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
				const opponent = await ctx.db.get(opponentId);
				return { ...game, isHome, opponent };
			}),
		);

		return enriched;
	},
});

// Get all players for a team with averages (roster)
export const getTeamRoster = query({
	args: { teamId: v.id("wnbaTeam") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaPlayer")
			.withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
			.collect();
	},
});

// Get standings (teams grouped by conference, sorted by rank)
export const getStandings = query({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		const teams = await ctx.db
			.query("wnbaTeam")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();

		const eastern = teams
			.filter((t) => t.conference?.toLowerCase().includes("east"))
			.sort((a, b) => (a.conferenceRank ?? 99) - (b.conferenceRank ?? 99));

		const western = teams
			.filter((t) => t.conference?.toLowerCase().includes("west"))
			.sort((a, b) => (a.conferenceRank ?? 99) - (b.conferenceRank ?? 99));

		return { eastern, western };
	},
});

// Get league leaders by a specific stat
export const getLeagueLeaders = query({
	args: {
		season: v.string(),
		stat: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const players = await ctx.db
			.query("wnbaPlayer")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();

		const limit = args.limit ?? 10;
		const stat = args.stat as keyof typeof players[0];

		// Filter to players with minimum games played
		const qualified = players.filter((p) => (p.gamesPlayed ?? 0) >= 10);

		// Sort descending by the requested stat
		qualified.sort((a, b) => {
			const aVal = (a[stat] as number | undefined) ?? 0;
			const bVal = (b[stat] as number | undefined) ?? 0;
			return bVal - aVal;
		});

		// Enrich with team info
		const top = qualified.slice(0, limit);
		const enriched = await Promise.all(
			top.map(async (player) => {
				const team = await ctx.db.get(player.teamId);
				return { ...player, team };
			}),
		);

		return enriched;
	},
});

// Get all teams for rankings display
export const getAllTeamStats = query({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaTeam")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();
	},
});

// Internal: get game event by API provider ID (for actions)
export const getGameEventInternal = internalQuery({
	args: { espnGameId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaGameEvent")
			.withIndex("by_espnGameId", (q) => q.eq("espnGameId", args.espnGameId))
			.unique();
	},
});

// Internal: get game event by Convex document ID
export const getGameEventById = internalQuery({
	args: { gameEventId: v.id("wnbaGameEvent") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.gameEventId);
	},
});

// Internal: get team by API provider ID + season
export const getTeamInternal = internalQuery({
	args: { espnTeamId: v.string(), season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaTeam")
			.withIndex("by_espnTeamId_season", (q) =>
				q.eq("espnTeamId", args.espnTeamId).eq("season", args.season),
			)
			.unique();
	},
});

// Internal: get player by API provider ID + season
export const getPlayerInternal = internalQuery({
	args: { espnPlayerId: v.string(), season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaPlayer")
			.withIndex("by_espnPlayerId_season", (q) =>
				q.eq("espnPlayerId", args.espnPlayerId).eq("season", args.season),
			)
			.unique();
	},
});

// Internal: get all games with a specific status
export const getGamesByStatus = internalQuery({
	args: { status: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaGameEvent")
			.withIndex("by_status", (q) =>
				q.eq("eventStatus", args.status as "scheduled" | "in_progress" | "halftime" | "end_of_period" | "overtime" | "completed" | "postponed" | "cancelled"),
			)
			.collect();
	},
});

// Internal: get all team events for a team (for recalculating averages)
export const getTeamEvents = internalQuery({
	args: { teamId: v.id("wnbaTeam") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaTeamEvent")
			.withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
			.collect();
	},
});

// Internal: get all player events for a player (for recalculating averages)
export const getPlayerEvents = internalQuery({
	args: { playerId: v.id("wnbaPlayer") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaPlayerEvent")
			.withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
			.collect();
	},
});

// Internal: get all teams for a season (for league rankings)
export const getAllTeamsInternal = internalQuery({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaTeam")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();
	},
});

// Internal: get all players for a season (for bootstrap recalculation)
export const getAllPlayersInternal = internalQuery({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaPlayer")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();
	},
});

// Internal: get player events for a game event (for recalculating after game completion)
export const getPlayerEventsByGame = internalQuery({
	args: { gameEventId: v.id("wnbaGameEvent") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("wnbaPlayerEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", args.gameEventId))
			.collect();
	},
});

// Internal: get team event by game + team
export const getTeamEventByGameAndTeam = internalQuery({
	args: { gameEventId: v.id("wnbaGameEvent"), teamId: v.id("wnbaTeam") },
	handler: async (ctx, args) => {
		const events = await ctx.db
			.query("wnbaTeamEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", args.gameEventId))
			.collect();
		return events.find((e) => e.teamId === args.teamId) ?? null;
	},
});

// Internal: get player event by game + player
export const getPlayerEventByGameAndPlayer = internalQuery({
	args: { gameEventId: v.id("wnbaGameEvent"), playerId: v.id("wnbaPlayer") },
	handler: async (ctx, args) => {
		const events = await ctx.db
			.query("wnbaPlayerEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", args.gameEventId))
			.collect();
		return events.find((e) => e.playerId === args.playerId) ?? null;
	},
});

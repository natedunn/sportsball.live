import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";

// Get all games for a specific date (scoreboard)
export const getScoreboard = query({
	args: { gameDate: v.string() },
	handler: async (ctx, args) => {
		const games = await ctx.db
			.query("nbaGameEvent")
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
			.query("nbaGameEvent")
			.withIndex("by_espnGameId", (q) => q.eq("espnGameId", args.espnGameId))
			.unique();

		if (!game) return null;

		// Fetch team events
		const teamEvents = await ctx.db
			.query("nbaTeamEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", game._id))
			.collect();

		// Fetch player events
		const playerEvents = await ctx.db
			.query("nbaPlayerEvent")
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
			.query("nbaGameEvent")
			.withIndex("by_espnGameId", (q) => q.eq("espnGameId", args.espnGameId))
			.unique();
	},
});

// Get team info, record, seasonal averages, ranks
export const getTeam = query({
	args: { espnTeamId: v.string(), season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("nbaTeam")
			.withIndex("by_espnTeamId_season", (q) =>
				q.eq("espnTeamId", args.espnTeamId).eq("season", args.season),
			)
			.unique();
	},
});

// Get all game events for a team (schedule)
export const getTeamSchedule = query({
	args: { teamId: v.id("nbaTeam") },
	handler: async (ctx, args) => {
		const homeGames = await ctx.db
			.query("nbaGameEvent")
			.withIndex("by_homeTeam", (q) => q.eq("homeTeamId", args.teamId))
			.collect();

		const awayGames = await ctx.db
			.query("nbaGameEvent")
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

// Get team game log (box score stats per game, for trend charts)
export const getTeamGameLog = query({
	args: { teamId: v.id("nbaTeam") },
	handler: async (ctx, args) => {
		const teamEvents = await ctx.db
			.query("nbaTeamEvent")
			.withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
			.collect();

		const enriched = await Promise.all(
			teamEvents.map(async (te) => {
				const gameEvent = await ctx.db.get(te.gameEventId);
				if (!gameEvent) return null;
				const oppScore = te.isHome ? gameEvent.awayScore : gameEvent.homeScore;
				return {
					gameDate: gameEvent.gameDate,
					scheduledStart: gameEvent.scheduledStart,
					score: te.score,
					oppScore: oppScore ?? 0,
					winner: te.winner ?? te.score > (oppScore ?? 0),
					fieldGoalsMade: te.fieldGoalsMade,
					fieldGoalsAttempted: te.fieldGoalsAttempted,
					threePointMade: te.threePointMade,
					threePointAttempted: te.threePointAttempted,
					freeThrowsMade: te.freeThrowsMade,
					freeThrowsAttempted: te.freeThrowsAttempted,
					totalRebounds: te.totalRebounds,
					assists: te.assists,
					steals: te.steals,
					blocks: te.blocks,
					turnovers: te.turnovers,
				};
			}),
		);

		return enriched
			.filter((e) => e !== null)
			.sort((a, b) => a.scheduledStart - b.scheduledStart);
	},
});

// Get all players for a team with averages (roster)
export const getTeamRoster = query({
	args: { teamId: v.id("nbaTeam") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("nbaPlayer")
			.withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
			.collect();
	},
});

type EnrichedPlayerEvent = {
	minutes: number;
	points: number;
	rebounds: number;
	assists: number;
	blocks: number;
	fgMade: number;
	fgAttempted: number;
	threeMade: number;
	threeAttempted: number;
	ftMade: number;
	ftAttempted: number;
	isHome: boolean;
	gameLabel: string;
	scheduledStart: number;
};

function safePct(made: number, attempted: number): number {
	if (attempted <= 0) return 0;
	return (made / attempted) * 100;
}

function aggregateEvents(events: EnrichedPlayerEvent[]) {
	if (events.length === 0) {
		return {
			minutes: 0,
			points: 0,
			rebounds: 0,
			assists: 0,
			blocks: 0,
			fgMade: 0,
			fgAttempted: 0,
			threeMade: 0,
			threeAttempted: 0,
			ftMade: 0,
			ftAttempted: 0,
		};
	}

	return events.reduce(
		(acc, event) => {
			acc.minutes += event.minutes;
			acc.points += event.points;
			acc.rebounds += event.rebounds;
			acc.assists += event.assists;
			acc.blocks += event.blocks;
			acc.fgMade += event.fgMade;
			acc.fgAttempted += event.fgAttempted;
			acc.threeMade += event.threeMade;
			acc.threeAttempted += event.threeAttempted;
			acc.ftMade += event.ftMade;
			acc.ftAttempted += event.ftAttempted;
			return acc;
		},
		{
			minutes: 0,
			points: 0,
			rebounds: 0,
			assists: 0,
			blocks: 0,
			fgMade: 0,
			fgAttempted: 0,
			threeMade: 0,
			threeAttempted: 0,
			ftMade: 0,
			ftAttempted: 0,
		},
	);
}

function deriveBirthDate(age?: number): string {
	const currentYear = new Date().getUTCFullYear();
	const birthYear = currentYear - (age ?? 25);
	return `${birthYear}-01-01`;
}

function calculatedStats(player: any) {
	const fga = player.fieldGoalsAttempted ?? 0;
	const fgm = player.fieldGoalsMade ?? 0;
	const fta = player.freeThrowsAttempted ?? 0;
	const ftm = player.freeThrowsMade ?? 0;
	const tov = player.turnoversPerGame ?? 0;
	const ast = player.assistsPerGame ?? 0;
	const pts = player.pointsPerGame ?? 0;
	const reb = player.reboundsPerGame ?? 0;
	const stl = player.stealsPerGame ?? 0;
	const blk = player.blocksPerGame ?? 0;
	const tsDenom = 2 * (fga + 0.44 * fta);
	const tsPct = tsDenom > 0 ? (pts / tsDenom) * 100 : player.fieldGoalPct ?? 0;
	const efficiency =
		pts + reb + ast + stl + blk - (fga - fgm) - (fta - ftm) - tov;

	return {
		trueShootingPct: tsPct,
		usagePct: Math.min(50, (fga + 0.44 * fta + tov) * 1.5),
		playerEfficiency: efficiency,
		assistToTurnover: ast / Math.max(tov, 0.1),
	};
}

// Get player details with computed splits/last10 and comparison pool
export const getPlayerDetails = query({
	args: { season: v.string(), espnPlayerId: v.string() },
	handler: async (ctx, args) => {
		const player = await ctx.db
			.query("nbaPlayer")
			.withIndex("by_espnPlayerId_season", (q) =>
				q.eq("espnPlayerId", args.espnPlayerId).eq("season", args.season),
			)
			.unique();

		if (!player) return null;

		const allSeasonPlayers = await ctx.db
			.query("nbaPlayer")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();

		const teamIds = Array.from(new Set(allSeasonPlayers.map((p) => p.teamId)));
		const teams = await Promise.all(teamIds.map((teamId) => ctx.db.get(teamId)));
		const teamMap = new Map(teams.filter(Boolean).map((team) => [team!._id, team!]));

		const mapToProfile = (entry: any, overrides?: Partial<any>) => {
			const team = teamMap.get(entry.teamId);
			return {
				id: entry.espnPlayerId,
				name: entry.name,
				team: team?.abbreviation ?? "UNK",
				position: entry.position ?? "",
				bio: {
					birthDate: deriveBirthDate(entry.age),
					college: entry.college ?? "Unknown",
					draftInfo: entry.experience ?? "Unknown",
					height: entry.height ?? "Unknown",
					weight: entry.weight ?? "Unknown",
					status: "Active" as const,
				},
				basicStats: {
					games: entry.gamesPlayed ?? 0,
					points: entry.pointsPerGame ?? 0,
					rebounds: entry.reboundsPerGame ?? 0,
					assists: entry.assistsPerGame ?? 0,
					steals: entry.stealsPerGame ?? 0,
					blocks: entry.blocksPerGame ?? 0,
				},
				calculatedStats: calculatedStats(entry),
				splits: [],
				lastTen: [],
				teammateIds: [],
				...overrides,
			};
		};

		const teammateIds = allSeasonPlayers
			.filter((p) => p.teamId === player.teamId && p._id !== player._id)
			.map((p) => p.espnPlayerId);

		const playerEvents = await ctx.db
			.query("nbaPlayerEvent")
			.withIndex("by_playerId", (q) => q.eq("playerId", player._id))
			.collect();

		const enrichedEvents: EnrichedPlayerEvent[] = (
			await Promise.all(
				playerEvents.map(async (event) => {
					const game = await ctx.db.get(event.gameEventId);
					if (!game) return null;

					const isHome = game.homeTeamId === player.teamId;
					const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
					const opponent = await ctx.db.get(opponentId);

					return {
						minutes: event.minutes,
						points: event.points,
						rebounds: event.totalRebounds,
						assists: event.assists,
						blocks: event.blocks,
						fgMade: event.fieldGoalsMade,
						fgAttempted: event.fieldGoalsAttempted,
						threeMade: event.threePointMade,
						threeAttempted: event.threePointAttempted,
						ftMade: event.freeThrowsMade,
						ftAttempted: event.freeThrowsAttempted,
						isHome,
						gameLabel: `${isHome ? "vs" : "@"} ${opponent?.abbreviation ?? "UNK"}`,
						scheduledStart: game.scheduledStart,
					};
				}),
			)
		).filter((event): event is EnrichedPlayerEvent => event !== null);

		enrichedEvents.sort((a, b) => b.scheduledStart - a.scheduledStart);
		const lastGame = enrichedEvents[0];
		const last10Events = enrichedEvents.slice(0, 10);
		const homeEvents = enrichedEvents.filter((event) => event.isHome);
		const roadEvents = enrichedEvents.filter((event) => !event.isHome);

		const makeSplit = (label: string, events: EnrichedPlayerEvent[]) => {
			const totals = aggregateEvents(events);
			const count = Math.max(events.length, 1);
			return {
				label,
				minutes: totals.minutes / count,
				points: totals.points / count,
				rebounds: totals.rebounds / count,
				assists: totals.assists / count,
				fieldGoalPct: safePct(totals.fgMade, totals.fgAttempted),
				threePointPct: safePct(totals.threeMade, totals.threeAttempted),
				freeThrowPct: safePct(totals.ftMade, totals.ftAttempted),
			};
		};

		const splits = [
			lastGame
				? {
						label: "Last Game",
						minutes: lastGame.minutes,
						points: lastGame.points,
						rebounds: lastGame.rebounds,
						assists: lastGame.assists,
						fieldGoalPct: safePct(lastGame.fgMade, lastGame.fgAttempted),
						threePointPct: safePct(lastGame.threeMade, lastGame.threeAttempted),
						freeThrowPct: safePct(lastGame.ftMade, lastGame.ftAttempted),
					}
				: makeSplit("Last Game", []),
			makeSplit("Last 10", last10Events),
			makeSplit("Home", homeEvents),
			makeSplit("Road", roadEvents),
		];

		const lastTen = last10Events.map((event) => ({
			gameLabel: event.gameLabel,
			minutes: event.minutes,
			fieldGoalPct: safePct(event.fgMade, event.fgAttempted),
			threePointPct: safePct(event.threeMade, event.threeAttempted),
			freeThrowPct: safePct(event.ftMade, event.ftAttempted),
			rebounds: event.rebounds,
			assists: event.assists,
			blocks: event.blocks,
			points: event.points,
		}));

		const playerProfile = mapToProfile(player, {
			teammateIds,
			splits,
			lastTen,
		});

		const allPlayers = allSeasonPlayers.map((entry) => mapToProfile(entry));

		return {
			player: playerProfile,
			allPlayers,
		};
	},
});

export const getPlayersPaginated = query({
	args: {
		season: v.string(),
		sortBy: v.union(
			v.literal("scoring"),
			v.literal("playmaking"),
			v.literal("efficiency"),
		),
		paginationOpts: paginationOptsValidator,
	},
	handler: async (ctx, args) => {
		const baseQuery =
			args.sortBy === "playmaking"
				? ctx.db
						.query("nbaPlayer")
						.withIndex("by_season_assistsPerGame", (q) =>
							q.eq("season", args.season),
						)
						.order("desc")
				: args.sortBy === "efficiency"
					? ctx.db
							.query("nbaPlayer")
							.withIndex("by_season_fieldGoalPct", (q) =>
								q.eq("season", args.season),
							)
							.order("desc")
					: ctx.db
							.query("nbaPlayer")
							.withIndex("by_season_pointsPerGame", (q) =>
								q.eq("season", args.season),
							)
							.order("desc");

		const page = await baseQuery.paginate(args.paginationOpts);
		const teamIds = Array.from(new Set(page.page.map((player) => player.teamId)));
		const teams = await Promise.all(teamIds.map((teamId) => ctx.db.get(teamId)));
		const teamMap = new Map(teams.filter(Boolean).map((team) => [team!._id, team!]));

		return {
			...page,
			page: page.page.map((player) => {
				const team = teamMap.get(player.teamId);
				return {
					id: player.espnPlayerId,
					name: player.name,
					position: player.position ?? "",
					games: player.gamesPlayed ?? 0,
					points: player.pointsPerGame ?? 0,
					rebounds: player.reboundsPerGame ?? 0,
					assists: player.assistsPerGame ?? 0,
					fieldGoalPct: player.fieldGoalPct ?? 0,
					minutes: player.minutesPerGame ?? 0,
					steals: player.stealsPerGame ?? 0,
					team: team?.abbreviation ?? "UNK",
				};
			}),
		};
	},
});

// Get standings (teams grouped by conference, sorted by rank)
export const getStandings = query({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		const teams = await ctx.db
			.query("nbaTeam")
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
			.query("nbaPlayer")
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
			.query("nbaTeam")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();
	},
});

// Internal: get game event by API provider ID (for actions)
export const getGameEventInternal = internalQuery({
	args: { espnGameId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("nbaGameEvent")
			.withIndex("by_espnGameId", (q) => q.eq("espnGameId", args.espnGameId))
			.unique();
	},
});

// Internal: get game event by Convex document ID
export const getGameEventById = internalQuery({
	args: { gameEventId: v.id("nbaGameEvent") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.gameEventId);
	},
});

// Internal: get team by API provider ID + season
export const getTeamInternal = internalQuery({
	args: { espnTeamId: v.string(), season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("nbaTeam")
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
			.query("nbaPlayer")
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
			.query("nbaGameEvent")
			.withIndex("by_status", (q) =>
				q.eq("eventStatus", args.status as "scheduled" | "in_progress" | "halftime" | "end_of_period" | "overtime" | "completed" | "postponed" | "cancelled"),
			)
			.collect();
	},
});

// Internal: get all team events for a team (for recalculating averages)
export const getTeamEvents = internalQuery({
	args: { teamId: v.id("nbaTeam") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("nbaTeamEvent")
			.withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
			.collect();
	},
});

// Internal: get all player events for a player (for recalculating averages)
export const getPlayerEvents = internalQuery({
	args: { playerId: v.id("nbaPlayer") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("nbaPlayerEvent")
			.withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
			.collect();
	},
});

// Internal: get all teams for a season (for league rankings)
export const getAllTeamsInternal = internalQuery({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("nbaTeam")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();
	},
});

// Internal: get player events for a game event (for recalculating after game completion)
export const getPlayerEventsByGame = internalQuery({
	args: { gameEventId: v.id("nbaGameEvent") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("nbaPlayerEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", args.gameEventId))
			.collect();
	},
});

// Internal: get team event by game + team
export const getTeamEventByGameAndTeam = internalQuery({
	args: { gameEventId: v.id("nbaGameEvent"), teamId: v.id("nbaTeam") },
	handler: async (ctx, args) => {
		const events = await ctx.db
			.query("nbaTeamEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", args.gameEventId))
			.collect();
		return events.find((e) => e.teamId === args.teamId) ?? null;
	},
});

// Internal: get all players for a season (for bootstrap recalculation)
export const getAllPlayersInternal = internalQuery({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("nbaPlayer")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();
	},
});

// Internal: get player event by game + player
export const getPlayerEventByGameAndPlayer = internalQuery({
	args: { gameEventId: v.id("nbaGameEvent"), playerId: v.id("nbaPlayer") },
	handler: async (ctx, args) => {
		const events = await ctx.db
			.query("nbaPlayerEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", args.gameEventId))
			.collect();
		return events.find((e) => e.playerId === args.playerId) ?? null;
	},
});

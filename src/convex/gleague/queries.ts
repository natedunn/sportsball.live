import { v } from "convex/values";
import { loadPlayerInjuryReport } from "../injuries";
import { query, internalQuery, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { getSeriesRecordForGame, isPlayoffGame } from "../shared/scoreboardSeries";
import { buildGameLogRow, type PlayerGameLogRow } from "../shared/playerGameLog";
import { assemblePlayerGames, playerGamesArgs } from "../shared/playerGames";
import { countsTowardGameLog, getPreviousSeason } from "../shared/seasonHelpers";
import {
	calculateEfgPct,
	computePlayerSeasonRatings,
	playedInGame,
} from "../shared/statsCalculations";

// Get all games for a specific date (scoreboard)
export const getScoreboard = query({
	args: { gameDate: v.string() },
	handler: async (ctx, args) => {
		const games = await ctx.db
			.query("gleagueGameEvent")
			.withIndex("by_gameDate", (q) => q.eq("gameDate", args.gameDate))
			.collect();

		// Enrich each game with team info
		const enriched = await Promise.all(
			games.map(async (game) => {
				const shouldLoadSeries = isPlayoffGame(game);
				const [homeTeam, awayTeam, homeTeamHomeGames, homeTeamAwayGames] = await Promise.all([
					ctx.db.get(game.homeTeamId),
					ctx.db.get(game.awayTeamId),
					shouldLoadSeries
						? ctx.db
								.query("gleagueGameEvent")
								.withIndex("by_homeTeam_season", (q) =>
									q.eq("homeTeamId", game.homeTeamId).eq("season", game.season),
								)
								.collect()
						: Promise.resolve([]),
					shouldLoadSeries
						? ctx.db
								.query("gleagueGameEvent")
								.withIndex("by_awayTeam_season", (q) =>
									q.eq("awayTeamId", game.homeTeamId).eq("season", game.season),
								)
								.collect()
						: Promise.resolve([]),
				]);
				return {
					...game,
					homeTeam,
					awayTeam,
					seriesRecord: shouldLoadSeries
						? getSeriesRecordForGame(game, [
								...homeTeamHomeGames,
								...homeTeamAwayGames,
							])
						: undefined,
				};
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
			.query("gleagueGameEvent")
			.withIndex("by_espnGameId", (q) => q.eq("espnGameId", args.espnGameId))
			.unique();

		if (!game) return null;

		const shouldLoadSeries = isPlayoffGame(game);

		// Fetch team events
		const teamEvents = await ctx.db
			.query("gleagueTeamEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", game._id))
			.collect();

		// Fetch player events
		const playerEvents = await ctx.db
			.query("gleaguePlayerEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", game._id))
			.collect();

		// Fetch team info
		const [homeTeam, awayTeam, homeTeamHomeGames, homeTeamAwayGames] = await Promise.all([
			ctx.db.get(game.homeTeamId),
			ctx.db.get(game.awayTeamId),
			shouldLoadSeries
				? ctx.db
						.query("gleagueGameEvent")
						.withIndex("by_homeTeam_season", (q) =>
							q.eq("homeTeamId", game.homeTeamId).eq("season", game.season),
						)
						.collect()
				: Promise.resolve([]),
			shouldLoadSeries
				? ctx.db
						.query("gleagueGameEvent")
						.withIndex("by_awayTeam_season", (q) =>
							q.eq("awayTeamId", game.homeTeamId).eq("season", game.season),
						)
						.collect()
				: Promise.resolve([]),
		]);

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
			seriesRecord: shouldLoadSeries
				? getSeriesRecordForGame(game, [
						...homeTeamHomeGames,
						...homeTeamAwayGames,
					])
				: undefined,
		};
	},
});

// Get a single game event (for throttle checking in sync)
export const getGameEvent = query({
	args: { espnGameId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("gleagueGameEvent")
			.withIndex("by_espnGameId", (q) => q.eq("espnGameId", args.espnGameId))
			.unique();
	},
});

// Get team info, record, seasonal averages, ranks
export const getTeam = query({
	args: { espnTeamId: v.string(), season: v.string() },
	handler: async (ctx, args) => {
		const team = await ctx.db
			.query("gleagueTeam")
			.withIndex("by_espnTeamId_season", (q) =>
				q.eq("espnTeamId", args.espnTeamId).eq("season", args.season),
			)
			.unique();
		if (!team) return null;

		// Number of teams in the league rankings (same filter as updateLeagueRankings),
		// so the UI can tell which ranks are in the bottom five
		const seasonTeams = await ctx.db
			.query("gleagueTeam")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();
		const rankedTeamCount = seasonTeams.filter((t) => (t.offensiveRating ?? 0) > 0).length;

		return { ...team, rankedTeamCount };
	},
});

// Get all game events for a team (schedule)
export const getTeamSchedule = query({
	args: { teamId: v.optional(v.id("gleagueTeam")) },
	handler: async (ctx, args) => {
		if (!args.teamId) return [];
		const teamId = args.teamId;

		const homeGames = await ctx.db
			.query("gleagueGameEvent")
			.withIndex("by_homeTeam", (q) => q.eq("homeTeamId", teamId))
			.collect();

		const awayGames = await ctx.db
			.query("gleagueGameEvent")
			.withIndex("by_awayTeam", (q) => q.eq("awayTeamId", teamId))
			.collect();

		const allGames = [...homeGames, ...awayGames].sort(
			(a, b) => a.scheduledStart - b.scheduledStart,
		);

		// Enrich with opponent info
		const enriched = await Promise.all(
			allGames.map(async (game) => {
				const isHome = game.homeTeamId === teamId;
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
	args: { teamId: v.optional(v.id("gleagueTeam")) },
	handler: async (ctx, args) => {
		if (!args.teamId) return [];
		const teamId = args.teamId;

		const teamEvents = await ctx.db
			.query("gleagueTeamEvent")
			.withIndex("by_teamId", (q) => q.eq("teamId", teamId))
			.collect();

		const enriched = await Promise.all(
			teamEvents.map(async (te) => {
				const gameEvent = await ctx.db.get(te.gameEventId);
				// Trends cover every game the team played this season, playoffs included
				if (!countsTowardGameLog(gameEvent)) return null;
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
	args: { teamId: v.optional(v.id("gleagueTeam")) },
	handler: async (ctx, args) => {
		if (!args.teamId) return [];
		const teamId = args.teamId;

		const players = await ctx.db
			.query("gleaguePlayer")
			.withIndex("by_teamId", (q) => q.eq("teamId", teamId))
			.collect();
		// Players who've left keep their stats but drop off the roster
		return players.filter((p) => p.onRoster !== false);
	},
});

function safePct(made: number, attempted: number): number {
	if (attempted <= 0) return 0;
	return (made / attempted) * 100;
}

type SeasonTeams = {
	teamMap: Map<Id<"gleagueTeam">, Doc<"gleagueTeam">>;
	abbreviationByEspnId: Map<string, string>;
};

async function loadSeasonTeams(ctx: QueryCtx, season: string): Promise<SeasonTeams> {
	const teams = await ctx.db
		.query("gleagueTeam")
		.withIndex("by_season", (q) => q.eq("season", season))
		.collect();
	return {
		teamMap: new Map(teams.map((team) => [team._id, team])),
		abbreviationByEspnId: new Map(teams.map((team) => [team.espnTeamId, team.abbreviation])),
	};
}

function toPlayerProfile(
	entry: Doc<"gleaguePlayer">,
	{ teamMap, abbreviationByEspnId }: SeasonTeams,
	overrides?: Record<string, unknown>,
) {
	const team = teamMap.get(entry.teamId);
	return {
		id: entry.espnPlayerId,
		name: entry.name,
		team: team?.abbreviation ?? "UNK",
		position: entry.position ?? "",
		headshot: entry.headshot,
		bio: {
			birthDate: entry.birthDate,
			age: entry.age,
			college: entry.college ?? "Unknown",
			// undefined: unknown; null: undrafted
			draft: entry.draft
				? {
						year: entry.draft.year,
						round: entry.draft.round,
						pick: entry.draft.pick,
						team: entry.draft.teamEspnId
							? abbreviationByEspnId.get(entry.draft.teamEspnId)
							: undefined,
					}
				: entry.draft,
			// ESPN's season count, this one included (0 for rookies)
			experienceYears:
				entry.experience !== undefined && Number.isFinite(Number(entry.experience))
					? Number(entry.experience)
					: undefined,
			height: entry.height ?? "Unknown",
			weight: entry.weight ?? "Unknown",
		},
		basicStats: {
			games: entry.gamesPlayed ?? 0,
			points: entry.pointsPerGame ?? 0,
			rebounds: entry.reboundsPerGame ?? 0,
			assists: entry.assistsPerGame ?? 0,
			steals: entry.stealsPerGame ?? 0,
			blocks: entry.blocksPerGame ?? 0,
			minutes: entry.minutesPerGame ?? 0,
			turnovers: entry.turnoversPerGame ?? 0,
		},
		// From season totals, not averaged per-game percentages
		shooting: {
			fieldGoalPct: safePct(entry.totalFgMade ?? 0, entry.totalFgAttempted ?? 0),
			threePointPct: safePct(entry.totalThreeMade ?? 0, entry.totalThreeAttempted ?? 0),
			freeThrowPct: safePct(entry.totalFtMade ?? 0, entry.totalFtAttempted ?? 0),
			effectiveFgPct: calculateEfgPct(
				entry.totalFgMade ?? 0,
				entry.totalThreeMade ?? 0,
				entry.totalFgAttempted ?? 0,
			),
		},
		calculatedStats: computePlayerSeasonRatings(entry),
		...overrides,
	};
}

// Get a player's season profile and their current teammates
export const getPlayerDetails = query({
	args: { season: v.string(), espnPlayerId: v.string() },
	handler: async (ctx, args) => {
		const player = await ctx.db
			.query("gleaguePlayer")
			.withIndex("by_espnPlayerId_season", (q) =>
				q.eq("espnPlayerId", args.espnPlayerId).eq("season", args.season),
			)
			.unique();

		if (!player) return null;

		const [seasonTeams, teamPlayers, injuryReport] = await Promise.all([
			loadSeasonTeams(ctx, args.season),
			ctx.db
				.query("gleaguePlayer")
				.withIndex("by_teamId", (q) => q.eq("teamId", player.teamId))
				.collect(),
			loadPlayerInjuryReport(ctx, "gleague", args.espnPlayerId),
		]);

		const teammates = teamPlayers
			.filter(
				(p) =>
					p.season === args.season && p._id !== player._id && p.onRoster !== false,
			)
			.map((p) => toPlayerProfile(p, seasonTeams));

		return {
			player: toPlayerProfile(player, seasonTeams),
			teammates,
			injuryReport,
		};
	},
});

// One player's season profile, for the comparison tab
export const getPlayerProfile = query({
	args: { season: v.string(), espnPlayerId: v.string() },
	handler: async (ctx, args) => {
		const player = await ctx.db
			.query("gleaguePlayer")
			.withIndex("by_espnPlayerId_season", (q) =>
				q.eq("espnPlayerId", args.espnPlayerId).eq("season", args.season),
			)
			.unique();
		if (!player) return null;
		return toPlayerProfile(player, await loadSeasonTeams(ctx, args.season));
	},
});

// One page of the player's games, played and missed, with their availability
// for the season. Reads their own lines and their team's schedule, not the box
// scores of every game, so it's cheap enough for the games tab to load every time.
export const getPlayerGames = query({
	args: { season: v.string(), espnPlayerId: v.string(), ...playerGamesArgs },
	handler: async (ctx, { season, espnPlayerId, ...options }) => {
		const player = await ctx.db
			.query("gleaguePlayer")
			.withIndex("by_espnPlayerId_season", (q) =>
				q.eq("espnPlayerId", espnPlayerId).eq("season", season),
			)
			.unique();
		if (!player) return null;

		const [lines, home, away, absences, reports] = await Promise.all([
			ctx.db
				.query("gleaguePlayerEvent")
				.withIndex("by_playerId", (q) => q.eq("playerId", player._id))
				.collect(),
			ctx.db
				.query("gleagueGameEvent")
				.withIndex("by_homeTeam_season", (q) => q.eq("homeTeamId", player.teamId).eq("season", season))
				.collect(),
			ctx.db
				.query("gleagueGameEvent")
				.withIndex("by_awayTeam_season", (q) => q.eq("awayTeamId", player.teamId).eq("season", season))
				.collect(),
			ctx.db
				.query("gameAbsences")
				.withIndex("by_league_season_player", (q) =>
					q.eq("league", "gleague").eq("season", season).eq("espnPlayerId", espnPlayerId),
				)
				.collect(),
			ctx.db
				.query("injuryLog")
				.withIndex("by_league_player", (q) => q.eq("league", "gleague").eq("espnPlayerId", espnPlayerId))
				.collect(),
		]);

		const schedule = [...home, ...away];
		const scheduleById = new Map(schedule.map((game) => [game._id, game]));
		const played = await Promise.all(
			lines.filter(playedInGame).map(async (line) => {
				// Only a game for a former team isn't on the schedule
				const game = scheduleById.get(line.gameEventId) ?? (await ctx.db.get(line.gameEventId));
				return countsTowardGameLog(game) ? [{ game, line }] : [];
			}),
		);

		const scheduledIds = new Set(schedule.map((game) => game.espnGameId));
		const formerGames = await Promise.all(
			absences
				.filter((absence) => !scheduledIds.has(absence.espnGameId))
				.map(async (absence) => {
					const game = await ctx.db
						.query("gleagueGameEvent")
						.withIndex("by_espnGameId", (q) => q.eq("espnGameId", absence.espnGameId))
						.unique();
					if (!game) return [];
					const homeTeam = await ctx.db.get(game.homeTeamId);
					const teamId = homeTeam?.espnTeamId === absence.espnTeamId ? game.homeTeamId : game.awayTeamId;
					return [{ game, teamId }];
				}),
		);

		return assemblePlayerGames({
			currentTeamId: player.teamId,
			played: played.flat(),
			schedule,
			formerGames: formerGames.flat(),
			absences,
			reports,
			options,
			abbreviationFor: async (teamId) => (await ctx.db.get(teamId))?.abbreviation,
		});
	},
});

// Every game the player appeared in this season, with both teams' box score
// totals, for the stats tab and the game performance dialog
export const getPlayerGameLog = query({
	args: { season: v.string(), espnPlayerId: v.string() },
	handler: async (ctx, args) => {
		const player = await ctx.db
			.query("gleaguePlayer")
			.withIndex("by_espnPlayerId_season", (q) =>
				q.eq("espnPlayerId", args.espnPlayerId).eq("season", args.season),
			)
			.unique();
		if (!player) return null;

		const lines = await ctx.db
			.query("gleaguePlayerEvent")
			.withIndex("by_playerId", (q) => q.eq("playerId", player._id))
			.collect();

		const teamAbbreviations = new Map<string, string>();
		const abbreviationFor = async (teamId: Id<"gleagueTeam">) => {
			const cached = teamAbbreviations.get(teamId);
			if (cached) return cached;
			const team = await ctx.db.get(teamId);
			const abbreviation = team?.abbreviation ?? "UNK";
			teamAbbreviations.set(teamId, abbreviation);
			return abbreviation;
		};

		const rows = await Promise.all(
			lines.map(async (line) => {
				if (!playedInGame(line)) return null;
				const game = await ctx.db.get(line.gameEventId);
				if (!countsTowardGameLog(game)) return null;

				// The team the player played for that night (they may have been traded since)
				const isHome = game.homeTeamId === line.teamId;
				const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
				const [teamEvents, gameLines, opponent, team] = await Promise.all([
					ctx.db
						.query("gleagueTeamEvent")
						.withIndex("by_gameEventId", (q) => q.eq("gameEventId", game._id))
						.collect(),
					ctx.db
						.query("gleaguePlayerEvent")
						.withIndex("by_gameEventId", (q) => q.eq("gameEventId", game._id))
						.collect(),
					abbreviationFor(opponentId),
					abbreviationFor(line.teamId),
				]);
				const teamEvent = teamEvents.find((event) => event.teamId === line.teamId);
				const oppEvent = teamEvents.find((event) => event.teamId === opponentId);
				if (!teamEvent || !oppEvent) return null;

				const minutesFor = (teamId: Id<"gleagueTeam">) =>
					gameLines
						.filter((entry) => entry.teamId === teamId)
						.reduce((sum, entry) => sum + entry.minutes, 0);

				return buildGameLogRow({
					game,
					line,
					isHome,
					team,
					opponent,
					teamEvent,
					oppEvent,
					teamMinutes: minutesFor(line.teamId),
					oppMinutes: minutesFor(opponentId),
				});
			}),
		);

		return rows
			.filter((row): row is PlayerGameLogRow => row !== null)
			.sort((a, b) => b.scheduledStart - a.scheduledStart);
	},
});

// Players matching a name, for the comparison tab's search
export const searchPlayers = query({
	args: { season: v.string(), term: v.string() },
	handler: async (ctx, args) => {
		const term = args.term.trim();
		if (!term) return [];

		const players = await ctx.db
			.query("gleaguePlayer")
			.withSearchIndex("search_name", (q) =>
				q.search("name", term).eq("season", args.season),
			)
			.take(10);

		return Promise.all(
			players.map(async (player) => {
				const team = await ctx.db.get(player.teamId);
				return {
					id: player.espnPlayerId,
					name: player.name,
					team: team?.abbreviation ?? "UNK",
					position: player.position ?? "",
				};
			}),
		);
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
						.query("gleaguePlayer")
						.withIndex("by_season_assistsPerGame", (q) =>
							q.eq("season", args.season),
						)
						.order("desc")
				: args.sortBy === "efficiency"
					? ctx.db
							.query("gleaguePlayer")
							.withIndex("by_season_fieldGoalPct", (q) =>
								q.eq("season", args.season),
							)
							.order("desc")
					: ctx.db
							.query("gleaguePlayer")
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

// Get standings (all teams sorted by conferenceRank or wins)
// G-League may not have conferences, so return all teams sorted
export const getStandings = query({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		const teams = await ctx.db
			.query("gleagueTeam")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();

		const eastern = teams
			.filter((t) => t.conference?.toLowerCase().includes("east"))
			.sort((a, b) => (a.conferenceRank ?? 99) - (b.conferenceRank ?? 99));

		const western = teams
			.filter((t) => t.conference?.toLowerCase().includes("west"))
			.sort((a, b) => (a.conferenceRank ?? 99) - (b.conferenceRank ?? 99));

		// If no conference data, return all teams sorted by wins as "eastern" for compatibility
		if (eastern.length === 0 && western.length === 0) {
			const allTeams = [...teams].sort((a, b) => {
				// Sort by conferenceRank first, then by wins descending
				const rankA = a.conferenceRank ?? 99;
				const rankB = b.conferenceRank ?? 99;
				if (rankA !== rankB) return rankA - rankB;
				return b.wins - a.wins;
			});
			return { eastern: allTeams, western: [] };
		}

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
			.query("gleaguePlayer")
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
			.query("gleagueTeam")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();
	},
});

// Get all playoff data for bracket display: the season's playoffs, or the
// previous season's until this season's begin. Playoff seeds aren't in ESPN's
// data (the playoffs split the league East and West, not by ESPN's divisions);
// the page reads them from the stats API (src/lib/gleague/playoffs.server.ts).
export const getPlayoffBracket = query({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		const playoffGames = async (season: string) =>
			(
				await ctx.db
					.query("gleagueGameEvent")
					.withIndex("by_season", (q) => q.eq("season", season))
					.collect()
			)
				// The season type decides which games count: no Tip-Off
				// Tournament or regular season games
				.filter(isPlayoffGame)
				.sort((a, b) => a.scheduledStart - b.scheduledStart);

		let season = args.season;
		let games = await playoffGames(season);
		if (games.length === 0) {
			const previous = getPreviousSeason("gleague", season);
			const previousGames = await playoffGames(previous);
			if (previousGames.length > 0) {
				season = previous;
				games = previousGames;
			}
		}

		const teams = await ctx.db
			.query("gleagueTeam")
			.withIndex("by_season", (q) => q.eq("season", season))
			.collect();
		const teamMap = new Map(teams.map((t) => [t._id, t]));

		const teamInfo = (team: Doc<"gleagueTeam"> | undefined) =>
			team
				? {
						espnTeamId: team.espnTeamId,
						name: team.name,
						abbreviation: team.abbreviation,
						location: team.location,
						conference: team.conference,
						conferenceRank: team.conferenceRank,
					}
				: null;

		return {
			season,
			games: games.map((game) => ({
				espnGameId: game.espnGameId,
				gameDate: game.gameDate,
				scheduledStart: game.scheduledStart,
				eventStatus: game.eventStatus,
				homeScore: game.homeScore,
				awayScore: game.awayScore,
				homeTeam: teamInfo(teamMap.get(game.homeTeamId)),
				awayTeam: teamInfo(teamMap.get(game.awayTeamId)),
			})),
			teams: teams.map((t) => ({
				espnTeamId: t.espnTeamId,
				name: t.name,
				abbreviation: t.abbreviation,
				location: t.location,
				conference: t.conference,
				conferenceRank: t.conferenceRank,
				wins: t.wins,
				losses: t.losses,
			})),
		};
	},
});

// Internal: get game event by API provider ID (for actions)
export const getGameEventInternal = internalQuery({
	args: { espnGameId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("gleagueGameEvent")
			.withIndex("by_espnGameId", (q) => q.eq("espnGameId", args.espnGameId))
			.unique();
	},
});

// Internal: get game event by Convex document ID
export const getGameEventById = internalQuery({
	args: { gameEventId: v.id("gleagueGameEvent") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.gameEventId);
	},
});

// Internal: get team by API provider ID + season
export const getTeamInternal = internalQuery({
	args: { espnTeamId: v.string(), season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("gleagueTeam")
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
			.query("gleaguePlayer")
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
			.query("gleagueGameEvent")
			.withIndex("by_status", (q) =>
				q.eq("eventStatus", args.status as "scheduled" | "in_progress" | "halftime" | "end_of_period" | "overtime" | "completed" | "postponed" | "cancelled"),
			)
			.collect();
	},
});

// Internal: get all team events for a team (for recalculating averages)
export const getTeamEvents = internalQuery({
	args: { teamId: v.id("gleagueTeam") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("gleagueTeamEvent")
			.withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
			.collect();
	},
});

// Internal: get all player events for a player (for recalculating averages)
export const getPlayerEvents = internalQuery({
	args: { playerId: v.id("gleaguePlayer") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("gleaguePlayerEvent")
			.withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
			.collect();
	},
});

// Internal: get all teams for a season (for league rankings)
export const getAllTeamsInternal = internalQuery({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("gleagueTeam")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();
	},
});

// Internal: a season's teams, games, team box scores and current rosters, for
// the daily health check (health.runHealthCheck)
export const getHealthSnapshot = internalQuery({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		const [teams, games, players] = await Promise.all([
			ctx.db.query("gleagueTeam").withIndex("by_season", (q) => q.eq("season", args.season)).collect(),
			ctx.db.query("gleagueGameEvent").withIndex("by_season", (q) => q.eq("season", args.season)).collect(),
			ctx.db.query("gleaguePlayer").withIndex("by_season", (q) => q.eq("season", args.season)).collect(),
		]);
		const teamEvents = (
			await Promise.all(
				teams.map((team) =>
					ctx.db
						.query("gleagueTeamEvent")
						.withIndex("by_teamId", (q) => q.eq("teamId", team._id))
						.collect(),
				),
			)
		).flat();

		return {
			teams: teams.map((team) => ({
				id: team._id as string,
				espnTeamId: team.espnTeamId,
				abbreviation: team.abbreviation,
				wins: team.wins,
				losses: team.losses,
			})),
			games: games.map((game) => ({
				id: game._id as string,
				espnGameId: game.espnGameId,
				eventStatus: game.eventStatus,
				seasonType: game.seasonType,
				gameDate: game.gameDate,
			})),
			teamEvents: teamEvents.map((event) => ({
				gameId: event.gameEventId as string,
				teamId: event.teamId as string,
				score: event.score,
				fieldGoalsMade: event.fieldGoalsMade,
				fieldGoalsAttempted: event.fieldGoalsAttempted,
				threePointMade: event.threePointMade,
				threePointAttempted: event.threePointAttempted,
				freeThrowsMade: event.freeThrowsMade,
				freeThrowsAttempted: event.freeThrowsAttempted,
				totalRebounds: event.totalRebounds,
				offensiveRebounds: event.offensiveRebounds,
				defensiveRebounds: event.defensiveRebounds,
				assists: event.assists,
				steals: event.steals,
				blocks: event.blocks,
				turnovers: event.turnovers,
			})),
			rosters: players
				.filter((player) => player.onRoster !== false)
				.map((player) => ({ espnPlayerId: player.espnPlayerId, teamId: player.teamId as string })),
		};
	},
});

// Internal: get all players for a season (for bootstrap recalculation)
export const getAllPlayersInternal = internalQuery({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("gleaguePlayer")
			.withIndex("by_season", (q) => q.eq("season", args.season))
			.collect();
	},
});

// Internal: get player events for a game event (for recalculating after game completion)
export const getPlayerEventsByGame = internalQuery({
	args: { gameEventId: v.id("gleagueGameEvent") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("gleaguePlayerEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", args.gameEventId))
			.collect();
	},
});

// Internal: get team event by game + team
export const getTeamEventByGameAndTeam = internalQuery({
	args: { gameEventId: v.id("gleagueGameEvent"), teamId: v.id("gleagueTeam") },
	handler: async (ctx, args) => {
		const events = await ctx.db
			.query("gleagueTeamEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", args.gameEventId))
			.collect();
		return events.find((e) => e.teamId === args.teamId) ?? null;
	},
});

// Internal: get player event by game + player
export const getPlayerEventByGameAndPlayer = internalQuery({
	args: { gameEventId: v.id("gleagueGameEvent"), playerId: v.id("gleaguePlayer") },
	handler: async (ctx, args) => {
		const events = await ctx.db
			.query("gleaguePlayerEvent")
			.withIndex("by_gameEventId", (q) => q.eq("gameEventId", args.gameEventId))
			.collect();
		return events.find((e) => e.playerId === args.playerId) ?? null;
	},
});

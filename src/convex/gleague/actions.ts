import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getCurrentSeason, getTodayDateUTC, formatGameDate, mapApiStateToEventStatus, sleep, getDateRange } from "../shared/seasonHelpers";
import { parseTeamBoxScore, parsePlayerBoxScores } from "../shared/apiParser";
import type {
	ApiScoreboardResponse,
	ApiGameSummaryResponse,
	ApiStandingsResponse,
	ApiRosterResponse,
} from "../shared/apiParser";

// Bootstrap constants
const BACKFILL_DELAY_MS = 2000;
const BACKFILL_GAME_DELAY_MS = 3000;
const ROSTER_TEAMS_PER_CHUNK = 5;

function getSiteApi(): string {
	const url = process.env.GLEAGUE_SITE_API;
	if (!url) throw new Error("GLEAGUE_SITE_API not configured");
	return url;
}

function getCommonApi(): string {
	const url = process.env.GLEAGUE_COMMON_API;
	if (!url) throw new Error("GLEAGUE_COMMON_API not configured");
	return url;
}

function getSeasonStartDate(season: string): string {
	const startYear = parseInt(season.split("-")[0], 10);
	// G-League season typically starts in November
	return `${startYear}1101`;
}

// Daily cron: discover today's games, update standings
export const discoverTodaysGames = internalAction({
	args: {},
	handler: async (ctx) => {
		const season = getCurrentSeason();
		const date = getTodayDateUTC();
		const baseUrl = getSiteApi();

		console.log(`[GLEAGUE] Discovering games for ${date}, season ${season}...`);

		// Fetch scoreboard
		const scoreboardRes = await fetch(`${baseUrl}/scoreboard?dates=${date}`, {
			headers: { "Content-Type": "application/json" },
		});

		if (!scoreboardRes.ok) {
			console.error(`[GLEAGUE] Scoreboard fetch failed: ${scoreboardRes.status}`);
			return;
		}

		const scoreboardData = (await scoreboardRes.json()) as ApiScoreboardResponse;
		const events = scoreboardData.events ?? [];

		console.log(`[GLEAGUE] Found ${events.length} games for ${date}`);

		// Also fetch standings to update team records
		const standingsUrl = baseUrl.replace("/site/v2/", "/v2/") + "/standings";
		let standingsEntries: ApiStandingsResponse["children"] = [];
		try {
			const standingsRes = await fetch(standingsUrl, {
				headers: { "User-Agent": "Mozilla/5.0" },
			});
			if (standingsRes.ok) {
				const standingsData = (await standingsRes.json()) as ApiStandingsResponse;
				standingsEntries = standingsData.children ?? [];
			}
		} catch (error) {
			console.error("[GLEAGUE] Standings fetch failed:", error);
		}

		// Build a map of team ID -> standings data
		const standingsMap = new Map<string, {
			conference: string;
			rank: number;
			wins: number;
			losses: number;
			winPct: number;
			streak: string;
			homeRecord: string;
			awayRecord: string;
			gamesBack: string;
			last10: string;
			divisionRecord: string;
			conferenceRecord: string;
			pointsFor: number;
			pointsAgainst: number;
		}>();

		for (const conf of standingsEntries ?? []) {
			const confName = conf.name ?? "";
			for (const entry of conf.standings?.entries ?? []) {
				const teamId = entry.team.id;
				const getStat = (name: string) => entry.stats.find((s) => s.name === name)?.value ?? 0;
				const getDisplay = (name: string) => entry.stats.find((s) => s.name === name)?.displayValue ?? "";

				standingsMap.set(teamId, {
					conference: confName,
					rank: getStat("playoffSeed"),
					wins: getStat("wins"),
					losses: getStat("losses"),
					winPct: getStat("winPercent"),
					streak: getDisplay("streak"),
					homeRecord: getDisplay("Home"),
					awayRecord: getDisplay("Road"),
					gamesBack: String(getStat("gamesBehind")),
					last10: getDisplay("Last Ten Games"),
					divisionRecord: getDisplay("vs. Div."),
					conferenceRecord: getDisplay("vs. Conf."),
					pointsFor: getStat("avgPointsFor"),
					pointsAgainst: getStat("avgPointsAgainst"),
				});
			}
		}

		// Process each game
		for (const event of events) {
			const competition = event.competitions[0];
			if (!competition) continue;

			const homeComp = competition.competitors.find((c) => c.homeAway === "home");
			const awayComp = competition.competitors.find((c) => c.homeAway === "away");
			if (!homeComp || !awayComp) continue;

			// Ensure team records exist
			const homeStandings = standingsMap.get(homeComp.team.id);
			const awayStandings = standingsMap.get(awayComp.team.id);

			const homeTeamId = await ctx.runMutation(internal.gleague.mutations.upsertTeam, {
				espnTeamId: homeComp.team.id,
				season,
				name: homeComp.team.displayName ?? homeComp.team.name ?? "Unknown",
				abbreviation: homeComp.team.abbreviation ?? "???",
				location: homeComp.team.location ?? "",
				slug: homeComp.team.slug ?? homeComp.team.id,
				conference: homeStandings?.conference,
				conferenceRank: homeStandings?.rank,
				wins: homeStandings?.wins ?? 0,
				losses: homeStandings?.losses ?? 0,
				winPct: homeStandings?.winPct,
				streak: homeStandings?.streak,
				homeRecord: homeStandings?.homeRecord,
				awayRecord: homeStandings?.awayRecord,
				gamesBack: homeStandings?.gamesBack,
				last10: homeStandings?.last10,
				divisionRecord: homeStandings?.divisionRecord,
				conferenceRecord: homeStandings?.conferenceRecord,
				pointsFor: homeStandings?.pointsFor,
				pointsAgainst: homeStandings?.pointsAgainst,
			});

			const awayTeamId = await ctx.runMutation(internal.gleague.mutations.upsertTeam, {
				espnTeamId: awayComp.team.id,
				season,
				name: awayComp.team.displayName ?? awayComp.team.name ?? "Unknown",
				abbreviation: awayComp.team.abbreviation ?? "???",
				location: awayComp.team.location ?? "",
				slug: awayComp.team.slug ?? awayComp.team.id,
				conference: awayStandings?.conference,
				conferenceRank: awayStandings?.rank,
				wins: awayStandings?.wins ?? 0,
				losses: awayStandings?.losses ?? 0,
				winPct: awayStandings?.winPct,
				streak: awayStandings?.streak,
				homeRecord: awayStandings?.homeRecord,
				awayRecord: awayStandings?.awayRecord,
				gamesBack: awayStandings?.gamesBack,
				last10: awayStandings?.last10,
				divisionRecord: awayStandings?.divisionRecord,
				conferenceRecord: awayStandings?.conferenceRecord,
				pointsFor: awayStandings?.pointsFor,
				pointsAgainst: awayStandings?.pointsAgainst,
			});

			const scheduledStart = competition.startDate
				? new Date(competition.startDate).getTime()
				: Date.now();

			const state = event.status?.type?.state;
			const eventStatus = mapApiStateToEventStatus(state, event.status?.type?.detail);

			const gameEventId = await ctx.runMutation(internal.gleague.mutations.upsertGameEvent, {
				espnGameId: event.id,
				season,
				homeTeamId,
				awayTeamId,
				gameDate: date,
				scheduledStart,
				eventStatus,
				statusDetail: event.status?.type?.detail,
				venue: competition.venue?.fullName,
				homeScore: parseInt(homeComp.score, 10) || undefined,
				awayScore: parseInt(awayComp.score, 10) || undefined,
			});

			// Schedule status check: scheduledStart + 2h15m
			if (eventStatus === "scheduled") {
				const checkTime = scheduledStart + 2 * 60 * 60 * 1000 + 15 * 60 * 1000;
				await ctx.scheduler.runAt(
					checkTime,
					internal.gleague.actions.checkGameStatus,
					{ gameEventId },
				);
				console.log(`[GLEAGUE] Scheduled check for game ${event.id} at ${new Date(checkTime).toISOString()}`);
			}
		}

		console.log(`[GLEAGUE] Discovery complete: ${events.length} games processed`);
	},
});

// Per-game status check (self-rescheduling)
// Looks up the game by Convex ID, then delegates to the full check logic
export const checkGameStatus = internalAction({
	args: { gameEventId: v.id("gleagueGameEvent") },
	handler: async (ctx, args) => {
		const game = await ctx.runQuery(internal.gleague.queries.getGameEventById, {
			gameEventId: args.gameEventId,
		});

		if (!game) {
			console.error(`[GLEAGUE] checkGameStatus: game event not found`);
			return;
		}

		// Delegate to the full check logic
		await ctx.runAction(internal.gleague.actions.checkGameStatusV2, {
			gameEventId: args.gameEventId,
			espnGameId: game.espnGameId,
		});
	},
});

// V2: Per-game status check with espnGameId (self-rescheduling)
export const checkGameStatusV2 = internalAction({
	args: {
		gameEventId: v.id("gleagueGameEvent"),
		espnGameId: v.string(),
	},
	handler: async (ctx, args) => {
		const baseUrl = getSiteApi();

		console.log(`[GLEAGUE] Checking game ${args.espnGameId}...`);

		// Fetch game summary from API provider
		let summaryData: ApiGameSummaryResponse;
		try {
			const response = await fetch(`${baseUrl}/summary?event=${args.espnGameId}`, {
				headers: { "Content-Type": "application/json" },
			});

			if (!response.ok) {
				console.error(`[GLEAGUE] Game summary fetch failed: ${response.status}`);
				// Reschedule in 15 minutes
				await ctx.scheduler.runAfter(15 * 60 * 1000, internal.gleague.actions.checkGameStatusV2, args);
				return;
			}

			summaryData = (await response.json()) as ApiGameSummaryResponse;
		} catch (error) {
			console.error(`[GLEAGUE] Game summary fetch error:`, error);
			await ctx.scheduler.runAfter(15 * 60 * 1000, internal.gleague.actions.checkGameStatusV2, args);
			return;
		}

		const competition = summaryData.header?.competitions?.[0];
		const state = competition?.status?.type?.state;
		const detail = competition?.status?.type?.detail;
		const eventStatus = mapApiStateToEventStatus(state, detail);

		// Get scores
		const homeComp = competition?.competitors?.find((c) => c.homeAway === "home");
		const awayComp = competition?.competitors?.find((c) => c.homeAway === "away");
		const homeScore = parseInt(homeComp?.score ?? "0", 10) || 0;
		const awayScore = parseInt(awayComp?.score ?? "0", 10) || 0;

		// Get current game to check count
		const currentGame = await ctx.runQuery(internal.gleague.queries.getGameEventInternal, {
			espnGameId: args.espnGameId,
		});
		const currentCheckCount = currentGame?.checkCount ?? 0;

		if (state === "pre") {
			// Game hasn't started yet, reschedule in 30 minutes
			console.log(`[GLEAGUE] Game ${args.espnGameId} hasn't started, rescheduling in 30min`);
			await ctx.runMutation(internal.gleague.mutations.updateGameEventStatus, {
				gameEventId: args.gameEventId,
				eventStatus: "scheduled",
				statusDetail: detail,
				checkCount: currentCheckCount + 1,
				lastFetchedAt: Date.now(),
			});

			if (currentCheckCount + 1 < 24) {
				await ctx.scheduler.runAfter(30 * 60 * 1000, internal.gleague.actions.checkGameStatusV2, args);
			} else {
				console.log(`[GLEAGUE] Abandoning game ${args.espnGameId} after ${currentCheckCount + 1} checks`);
			}
			return;
		}

		if (state === "in") {
			// Game in progress: update scores and stats
			console.log(`[GLEAGUE] Game ${args.espnGameId} in progress: ${awayScore}-${homeScore}`);

			await ctx.runMutation(internal.gleague.mutations.updateGameEventStatus, {
				gameEventId: args.gameEventId,
				eventStatus,
				statusDetail: detail,
				homeScore,
				awayScore,
				checkCount: currentCheckCount + 1,
				lastFetchedAt: Date.now(),
			});

			// Update box scores if available
			await syncBoxScoreData(ctx, args.gameEventId, args.espnGameId, summaryData);

			// Reschedule in 15 minutes
			if (currentCheckCount + 1 < 24) {
				await ctx.scheduler.runAfter(15 * 60 * 1000, internal.gleague.actions.checkGameStatusV2, args);
			}
			return;
		}

		if (state === "post") {
			// Game completed: final update
			console.log(`[GLEAGUE] Game ${args.espnGameId} completed: ${awayScore}-${homeScore}`);

			await ctx.runMutation(internal.gleague.mutations.updateGameEventStatus, {
				gameEventId: args.gameEventId,
				eventStatus: "completed",
				statusDetail: detail,
				homeScore,
				awayScore,
				lastFetchedAt: Date.now(),
			});

			// Final box score sync
			await syncBoxScoreData(ctx, args.gameEventId, args.espnGameId, summaryData);

			// Recalculate averages for both teams
			const game = await ctx.runQuery(internal.gleague.queries.getGameEventInternal, {
				espnGameId: args.espnGameId,
			});

			if (game) {
				await ctx.runMutation(internal.gleague.mutations.recalculateTeamAverages, {
					teamId: game.homeTeamId,
				});
				await ctx.runMutation(internal.gleague.mutations.recalculateTeamAverages, {
					teamId: game.awayTeamId,
				});

				// Recalculate player averages for all players in the game
				const playerEvents = await ctx.runQuery(internal.gleague.queries.getPlayerEventsByGame, {
					gameEventId: args.gameEventId,
				});

				const uniquePlayerIds = [...new Set(playerEvents.map((pe) => pe.playerId))];
				for (const playerId of uniquePlayerIds) {
					await ctx.runMutation(internal.gleague.mutations.recalculatePlayerAverages, {
						playerId,
					});
				}

				// Update league rankings
				await ctx.runMutation(internal.gleague.mutations.updateLeagueRankings, {
					season: game.season,
				});
			}

			console.log(`[GLEAGUE] Game ${args.espnGameId} fully processed`);
			return;
		}

		// Unknown state - reschedule if under limit
		if (currentCheckCount + 1 < 24) {
			await ctx.scheduler.runAfter(15 * 60 * 1000, internal.gleague.actions.checkGameStatusV2, args);
		}
	},
});

// Helper: sync box score data from API summary response into Convex
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncBoxScoreData(
	ctx: any,
	gameEventId: string,
	espnGameId: string,
	summaryData: ApiGameSummaryResponse,
) {
	const boxscoreTeams = summaryData.boxscore?.teams;
	const boxscorePlayers = summaryData.boxscore?.players;

	if (!boxscoreTeams || boxscoreTeams.length < 2) return;

	const competition = summaryData.header?.competitions?.[0];
	const headerHome = competition?.competitors?.find((c) => c.homeAway === "home");
	const headerAway = competition?.competitors?.find((c) => c.homeAway === "away");

	if (!headerHome || !headerAway) return;

	// Get team IDs from game event
	const game = await ctx.runQuery(internal.gleague.queries.getGameEventInternal, {
		espnGameId,
	});
	if (!game) return;

	const season = game.season;

	// Parse home team box score
	const homeBoxTeam = boxscoreTeams.find((t) => t.team.id === headerHome.team.id);
	const awayBoxTeam = boxscoreTeams.find((t) => t.team.id === headerAway.team.id);

	const homeStats = parseTeamBoxScore(homeBoxTeam?.statistics);
	const awayStats = parseTeamBoxScore(awayBoxTeam?.statistics);

	const homeScore = parseInt(headerHome.score, 10) || 0;
	const awayScore = parseInt(headerAway.score, 10) || 0;

	// Upsert team events
	if (homeBoxTeam) {
		await ctx.runMutation(internal.gleague.mutations.upsertTeamEvent, {
			gameEventId: game._id,
			teamId: game.homeTeamId,
			isHome: true,
			score: homeScore,
			oppScore: awayScore,
			winner: homeScore > awayScore,
			...homeStats,
		});
	}

	if (awayBoxTeam) {
		await ctx.runMutation(internal.gleague.mutations.upsertTeamEvent, {
			gameEventId: game._id,
			teamId: game.awayTeamId,
			isHome: false,
			score: awayScore,
			oppScore: homeScore,
			winner: awayScore > homeScore,
			...awayStats,
		});
	}

	// Parse and upsert player events
	const homePlayers = boxscorePlayers?.find((p) => p.team.id === headerHome.team.id);
	const awayPlayers = boxscorePlayers?.find((p) => p.team.id === headerAway.team.id);

	const processPlayerBoxScores = async (
		parsedPlayers: ReturnType<typeof parsePlayerBoxScores>,
		teamId: typeof game.homeTeamId,
	) => {
		for (const player of parsedPlayers) {
			// Ensure player record exists
			const playerId = await ctx.runMutation(internal.gleague.mutations.upsertPlayer, {
				espnPlayerId: player.espnPlayerId,
				season,
				teamId,
				name: player.name,
				jersey: player.jersey,
				position: player.position,
			});

			// Upsert player event
			await ctx.runMutation(internal.gleague.mutations.upsertPlayerEvent, {
				gameEventId: game._id,
				teamId,
				playerId,
				starter: player.starter,
				active: player.active,
				minutes: player.minutes,
				points: player.points,
				totalRebounds: player.totalRebounds,
				offensiveRebounds: player.offensiveRebounds,
				defensiveRebounds: player.defensiveRebounds,
				assists: player.assists,
				steals: player.steals,
				blocks: player.blocks,
				turnovers: player.turnovers,
				fouls: player.fouls,
				fieldGoalsMade: player.fieldGoalsMade,
				fieldGoalsAttempted: player.fieldGoalsAttempted,
				threePointMade: player.threePointMade,
				threePointAttempted: player.threePointAttempted,
				freeThrowsMade: player.freeThrowsMade,
				freeThrowsAttempted: player.freeThrowsAttempted,
				plusMinus: player.plusMinus,
			});
		}
	};

	const homePlayerBoxScores = parsePlayerBoxScores(homePlayers);
	const awayPlayerBoxScores = parsePlayerBoxScores(awayPlayers);

	await processPlayerBoxScores(homePlayerBoxScores, game.homeTeamId);
	await processPlayerBoxScores(awayPlayerBoxScores, game.awayTeamId);
}

// Sync a live game from API provider (triggered by page load server function)
export const syncLiveGameData = internalAction({
	args: {
		espnGameId: v.string(),
	},
	handler: async (ctx, args) => {
		const baseUrl = getSiteApi();
		const season = getCurrentSeason();

		// Check if recently fetched (15s throttle)
		const existingGame = await ctx.runQuery(internal.gleague.queries.getGameEventInternal, {
			espnGameId: args.espnGameId,
		});

		if (existingGame?.lastFetchedAt && Date.now() - existingGame.lastFetchedAt < 15_000) {
			return; // Data is fresh enough
		}

		// Fetch from API provider
		const response = await fetch(`${baseUrl}/summary?event=${args.espnGameId}`, {
			headers: { "Content-Type": "application/json" },
		});

		if (!response.ok) {
			console.error(`[GLEAGUE] Live sync fetch failed for ${args.espnGameId}: ${response.status}`);
			return;
		}

		const summaryData = (await response.json()) as ApiGameSummaryResponse;

		const competition = summaryData.header?.competitions?.[0];
		const state = competition?.status?.type?.state;
		const detail = competition?.status?.type?.detail;
		const eventStatus = mapApiStateToEventStatus(state, detail);

		const homeComp = competition?.competitors?.find((c) => c.homeAway === "home");
		const awayComp = competition?.competitors?.find((c) => c.homeAway === "away");
		if (!homeComp || !awayComp) return;

		const homeScore = parseInt(homeComp.score, 10) || 0;
		const awayScore = parseInt(awayComp.score, 10) || 0;

		// Look up teams first to avoid overwriting standings data
		const existingHomeTeam = await ctx.runQuery(internal.gleague.queries.getTeamInternal, {
			espnTeamId: homeComp.team.id, season,
		});
		const homeTeamId = existingHomeTeam?._id ?? await ctx.runMutation(internal.gleague.mutations.upsertTeam, {
			espnTeamId: homeComp.team.id,
			season,
			name: homeComp.team.displayName ?? homeComp.team.name ?? "Unknown",
			abbreviation: homeComp.team.abbreviation ?? "???",
			location: homeComp.team.location ?? "",
			slug: homeComp.team.slug ?? homeComp.team.id,
			wins: 0,
			losses: 0,
		});

		const existingAwayTeam = await ctx.runQuery(internal.gleague.queries.getTeamInternal, {
			espnTeamId: awayComp.team.id, season,
		});
		const awayTeamId = existingAwayTeam?._id ?? await ctx.runMutation(internal.gleague.mutations.upsertTeam, {
			espnTeamId: awayComp.team.id,
			season,
			name: awayComp.team.displayName ?? awayComp.team.name ?? "Unknown",
			abbreviation: awayComp.team.abbreviation ?? "???",
			location: awayComp.team.location ?? "",
			slug: awayComp.team.slug ?? awayComp.team.id,
			wins: 0,
			losses: 0,
		});

		const scheduledStart = competition?.date
			? new Date(competition.date).getTime()
			: Date.now();

		// Upsert game event
		const gameEventId = await ctx.runMutation(internal.gleague.mutations.upsertGameEvent, {
			espnGameId: args.espnGameId,
			season,
			homeTeamId,
			awayTeamId,
			gameDate: formatGameDate(scheduledStart),
			scheduledStart,
			eventStatus,
			statusDetail: detail,
			venue: competition?.venue?.fullName,
			homeScore,
			awayScore,
			lastFetchedAt: Date.now(),
		});

		// Sync box score data
		await syncBoxScoreData(ctx, gameEventId, args.espnGameId, summaryData);
	},
});

// Public action: trigger live game sync (called from TanStack server functions)
export const requestGameSync = action({
	args: { espnGameId: v.string() },
	handler: async (ctx, args) => {
		await ctx.runAction(internal.gleague.actions.syncLiveGameData, {
			espnGameId: args.espnGameId,
		});
	},
});

// ============================================================================
// BOOTSTRAP / BACKFILL ACTIONS
// Run order: bootstrapTeams → bootstrapPlayers → backfillGames → recalculateAll
// ============================================================================

// Step 1: Bootstrap all G-League teams from API standings
export const bootstrapTeams = internalAction({
	args: { bootstrapRunId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const season = getCurrentSeason();
		const baseUrl = getSiteApi();

		console.log(`[GLEAGUE Bootstrap] Fetching standings for season ${season}...`);

		const standingsUrl = baseUrl.replace("/site/v2/", "/v2/") + "/standings";
		const standingsRes = await fetch(standingsUrl, {
			headers: { "User-Agent": "Mozilla/5.0" },
		});

		if (!standingsRes.ok) {
			throw new Error(`[GLEAGUE Bootstrap] Standings fetch failed: ${standingsRes.status}`);
		}

		const standingsData = (await standingsRes.json()) as ApiStandingsResponse;
		const conferences = standingsData.children ?? [];

		let teamCount = 0;

		for (const conf of conferences) {
			const confName = conf.name ?? "";
			for (const entry of conf.standings?.entries ?? []) {
				const team = entry.team;
				const getStat = (name: string) => entry.stats.find((s) => s.name === name)?.value ?? 0;
				const getDisplay = (name: string) => entry.stats.find((s) => s.name === name)?.displayValue ?? "";

				await ctx.runMutation(internal.gleague.mutations.upsertTeam, {
					espnTeamId: team.id,
					season,
					name: team.displayName ?? "Unknown",
					abbreviation: team.abbreviation ?? "???",
					location: team.location ?? "",
					slug: team.slug ?? team.id,
					conference: confName,
					conferenceRank: getStat("playoffSeed"),
					wins: getStat("wins"),
					losses: getStat("losses"),
					winPct: getStat("winPercent"),
					streak: getDisplay("streak"),
					homeRecord: getDisplay("Home"),
					awayRecord: getDisplay("Road"),
					gamesBack: String(getStat("gamesBehind")),
					last10: getDisplay("Last Ten Games"),
					divisionRecord: getDisplay("vs. Div."),
					conferenceRecord: getDisplay("vs. Conf."),
					pointsFor: getStat("avgPointsFor"),
					pointsAgainst: getStat("avgPointsAgainst"),
				});

				teamCount++;
			}
		}

		console.log(`[GLEAGUE Bootstrap] Created/updated ${teamCount} teams`);

		if (args.bootstrapRunId) {
			await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
				league: "gleague",
				completedStep: "teams",
			});
		}
	},
});

// Step 2: Bootstrap players from rosters (entry point)
export const bootstrapPlayers = internalAction({
	args: { bootstrapRunId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const season = getCurrentSeason();

		console.log(`[GLEAGUE Bootstrap] Starting player roster bootstrap for season ${season}...`);

		const teams = await ctx.runQuery(internal.gleague.queries.getAllTeamsInternal, { season });

		if (teams.length === 0) {
			console.error("[GLEAGUE Bootstrap] No teams found. Run bootstrapTeams first.");
			if (args.bootstrapRunId) {
				await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
					league: "gleague",
					completedStep: "players",
				});
			}
			return;
		}

		const teamInfos = teams.map((t) => ({ espnTeamId: t.espnTeamId, convexTeamId: t._id }));

		console.log(`[GLEAGUE Bootstrap] Found ${teams.length} teams, scheduling roster fetches...`);

		await ctx.scheduler.runAfter(100, internal.gleague.actions.bootstrapPlayersChunk, {
			teamInfos,
			offset: 0,
			bootstrapRunId: args.bootstrapRunId,
		});
	},
});

// Step 2b: Bootstrap players chunk (self-scheduling)
export const bootstrapPlayersChunk = internalAction({
	args: {
		teamInfos: v.array(v.object({
			espnTeamId: v.string(),
			convexTeamId: v.id("gleagueTeam"),
		})),
		offset: v.number(),
		bootstrapRunId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check for cancellation before processing
		if (args.bootstrapRunId) {
			const cancelled = await ctx.runMutation(internal.bootstrapAdmin.checkCancelled, { league: "gleague" });
			if (cancelled) {
				console.log(`[GLEAGUE Bootstrap] Cancelled during player roster bootstrap`);
				return;
			}
		}

		const season = getCurrentSeason();
		const commonBase = getCommonApi();
		const chunk = args.teamInfos.slice(args.offset, args.offset + ROSTER_TEAMS_PER_CHUNK);

		if (chunk.length === 0) {
			console.log(`[GLEAGUE Bootstrap] Player roster bootstrap complete!`);
			if (args.bootstrapRunId) {
				await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
					league: "gleague",
					completedStep: "players",
				});
			}
			return;
		}

		// Update progress
		if (args.bootstrapRunId) {
			await ctx.runMutation(internal.bootstrapAdmin.updateProgress, {
				league: "gleague",
				progress: `Roster ${args.offset + 1}-${Math.min(args.offset + chunk.length, args.teamInfos.length)} of ${args.teamInfos.length} teams`,
			});
		}

		console.log(`[GLEAGUE Bootstrap] Processing rosters for teams ${args.offset + 1}-${args.offset + chunk.length} of ${args.teamInfos.length}...`);

		for (const teamInfo of chunk) {
			try {
				const response = await fetch(`${commonBase}/teams/${teamInfo.espnTeamId}/roster`, {
					headers: { "Content-Type": "application/json" },
				});

				if (!response.ok) {
					console.error(`[GLEAGUE Bootstrap] Roster fetch failed for team ${teamInfo.espnTeamId}: ${response.status}`);
					continue;
				}

				const rosterData = (await response.json()) as ApiRosterResponse;
				const allGroup = rosterData.positionGroups?.find((g) => g.type === "all");
				const athletes = allGroup?.athletes ?? rosterData.positionGroups?.[0]?.athletes ?? [];

				for (const athlete of athletes) {
					await ctx.runMutation(internal.gleague.mutations.upsertPlayer, {
						espnPlayerId: athlete.id,
						season,
						teamId: teamInfo.convexTeamId,
						name: athlete.displayName,
						firstName: athlete.firstName,
						lastName: athlete.lastName,
						jersey: athlete.jersey,
						position: athlete.position?.abbreviation,
						headshot: athlete.headshot?.href,
						height: athlete.displayHeight,
						weight: athlete.displayWeight,
						age: athlete.age,
						experience: athlete.experience?.years !== undefined
							? `${athlete.experience.years}`
							: undefined,
						college: athlete.college?.name,
					});
				}

				console.log(`[GLEAGUE Bootstrap] Team ${teamInfo.espnTeamId}: ${athletes.length} players`);
				await sleep(BACKFILL_GAME_DELAY_MS);
			} catch (error) {
				console.error(`[GLEAGUE Bootstrap] Error fetching roster for team ${teamInfo.espnTeamId}:`, error);
			}
		}

		const nextOffset = args.offset + ROSTER_TEAMS_PER_CHUNK;
		if (nextOffset < args.teamInfos.length) {
			await ctx.scheduler.runAfter(BACKFILL_DELAY_MS, internal.gleague.actions.bootstrapPlayersChunk, {
				teamInfos: args.teamInfos,
				offset: nextOffset,
				bootstrapRunId: args.bootstrapRunId,
			});
		} else {
			console.log(`[GLEAGUE Bootstrap] All player rosters processed!`);
			if (args.bootstrapRunId) {
				await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
					league: "gleague",
					completedStep: "players",
				});
			}
		}
	},
});

// Step 3: Backfill historical games (entry point)
export const backfillGames = internalAction({
	args: {
		startDate: v.optional(v.string()),
		endDate: v.optional(v.string()),
		bootstrapRunId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const season = getCurrentSeason();
		const startDate = args.startDate ?? getSeasonStartDate(season);
		const endDate = args.endDate ?? getTodayDateUTC();
		const dates = getDateRange(startDate, endDate);

		console.log(`[GLEAGUE Backfill] Starting game backfill: ${startDate} to ${endDate} (${dates.length} dates)`);

		await ctx.scheduler.runAfter(100, internal.gleague.actions.backfillDateChunk, {
			dates,
			offset: 0,
			bootstrapRunId: args.bootstrapRunId,
		});
	},
});

// Step 3b: Backfill games for a single date (self-scheduling)
export const backfillDateChunk = internalAction({
	args: {
		dates: v.array(v.string()),
		offset: v.number(),
		bootstrapRunId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check for cancellation before processing
		if (args.bootstrapRunId) {
			const cancelled = await ctx.runMutation(internal.bootstrapAdmin.checkCancelled, { league: "gleague" });
			if (cancelled) {
				console.log(`[GLEAGUE Backfill] Cancelled during game backfill`);
				return;
			}
		}

		if (args.offset >= args.dates.length) {
			console.log(`[GLEAGUE Backfill] All dates processed! Run recalculateAll to compute averages.`);
			if (args.bootstrapRunId) {
				await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
					league: "gleague",
					completedStep: "backfill",
				});
			}
			return;
		}

		// Update progress
		if (args.bootstrapRunId) {
			await ctx.runMutation(internal.bootstrapAdmin.updateProgress, {
				league: "gleague",
				progress: `Date ${args.offset + 1} of ${args.dates.length}`,
			});
		}

		const date = args.dates[args.offset];
		const season = getCurrentSeason();
		const baseUrl = getSiteApi();

		console.log(`[GLEAGUE Backfill] Processing date ${date} (${args.offset + 1}/${args.dates.length})...`);

		try {
			const scoreboardRes = await fetch(`${baseUrl}/scoreboard?dates=${date}`, {
				headers: { "Content-Type": "application/json" },
			});

			if (!scoreboardRes.ok) {
				console.error(`[GLEAGUE Backfill] Scoreboard fetch failed for ${date}: ${scoreboardRes.status}`);
				await ctx.scheduler.runAfter(BACKFILL_DELAY_MS, internal.gleague.actions.backfillDateChunk, {
					dates: args.dates,
					offset: args.offset + 1,
				});
				return;
			}

			const scoreboardData = (await scoreboardRes.json()) as ApiScoreboardResponse;
			const events = scoreboardData.events ?? [];

			console.log(`[GLEAGUE Backfill] ${date}: ${events.length} games found`);

			let processedGames = 0;

			for (const event of events) {
				const competition = event.competitions[0];
				if (!competition) continue;

				const homeComp = competition.competitors.find((c) => c.homeAway === "home");
				const awayComp = competition.competitors.find((c) => c.homeAway === "away");
				if (!homeComp || !awayComp) continue;

				// Look up teams first to avoid overwriting standings data
				const existingHomeTeam = await ctx.runQuery(internal.gleague.queries.getTeamInternal, {
					espnTeamId: homeComp.team.id, season,
				});
				const homeTeamId = existingHomeTeam?._id ?? await ctx.runMutation(internal.gleague.mutations.upsertTeam, {
					espnTeamId: homeComp.team.id,
					season,
					name: homeComp.team.displayName ?? homeComp.team.name ?? "Unknown",
					abbreviation: homeComp.team.abbreviation ?? "???",
					location: homeComp.team.location ?? "",
					slug: homeComp.team.slug ?? homeComp.team.id,
					wins: 0,
					losses: 0,
				});

				const existingAwayTeam = await ctx.runQuery(internal.gleague.queries.getTeamInternal, {
					espnTeamId: awayComp.team.id, season,
				});
				const awayTeamId = existingAwayTeam?._id ?? await ctx.runMutation(internal.gleague.mutations.upsertTeam, {
					espnTeamId: awayComp.team.id,
					season,
					name: awayComp.team.displayName ?? awayComp.team.name ?? "Unknown",
					abbreviation: awayComp.team.abbreviation ?? "???",
					location: awayComp.team.location ?? "",
					slug: awayComp.team.slug ?? awayComp.team.id,
					wins: 0,
					losses: 0,
				});

				const scheduledStart = competition.startDate
					? new Date(competition.startDate).getTime()
					: Date.now();

				const state = event.status?.type?.state;
				const eventStatus = mapApiStateToEventStatus(state, event.status?.type?.detail);

				const gameEventId = await ctx.runMutation(internal.gleague.mutations.upsertGameEvent, {
					espnGameId: event.id,
					season,
					homeTeamId,
					awayTeamId,
					gameDate: date,
					scheduledStart,
					eventStatus,
					statusDetail: event.status?.type?.detail,
					venue: competition.venue?.fullName,
					homeScore: parseInt(homeComp.score, 10) || undefined,
					awayScore: parseInt(awayComp.score, 10) || undefined,
				});

				if (state === "post") {
					try {
						await sleep(BACKFILL_GAME_DELAY_MS);

						const summaryRes = await fetch(`${baseUrl}/summary?event=${event.id}`, {
							headers: { "Content-Type": "application/json" },
						});

						if (summaryRes.ok) {
							const summaryData = (await summaryRes.json()) as ApiGameSummaryResponse;
							await syncBoxScoreData(ctx, gameEventId, event.id, summaryData);
							processedGames++;
						} else {
							console.error(`[GLEAGUE Backfill] Summary fetch failed for game ${event.id}: ${summaryRes.status}`);
						}
					} catch (error) {
						console.error(`[GLEAGUE Backfill] Error processing game ${event.id}:`, error);
					}
				}
			}

			console.log(`[GLEAGUE Backfill] ${date}: processed ${processedGames} completed games`);
		} catch (error) {
			console.error(`[GLEAGUE Backfill] Error processing date ${date}:`, error);
		}

		await ctx.scheduler.runAfter(BACKFILL_DELAY_MS, internal.gleague.actions.backfillDateChunk, {
			dates: args.dates,
			offset: args.offset + 1,
			bootstrapRunId: args.bootstrapRunId,
		});
	},
});

// Step 4: Recalculate all averages and rankings
export const recalculateAll = internalAction({
	args: { bootstrapRunId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const season = getCurrentSeason();

		console.log(`[GLEAGUE Recalculate] Starting full recalculation for season ${season}...`);

		const teams = await ctx.runQuery(internal.gleague.queries.getAllTeamsInternal, { season });
		console.log(`[GLEAGUE Recalculate] Recalculating averages for ${teams.length} teams...`);

		for (const team of teams) {
			await ctx.runMutation(internal.gleague.mutations.recalculateTeamAverages, {
				teamId: team._id,
			});
		}

		console.log(`[GLEAGUE Recalculate] Team averages done. Recalculating player averages...`);

		const players = await ctx.runQuery(internal.gleague.queries.getAllPlayersInternal, { season });
		console.log(`[GLEAGUE Recalculate] Recalculating averages for ${players.length} players...`);

		for (const player of players) {
			await ctx.runMutation(internal.gleague.mutations.recalculatePlayerAverages, {
				playerId: player._id,
			});
		}

		console.log(`[GLEAGUE Recalculate] Updating league rankings...`);
		await ctx.runMutation(internal.gleague.mutations.updateLeagueRankings, { season });

		console.log(`[GLEAGUE Recalculate] Full recalculation complete!`);

		if (args.bootstrapRunId) {
			await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
				league: "gleague",
				completedStep: "recalculate",
			});
		}
	},
});

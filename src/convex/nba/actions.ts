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
const BACKFILL_DELAY_MS = 2000; // Delay between self-scheduled chunks
const BACKFILL_GAME_DELAY_MS = 3000; // Delay between individual game fetches within a chunk
const ROSTER_TEAMS_PER_CHUNK = 5; // Teams to process per roster bootstrap chunk

function getSiteApi(): string {
	const url = process.env.NBA_SITE_API;
	if (!url) throw new Error("NBA_SITE_API not configured");
	return url;
}

function getCommonApi(): string {
	const url = process.env.NBA_COMMON_API;
	if (!url) throw new Error("NBA_COMMON_API not configured");
	return url;
}

/** Get the start date for a season (late October). */
function getSeasonStartDate(season: string): string {
	const startYear = parseInt(season.split("-")[0], 10);
	// NBA season typically starts in late October
	return `${startYear}1022`;
}

/** Get the end date for the regular season (mid-April). */
function getSeasonEndDate(season: string): string {
	const endYear = parseInt(season.split("-")[0], 10) + 1;
	return `${endYear}0420`;
}

// Daily cron: discover today's games, update standings
export const discoverTodaysGames = internalAction({
	args: {},
	handler: async (ctx) => {
		const season = getCurrentSeason();
		const date = getTodayDateUTC();
		const baseUrl = getSiteApi();

		console.log(`[NBA] Discovering games for ${date}, season ${season}...`);

		// Fetch scoreboard
		const scoreboardRes = await fetch(`${baseUrl}/scoreboard?dates=${date}`, {
			headers: { "Content-Type": "application/json" },
		});

		if (!scoreboardRes.ok) {
			console.error(`[NBA] Scoreboard fetch failed: ${scoreboardRes.status}`);
			return;
		}

		const scoreboardData = (await scoreboardRes.json()) as ApiScoreboardResponse;
		const events = scoreboardData.events ?? [];

		console.log(`[NBA] Found ${events.length} games for ${date}`);

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
			console.error("[NBA] Standings fetch failed:", error);
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

			const homeTeamId = await ctx.runMutation(internal.nba.mutations.upsertTeam, {
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

			const awayTeamId = await ctx.runMutation(internal.nba.mutations.upsertTeam, {
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

			const gameEventId = await ctx.runMutation(internal.nba.mutations.upsertGameEvent, {
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
					internal.nba.actions.checkGameStatus,
					{ gameEventId },
				);
				console.log(`[NBA] Scheduled check for game ${event.id} at ${new Date(checkTime).toISOString()}`);
			}
		}

		console.log(`[NBA] Discovery complete: ${events.length} games processed`);
	},
});

// Per-game status check (self-rescheduling)
// Looks up the game by Convex ID, then delegates to the full check logic
export const checkGameStatus = internalAction({
	args: { gameEventId: v.id("nbaGameEvent") },
	handler: async (ctx, args) => {
		const game = await ctx.runQuery(internal.nba.queries.getGameEventById, {
			gameEventId: args.gameEventId,
		});

		if (!game) {
			console.error(`[NBA] checkGameStatus: game event not found`);
			return;
		}

		// Delegate to the full check logic
		await ctx.runAction(internal.nba.actions.checkGameStatusV2, {
			gameEventId: args.gameEventId,
			espnGameId: game.espnGameId,
		});
	},
});

// V2: Per-game status check with espnGameId (self-rescheduling)
export const checkGameStatusV2 = internalAction({
	args: {
		gameEventId: v.id("nbaGameEvent"),
		espnGameId: v.string(),
	},
	handler: async (ctx, args) => {
		const baseUrl = getSiteApi();

		console.log(`[NBA] Checking game ${args.espnGameId}...`);

		// Fetch game summary from API provider
		let summaryData: ApiGameSummaryResponse;
		try {
			const response = await fetch(`${baseUrl}/summary?event=${args.espnGameId}`, {
				headers: { "Content-Type": "application/json" },
			});

			if (!response.ok) {
				console.error(`[NBA] Game summary fetch failed: ${response.status}`);
				// Reschedule in 15 minutes
				await ctx.scheduler.runAfter(15 * 60 * 1000, internal.nba.actions.checkGameStatusV2, args);
				return;
			}

			summaryData = (await response.json()) as ApiGameSummaryResponse;
		} catch (error) {
			console.error(`[NBA] Game summary fetch error:`, error);
			await ctx.scheduler.runAfter(15 * 60 * 1000, internal.nba.actions.checkGameStatusV2, args);
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
		const currentGame = await ctx.runQuery(internal.nba.queries.getGameEventInternal, {
			espnGameId: args.espnGameId,
		});
		const currentCheckCount = currentGame?.checkCount ?? 0;

		if (state === "pre") {
			// Game hasn't started yet, reschedule in 30 minutes
			console.log(`[NBA] Game ${args.espnGameId} hasn't started, rescheduling in 30min`);
			await ctx.runMutation(internal.nba.mutations.updateGameEventStatus, {
				gameEventId: args.gameEventId,
				eventStatus: "scheduled",
				statusDetail: detail,
				checkCount: currentCheckCount + 1,
				lastFetchedAt: Date.now(),
			});

			if (currentCheckCount + 1 < 24) {
				await ctx.scheduler.runAfter(30 * 60 * 1000, internal.nba.actions.checkGameStatusV2, args);
			} else {
				console.log(`[NBA] Abandoning game ${args.espnGameId} after ${currentCheckCount + 1} checks`);
			}
			return;
		}

		if (state === "in") {
			// Game in progress: update scores and stats
			console.log(`[NBA] Game ${args.espnGameId} in progress: ${awayScore}-${homeScore}`);

			await ctx.runMutation(internal.nba.mutations.updateGameEventStatus, {
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
				await ctx.scheduler.runAfter(15 * 60 * 1000, internal.nba.actions.checkGameStatusV2, args);
			}
			return;
		}

		if (state === "post") {
			// Game completed: final update
			console.log(`[NBA] Game ${args.espnGameId} completed: ${awayScore}-${homeScore}`);

			await ctx.runMutation(internal.nba.mutations.updateGameEventStatus, {
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
			const game = await ctx.runQuery(internal.nba.queries.getGameEventInternal, {
				espnGameId: args.espnGameId,
			});

			if (game) {
				await ctx.runMutation(internal.nba.mutations.recalculateTeamAverages, {
					teamId: game.homeTeamId,
				});
				await ctx.runMutation(internal.nba.mutations.recalculateTeamAverages, {
					teamId: game.awayTeamId,
				});

				// Recalculate player averages for all players in the game
				const playerEvents = await ctx.runQuery(internal.nba.queries.getPlayerEventsByGame, {
					gameEventId: args.gameEventId,
				});

				const uniquePlayerIds = [...new Set(playerEvents.map((pe) => pe.playerId))];
				for (const playerId of uniquePlayerIds) {
					await ctx.runMutation(internal.nba.mutations.recalculatePlayerAverages, {
						playerId,
					});
				}

				// Update league rankings
				await ctx.runMutation(internal.nba.mutations.updateLeagueRankings, {
					season: game.season,
				});
			}

			console.log(`[NBA] Game ${args.espnGameId} fully processed`);
			return;
		}

		// Unknown state - reschedule if under limit
		if (currentCheckCount + 1 < 24) {
			await ctx.scheduler.runAfter(15 * 60 * 1000, internal.nba.actions.checkGameStatusV2, args);
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
	const game = await ctx.runQuery(internal.nba.queries.getGameEventInternal, {
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
		await ctx.runMutation(internal.nba.mutations.upsertTeamEvent, {
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
		await ctx.runMutation(internal.nba.mutations.upsertTeamEvent, {
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
			const playerId = await ctx.runMutation(internal.nba.mutations.upsertPlayer, {
				espnPlayerId: player.espnPlayerId,
				season,
				teamId,
				name: player.name,
				jersey: player.jersey,
				position: player.position,
			});

			// Upsert player event
			await ctx.runMutation(internal.nba.mutations.upsertPlayerEvent, {
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
		const existingGame = await ctx.runQuery(internal.nba.queries.getGameEventInternal, {
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
			console.error(`[NBA] Live sync fetch failed for ${args.espnGameId}: ${response.status}`);
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
		const existingHomeTeam = await ctx.runQuery(internal.nba.queries.getTeamInternal, {
			espnTeamId: homeComp.team.id, season,
		});
		const homeTeamId = existingHomeTeam?._id ?? await ctx.runMutation(internal.nba.mutations.upsertTeam, {
			espnTeamId: homeComp.team.id,
			season,
			name: homeComp.team.displayName ?? homeComp.team.name ?? "Unknown",
			abbreviation: homeComp.team.abbreviation ?? "???",
			location: homeComp.team.location ?? "",
			slug: homeComp.team.slug ?? homeComp.team.id,
			wins: 0,
			losses: 0,
		});

		const existingAwayTeam = await ctx.runQuery(internal.nba.queries.getTeamInternal, {
			espnTeamId: awayComp.team.id, season,
		});
		const awayTeamId = existingAwayTeam?._id ?? await ctx.runMutation(internal.nba.mutations.upsertTeam, {
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
		const gameEventId = await ctx.runMutation(internal.nba.mutations.upsertGameEvent, {
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
		await ctx.runAction(internal.nba.actions.syncLiveGameData, {
			espnGameId: args.espnGameId,
		});
	},
});

// ============================================================================
// BOOTSTRAP / BACKFILL ACTIONS
// These are one-time actions for initial data population.
// Run order: bootstrapTeams → bootstrapPlayers → backfillGames → recalculateAll
// ============================================================================

// Step 1: Bootstrap all NBA teams from standings
export const bootstrapTeams = internalAction({
	args: { bootstrapRunId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const season = getCurrentSeason();
		const baseUrl = getSiteApi();

		console.log(`[NBA Bootstrap] Fetching standings for season ${season}...`);

		// Fetch standings
		const standingsUrl = baseUrl.replace("/site/v2/", "/v2/") + "/standings";
		const standingsRes = await fetch(standingsUrl, {
			headers: { "User-Agent": "Mozilla/5.0" },
		});

		if (!standingsRes.ok) {
			throw new Error(`[NBA Bootstrap] Standings fetch failed: ${standingsRes.status}`);
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

				await ctx.runMutation(internal.nba.mutations.upsertTeam, {
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

		console.log(`[NBA Bootstrap] Created/updated ${teamCount} teams`);

		if (args.bootstrapRunId) {
			await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
				league: "nba",
				completedStep: "teams",
			});
		}
	},
});

// Helper: fetch a team's roster from the API and upsert all players into Convex
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAndUpsertRoster(
	ctx: any,
	commonBase: string,
	espnTeamId: string,
	convexTeamId: string,
	season: string,
): Promise<number> {
	const response = await fetch(`${commonBase}/teams/${espnTeamId}/roster`, {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		console.error(`[NBA Bootstrap] Roster fetch failed for team ${espnTeamId}: ${response.status}`);
		return 0;
	}

	const rosterData = (await response.json()) as ApiRosterResponse;
	const allGroup = rosterData.positionGroups?.find((g) => g.type === "all");
	const athletes = allGroup?.athletes ?? rosterData.positionGroups?.[0]?.athletes ?? [];

	for (const athlete of athletes) {
		await ctx.runMutation(internal.nba.mutations.upsertPlayer, {
			espnPlayerId: athlete.id,
			season,
			teamId: convexTeamId,
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

	return athletes.length;
}

// Step 2: Bootstrap players from rosters (entry point)
export const bootstrapPlayers = internalAction({
	args: { bootstrapRunId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const season = getCurrentSeason();

		console.log(`[NBA Bootstrap] Starting player roster bootstrap for season ${season}...`);

		// Get all teams
		const teams = await ctx.runQuery(internal.nba.queries.getAllTeamsInternal, { season });

		if (teams.length === 0) {
			console.error("[NBA Bootstrap] No teams found. Run bootstrapTeams first.");
			if (args.bootstrapRunId) {
				await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
					league: "nba",
					completedStep: "players",
				});
			}
			return;
		}

		// Collect team info for chunking
		const teamInfos = teams.map((t) => ({ espnTeamId: t.espnTeamId, convexTeamId: t._id }));

		console.log(`[NBA Bootstrap] Found ${teams.length} teams, scheduling roster fetches...`);

		// Schedule first chunk
		await ctx.scheduler.runAfter(100, internal.nba.actions.bootstrapPlayersChunk, {
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
			convexTeamId: v.id("nbaTeam"),
		})),
		offset: v.number(),
		bootstrapRunId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check for cancellation before processing
		if (args.bootstrapRunId) {
			const cancelled = await ctx.runMutation(internal.bootstrapAdmin.checkCancelled, { league: "nba" });
			if (cancelled) {
				console.log(`[NBA Bootstrap] Cancelled during player roster bootstrap`);
				return;
			}
		}

		const season = getCurrentSeason();
		const commonBase = getCommonApi();
		const chunk = args.teamInfos.slice(args.offset, args.offset + ROSTER_TEAMS_PER_CHUNK);

		if (chunk.length === 0) {
			console.log(`[NBA Bootstrap] Player roster bootstrap complete!`);
			if (args.bootstrapRunId) {
				await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
					league: "nba",
					completedStep: "players",
				});
			}
			return;
		}

		// Update progress
		if (args.bootstrapRunId) {
			await ctx.runMutation(internal.bootstrapAdmin.updateProgress, {
				league: "nba",
				progress: `Roster ${args.offset + 1}-${Math.min(args.offset + chunk.length, args.teamInfos.length)} of ${args.teamInfos.length} teams`,
			});
		}

		console.log(`[NBA Bootstrap] Processing rosters for teams ${args.offset + 1}-${args.offset + chunk.length} of ${args.teamInfos.length}...`);

		for (const teamInfo of chunk) {
			try {
				const playerCount = await fetchAndUpsertRoster(ctx, commonBase, teamInfo.espnTeamId, teamInfo.convexTeamId, season);
				console.log(`[NBA Bootstrap] Team ${teamInfo.espnTeamId}: ${playerCount} players`);
				await sleep(BACKFILL_GAME_DELAY_MS);
			} catch (error) {
				console.error(`[NBA Bootstrap] Error fetching roster for team ${teamInfo.espnTeamId}:`, error);
			}
		}

		// Schedule next chunk
		const nextOffset = args.offset + ROSTER_TEAMS_PER_CHUNK;
		if (nextOffset < args.teamInfos.length) {
			await ctx.scheduler.runAfter(BACKFILL_DELAY_MS, internal.nba.actions.bootstrapPlayersChunk, {
				teamInfos: args.teamInfos,
				offset: nextOffset,
				bootstrapRunId: args.bootstrapRunId,
			});
		} else {
			console.log(`[NBA Bootstrap] All player rosters processed!`);
			if (args.bootstrapRunId) {
				await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
					league: "nba",
					completedStep: "players",
				});
			}
		}
	},
});

// Bootstrap a single team's players (for testing)
export const bootstrapSingleTeamPlayers = internalAction({
	args: {
		espnTeamId: v.string(),
	},
	handler: async (ctx, args) => {
		const season = getCurrentSeason();
		const commonBase = getCommonApi();

		const team = await ctx.runQuery(internal.nba.queries.getTeamInternal, {
			espnTeamId: args.espnTeamId, season,
		});

		if (!team) {
			console.error(`[NBA Bootstrap] Team ${args.espnTeamId} not found. Run bootstrapTeams first.`);
			return;
		}

		console.log(`[NBA Bootstrap] Fetching roster for ${team.name} (${args.espnTeamId})...`);

		const playerCount = await fetchAndUpsertRoster(ctx, commonBase, args.espnTeamId, team._id, season);

		console.log(`[NBA Bootstrap] ${team.name}: ${playerCount} players bootstrapped`);
	},
});

// Step 3: Backfill historical games (entry point)
export const backfillGames = internalAction({
	args: {
		startDate: v.optional(v.string()), // YYYYMMDD, defaults to season start
		endDate: v.optional(v.string()),   // YYYYMMDD, defaults to today
		targetEspnTeamId: v.optional(v.string()), // Only backfill games involving this team
		bootstrapRunId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const season = getCurrentSeason();
		const startDate = args.startDate ?? getSeasonStartDate(season);
		const endDate = args.endDate ?? getSeasonEndDate(season);
		const dates = getDateRange(startDate, endDate);

		const teamLabel = args.targetEspnTeamId ? ` for team ${args.targetEspnTeamId}` : "";
		console.log(`[NBA Backfill] Starting game backfill${teamLabel}: ${startDate} to ${endDate} (${dates.length} dates)`);

		// Schedule first chunk
		await ctx.scheduler.runAfter(100, internal.nba.actions.backfillDateChunk, {
			dates,
			offset: 0,
			targetEspnTeamId: args.targetEspnTeamId,
			bootstrapRunId: args.bootstrapRunId,
		});
	},
});

// Step 3b: Backfill games for a single date (self-scheduling)
export const backfillDateChunk = internalAction({
	args: {
		dates: v.array(v.string()),
		offset: v.number(),
		targetEspnTeamId: v.optional(v.string()),
		bootstrapRunId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check for cancellation before processing
		if (args.bootstrapRunId) {
			const cancelled = await ctx.runMutation(internal.bootstrapAdmin.checkCancelled, { league: "nba" });
			if (cancelled) {
				console.log(`[NBA Backfill] Cancelled during game backfill`);
				return;
			}
		}

		if (args.offset >= args.dates.length) {
			console.log(`[NBA Backfill] All dates processed! Run recalculateAll to compute averages.`);
			if (args.bootstrapRunId) {
				await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
					league: "nba",
					completedStep: "backfill",
				});
			}
			return;
		}

		// Update progress
		if (args.bootstrapRunId) {
			await ctx.runMutation(internal.bootstrapAdmin.updateProgress, {
				league: "nba",
				progress: `Date ${args.offset + 1} of ${args.dates.length}`,
			});
		}

		const date = args.dates[args.offset];
		const season = getCurrentSeason();
		const baseUrl = getSiteApi();

		console.log(`[NBA Backfill] Processing date ${date} (${args.offset + 1}/${args.dates.length})...`);

		try {
			// Fetch scoreboard for this date
			const scoreboardRes = await fetch(`${baseUrl}/scoreboard?dates=${date}`, {
				headers: { "Content-Type": "application/json" },
			});

			if (!scoreboardRes.ok) {
				console.error(`[NBA Backfill] Scoreboard fetch failed for ${date}: ${scoreboardRes.status}`);
				// Skip this date, continue with next
				await ctx.scheduler.runAfter(BACKFILL_DELAY_MS, internal.nba.actions.backfillDateChunk, {
					dates: args.dates,
					offset: args.offset + 1,
					targetEspnTeamId: args.targetEspnTeamId,
				});
				return;
			}

			const scoreboardData = (await scoreboardRes.json()) as ApiScoreboardResponse;
			const events = scoreboardData.events ?? [];

			console.log(`[NBA Backfill] ${date}: ${events.length} games found`);

			let processedGames = 0;

			for (const event of events) {
				const competition = event.competitions[0];
				if (!competition) continue;

				const homeComp = competition.competitors.find((c) => c.homeAway === "home");
				const awayComp = competition.competitors.find((c) => c.homeAway === "away");
				if (!homeComp || !awayComp) continue;

				// If filtering by team, skip games that don't involve the target team
				if (args.targetEspnTeamId && homeComp.team.id !== args.targetEspnTeamId && awayComp.team.id !== args.targetEspnTeamId) {
					continue;
				}

				// Look up teams first to avoid overwriting standings data
				const existingHomeTeam = await ctx.runQuery(internal.nba.queries.getTeamInternal, {
					espnTeamId: homeComp.team.id, season,
				});
				const homeTeamId = existingHomeTeam?._id ?? await ctx.runMutation(internal.nba.mutations.upsertTeam, {
					espnTeamId: homeComp.team.id,
					season,
					name: homeComp.team.displayName ?? homeComp.team.name ?? "Unknown",
					abbreviation: homeComp.team.abbreviation ?? "???",
					location: homeComp.team.location ?? "",
					slug: homeComp.team.slug ?? homeComp.team.id,
					wins: 0,
					losses: 0,
				});

				const existingAwayTeam = await ctx.runQuery(internal.nba.queries.getTeamInternal, {
					espnTeamId: awayComp.team.id, season,
				});
				const awayTeamId = existingAwayTeam?._id ?? await ctx.runMutation(internal.nba.mutations.upsertTeam, {
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

				const gameEventId = await ctx.runMutation(internal.nba.mutations.upsertGameEvent, {
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

				// For completed games, fetch full box score
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
							console.error(`[NBA Backfill] Summary fetch failed for game ${event.id}: ${summaryRes.status}`);
						}
					} catch (error) {
						console.error(`[NBA Backfill] Error processing game ${event.id}:`, error);
					}
				}
			}

			console.log(`[NBA Backfill] ${date}: processed ${processedGames} completed games`);
		} catch (error) {
			console.error(`[NBA Backfill] Error processing date ${date}:`, error);
		}

		// Schedule next date
		await ctx.scheduler.runAfter(BACKFILL_DELAY_MS, internal.nba.actions.backfillDateChunk, {
			dates: args.dates,
			offset: args.offset + 1,
			targetEspnTeamId: args.targetEspnTeamId,
			bootstrapRunId: args.bootstrapRunId,
		});
	},
});

// Standalone: backfill only upcoming scheduled games (today → season end)
// Use this to fill in missing schedule without re-running the full backfill.
export const backfillUpcomingSchedule = internalAction({
	args: {},
	handler: async (ctx) => {
		const season = getCurrentSeason();
		const startDate = getTodayDateUTC();
		const endDate = getSeasonEndDate(season);
		const dates = getDateRange(startDate, endDate);

		console.log(`[NBA Schedule] Backfilling upcoming schedule: ${startDate} to ${endDate} (${dates.length} dates)`);

		await ctx.scheduler.runAfter(100, internal.nba.actions.backfillDateChunk, {
			dates,
			offset: 0,
		});
	},
});

// Step 4: Recalculate all averages and rankings
export const recalculateAll = internalAction({
	args: { bootstrapRunId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const season = getCurrentSeason();

		console.log(`[NBA Recalculate] Starting full recalculation for season ${season}...`);

		// Recalculate team averages
		const teams = await ctx.runQuery(internal.nba.queries.getAllTeamsInternal, { season });
		console.log(`[NBA Recalculate] Recalculating averages for ${teams.length} teams...`);

		for (const team of teams) {
			await ctx.runMutation(internal.nba.mutations.recalculateTeamAverages, {
				teamId: team._id,
			});
		}

		console.log(`[NBA Recalculate] Team averages done. Recalculating player averages...`);

		// Recalculate player averages
		const players = await ctx.runQuery(internal.nba.queries.getAllPlayersInternal, { season });
		console.log(`[NBA Recalculate] Recalculating averages for ${players.length} players...`);

		for (const player of players) {
			await ctx.runMutation(internal.nba.mutations.recalculatePlayerAverages, {
				playerId: player._id,
			});
		}

		// Update league rankings
		console.log(`[NBA Recalculate] Updating league rankings...`);
		await ctx.runMutation(internal.nba.mutations.updateLeagueRankings, { season });

		console.log(`[NBA Recalculate] Full recalculation complete!`);

		if (args.bootstrapRunId) {
			await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
				league: "nba",
				completedStep: "recalculate",
			});
		}
	},
});

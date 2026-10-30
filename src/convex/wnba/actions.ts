import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import {
	getCompetitionYear,
	getCurrentSeason,
	getTodayDate,
	formatGameDate,
	mapApiStateToEventStatus,
	sleep,
	getDateRange,
	getScheduleSyncRange,
	parseEspnSeason,
	seasonFromEspnYear,
} from "../shared/seasonHelpers";
import { parseTeamBoxScore, parsePlayerBoxScores, getTotalRecord } from "../shared/apiParser";
import type {
	ApiEventSeason,
	ApiScoreboardResponse,
	ApiGameSummaryResponse,
	ApiStandingsResponse,
	ApiStandingsTeamEntry,
	ApiRosterResponse,
} from "../shared/apiParser";

// Bootstrap constants
const BACKFILL_DELAY_MS = 2000;
const BACKFILL_GAME_DELAY_MS = 3000;
const ROSTER_TEAMS_PER_CHUNK = 5;

function getSiteApi(): string {
	const url = process.env.WNBA_SITE_API;
	if (!url) throw new Error("WNBA_SITE_API not configured");
	return url;
}

function getCommonApi(): string {
	const url = process.env.WNBA_COMMON_API;
	if (!url) throw new Error("WNBA_COMMON_API not configured");
	return url;
}

function getCoreApi(): string {
	const url = process.env.WNBA_CORE_API;
	if (!url) throw new Error("WNBA_CORE_API not configured");
	return url;
}

function getCoreSeasonYear(season: string): number {
	return getCompetitionYear("wnba", season);
}

function toFiniteNumber(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	return value;
}

type PlayerSeasonStatsPatch = {
	gamesPlayed?: number;
	gamesStarted?: number;
	minutesPerGame?: number;
	pointsPerGame?: number;
	reboundsPerGame?: number;
	assistsPerGame?: number;
	stealsPerGame?: number;
	blocksPerGame?: number;
	turnoversPerGame?: number;
	fieldGoalPct?: number;
	threePointPct?: number;
	freeThrowPct?: number;
	offRebPerGame?: number;
	defRebPerGame?: number;
	totalFgMade?: number;
	totalFgAttempted?: number;
	totalThreeMade?: number;
	totalThreeAttempted?: number;
	totalFtMade?: number;
	totalFtAttempted?: number;
};

type BackfillPlayerStatsArgs = {
	season?: string;
	limit?: number;
	dryRun?: boolean;
};

function extractCoreStatValue(corePayload: unknown, statName: string): number | undefined {
	const categories = (corePayload as { splits?: { categories?: Array<{ stats?: Array<{ name?: string; value?: unknown }> }> } })
		?.splits?.categories;

	if (!categories) return undefined;

	for (const category of categories) {
		for (const stat of category.stats ?? []) {
			if (stat.name === statName) return toFiniteNumber(stat.value);
		}
	}

	return undefined;
}

function compactPatch<T extends Record<string, number | undefined>>(patch: T): T {
	return Object.fromEntries(
		Object.entries(patch).filter(([, value]) => value !== undefined),
	) as T;
}

function playerNeedsPatch(player: Record<string, unknown>, patch: PlayerSeasonStatsPatch): boolean {
	return Object.entries(patch).some(([key, value]) => {
		if (value === undefined) return false;
		return player[key] !== value;
	});
}

async function fetchPlayerSeasonStatsFromCore(
	coreBase: string,
	coreSeasonYear: number,
	espnPlayerId: string,
): Promise<PlayerSeasonStatsPatch | null> {
	const url = `${coreBase}/seasons/${coreSeasonYear}/types/2/athletes/${espnPlayerId}/statistics/0?lang=en&region=us`;
	const response = await fetch(url, {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		return null;
	}

	const corePayload = await response.json();

	const patch = compactPatch<PlayerSeasonStatsPatch>({
		gamesPlayed: extractCoreStatValue(corePayload, "gamesPlayed"),
		gamesStarted: extractCoreStatValue(corePayload, "gamesStarted"),
		minutesPerGame: extractCoreStatValue(corePayload, "avgMinutes"),
		pointsPerGame: extractCoreStatValue(corePayload, "avgPoints"),
		reboundsPerGame: extractCoreStatValue(corePayload, "avgRebounds"),
		assistsPerGame: extractCoreStatValue(corePayload, "avgAssists"),
		stealsPerGame: extractCoreStatValue(corePayload, "avgSteals"),
		blocksPerGame: extractCoreStatValue(corePayload, "avgBlocks"),
		turnoversPerGame: extractCoreStatValue(corePayload, "avgTurnovers"),
		fieldGoalPct: extractCoreStatValue(corePayload, "fieldGoalPct"),
		threePointPct: extractCoreStatValue(corePayload, "threePointPct"),
		freeThrowPct: extractCoreStatValue(corePayload, "freeThrowPct"),
		offRebPerGame: extractCoreStatValue(corePayload, "avgOffensiveRebounds"),
		defRebPerGame: extractCoreStatValue(corePayload, "avgDefensiveRebounds"),
		totalFgMade: extractCoreStatValue(corePayload, "fieldGoalsMade"),
		totalFgAttempted: extractCoreStatValue(corePayload, "fieldGoalsAttempted"),
		totalThreeMade: extractCoreStatValue(corePayload, "threePointFieldGoalsMade"),
		totalThreeAttempted: extractCoreStatValue(corePayload, "threePointFieldGoalsAttempted"),
		totalFtMade: extractCoreStatValue(corePayload, "freeThrowsMade"),
		totalFtAttempted: extractCoreStatValue(corePayload, "freeThrowsAttempted"),
	});

	return Object.keys(patch).length > 0 ? patch : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runCorePlayerStatsBackfill(ctx: any, args: BackfillPlayerStatsArgs) {
	const season = args.season ?? (await getCurrentSeasonName(ctx));
	const coreSeasonYear = getCoreSeasonYear(season);
	const coreBase = getCoreApi();
	const allPlayers = await ctx.runQuery(internal.wnba.queries.getAllPlayersInternal, {
		season,
	});
	const max = args.limit && args.limit > 0 ? args.limit : allPlayers.length;
	const players = allPlayers.slice(0, max);

	let scanned = 0;
	let patched = 0;
	let unchanged = 0;
	let missing = 0;
	let errors = 0;

	for (const player of players) {
		scanned += 1;
		try {
			const patch = await fetchPlayerSeasonStatsFromCore(
				coreBase,
				coreSeasonYear,
				player.espnPlayerId,
			);

			if (!patch) {
				missing += 1;
				continue;
			}

			if (!playerNeedsPatch(player as Record<string, unknown>, patch)) {
				unchanged += 1;
				continue;
			}

			if (!args.dryRun) {
				await ctx.runMutation(internal.wnba.mutations.patchPlayerSeasonStats, {
					playerId: player._id,
					...patch,
				});
			}

			patched += 1;
		} catch (error) {
			errors += 1;
			console.error(
				`[WNBA] Core stat backfill failed for player ${player.espnPlayerId}:`,
				error,
			);
		}
	}

	return {
		season,
		coreSeasonYear,
		dryRun: !!args.dryRun,
		scanned,
		patched,
		unchanged,
		missing,
		errors,
	};
}

function getSeasonStartDate(season: string): string {
	const competitionYear = getCompetitionYear("wnba", season);
	// WNBA season typically starts in May
	return `${competitionYear}0501`;
}

/** Get the end date for the WNBA regular season (mid-September). */
function getSeasonEndDate(season: string): string {
	const competitionYear = getCompetitionYear("wnba", season);
	return `${competitionYear}0920`;
}

function compactIsoDate(date: string): string {
	return date.replaceAll("-", "");
}

async function getCurrentSeasonName(ctx: any): Promise<string> {
	return (
		(await ctx.runQuery(api.seasons.getCurrentName, { league: "wnba" })) ??
		getCurrentSeason()
	);
}

async function getCurrentSeasonEventDate(
	ctx: any,
	eventType: "preseasonStart" | "playoffEnd",
	fallback: string,
): Promise<string> {
	const date = await ctx.runQuery(api.seasons.getCurrentEventDate, {
		league: "wnba",
		eventType,
	});
	return date ? compactIsoDate(date) : fallback;
}

function parseApiScore(rawScore: string | undefined): number | undefined {
	if (rawScore === undefined) return undefined;
	const parsed = Number.parseInt(rawScore, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function isSuspiciousBlowoutWithZero(
	homeScore: number | undefined,
	awayScore: number | undefined,
): boolean {
	if (homeScore === undefined || awayScore === undefined) return false;
	return (homeScore === 0 && awayScore >= 80) || (awayScore === 0 && homeScore >= 80);
}

async function logScoreAnomaly(
	ctx: any,
	input: {
		espnGameId: string;
		anomalyType: string;
		source: string;
		message: string;
		eventStatus?: string;
		homeScore?: number;
		awayScore?: number;
		rawHomeScore?: string;
		rawAwayScore?: string;
	},
) {
	try {
		await ctx.runMutation(internal.bootstrapAdmin.logScoreAnomaly, {
			league: "wnba",
			...input,
		});
	} catch (error) {
		console.error("[WNBA] Failed to persist score anomaly:", error);
	}
}

// Lazily resolve the current season, only when ESPN omits an event's season
function createSeasonFallback(ctx: any): () => Promise<string> {
	let cached: Promise<string> | undefined;
	return () => (cached ??= getCurrentSeasonName(ctx));
}

async function resolveEventSeason(
	espnSeason: ApiEventSeason | undefined,
	fallback: () => Promise<string>,
): Promise<{ season: string; seasonType?: number }> {
	const parsed = parseEspnSeason("wnba", espnSeason);
	return {
		season: parsed.season ?? (await fallback()),
		seasonType: parsed.seasonType,
	};
}

type ApiTeamInfo = {
	id: string;
	name?: string;
	displayName?: string;
	abbreviation?: string;
	slug?: string;
	location?: string;
};

function teamInfoArgs(team: ApiTeamInfo) {
	return {
		espnTeamId: team.id,
		name: team.displayName ?? team.name ?? "Unknown",
		abbreviation: team.abbreviation ?? "???",
		location: team.location ?? "",
		slug: team.slug ?? team.id,
	};
}

// Ensure a team row exists for the season without touching its standings record
async function ensureTeam(ctx: any, team: ApiTeamInfo, season: string) {
	const existing = await ctx.runQuery(internal.wnba.queries.getTeamInternal, {
		espnTeamId: team.id,
		season,
	});
	return existing?._id ?? await ctx.runMutation(internal.wnba.mutations.upsertTeam, {
		...teamInfoArgs(team),
		season,
	});
}

type StandingsRecord = {
	conference: string;
	conferenceRank: number;
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
};

type StandingsSnapshot = {
	season?: string;
	teams: Array<{ team: ApiStandingsTeamEntry["team"]; record: StandingsRecord }>;
};

// Prefer the per-group season: in the offseason ESPN's top-level season
// already points at the next year while the rows are still last season's.
function getStandingsSeason(data: ApiStandingsResponse): string | undefined {
	const groupYear = data.children?.find((c) => typeof c.standings?.season === "number")?.standings?.season;
	const year = groupYear ?? data.season?.year;
	return typeof year === "number" && Number.isFinite(year) ? seasonFromEspnYear("wnba", year) : undefined;
}

function parseStandings(data: ApiStandingsResponse): StandingsSnapshot {
	const teams: StandingsSnapshot["teams"] = [];

	for (const conf of data.children ?? []) {
		const confName = conf.name ?? "";
		for (const entry of conf.standings?.entries ?? []) {
			const getStat = (name: string) => entry.stats.find((s) => s.name === name)?.value ?? 0;
			const getDisplay = (name: string) => entry.stats.find((s) => s.name === name)?.displayValue ?? "";

			teams.push({
				team: entry.team,
				record: {
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
				},
			});
		}
	}

	return { season: getStandingsSeason(data), teams };
}

// Fetch and parse league standings; null when the request fails
async function fetchStandings(): Promise<StandingsSnapshot | null> {
	const standingsUrl = getSiteApi().replace("/site/v2/", "/v2/") + "/standings";
	try {
		const standingsRes = await fetch(standingsUrl, {
			headers: { "User-Agent": "Mozilla/5.0" },
		});
		if (!standingsRes.ok) {
			console.error(`[WNBA] Standings fetch failed: ${standingsRes.status}`);
			return null;
		}
		return parseStandings((await standingsRes.json()) as ApiStandingsResponse);
	} catch (error) {
		console.error("[WNBA] Standings fetch failed:", error);
		return null;
	}
}

async function scheduleStandingsRefresh(ctx: any) {
	await ctx.scheduler.runAfter(60_000, internal.wnba.actions.refreshStandings, {});
}

// Refresh every team's record from ESPN standings (cron + after games complete)
export const refreshStandings = internalAction({
	args: {},
	handler: async (ctx) => {
		const standings = await fetchStandings();
		if (!standings) return;
		if (!standings.season) {
			console.error("[WNBA] Standings payload has no season; skipping refresh");
			return;
		}

		for (const { team, record } of standings.teams) {
			await ctx.runMutation(internal.wnba.mutations.upsertTeam, {
				...teamInfoArgs(team),
				season: standings.season,
				...record,
			});
		}

		console.log(`[WNBA] Refreshed standings for ${standings.teams.length} teams, season ${standings.season}`);
	},
});

// Daily cron: discover today's games, update standings
export const discoverTodaysGames = internalAction({
	args: {},
	handler: async (ctx) => {
		const fallbackSeason = createSeasonFallback(ctx);
		const date = getTodayDate();
		const baseUrl = getSiteApi();

		console.log(`[WNBA] Discovering games for ${date}...`);

		// Fetch scoreboard
		const scoreboardRes = await fetch(`${baseUrl}/scoreboard?dates=${date}`, {
			headers: { "Content-Type": "application/json" },
		});

		if (!scoreboardRes.ok) {
			console.error(`[WNBA] Scoreboard fetch failed: ${scoreboardRes.status}`);
			return;
		}

		const scoreboardData = (await scoreboardRes.json()) as ApiScoreboardResponse;
		const events = scoreboardData.events ?? [];

		console.log(`[WNBA] Found ${events.length} games for ${date}`);

		// Also fetch standings to update team records
		const standings = await fetchStandings();
		const standingsMap = new Map(
			(standings?.teams ?? []).map(({ team, record }) => [team.id, record]),
		);

		// Process each game
		for (const event of events) {
			const competition = event.competitions[0];
			if (!competition) continue;

			const homeComp = competition.competitors.find((c) => c.homeAway === "home");
			const awayComp = competition.competitors.find((c) => c.homeAway === "away");
			if (!homeComp || !awayComp) continue;

			const { season, seasonType } = await resolveEventSeason(event.season, fallbackSeason);

			// Standings rows only describe their own season; without them, leave records alone
			const seasonStandings = standings?.season === season ? standingsMap : undefined;

			const homeTeamId = await ctx.runMutation(internal.wnba.mutations.upsertTeam, {
				...teamInfoArgs(homeComp.team),
				season,
				...seasonStandings?.get(homeComp.team.id),
			});

			const awayTeamId = await ctx.runMutation(internal.wnba.mutations.upsertTeam, {
				...teamInfoArgs(awayComp.team),
				season,
				...seasonStandings?.get(awayComp.team.id),
			});

			const scheduledStart = competition.startDate
				? new Date(competition.startDate).getTime()
				: Date.now();

			const state = event.status?.type?.state;
			const eventStatus = mapApiStateToEventStatus(state, event.status?.type?.detail);

			const gameEventId = await ctx.runMutation(internal.wnba.mutations.upsertGameEvent, {
				espnGameId: event.id,
				season,
				seasonType,
				homeTeamId,
				awayTeamId,
				gameDate: date,
				scheduledStart,
				eventStatus,
				statusDetail: event.status?.type?.detail,
				venue: competition.venue?.fullName,
				homeScore: parseApiScore(homeComp.score),
				awayScore: parseApiScore(awayComp.score),
				homeTeamRecord: getTotalRecord(homeComp),
				awayTeamRecord: getTotalRecord(awayComp),
				// Fresh check budget for the status check scheduled below
				checkCount: eventStatus === "scheduled" ? 0 : undefined,
			});

			// Schedule status check: scheduledStart + 2h15m
			if (eventStatus === "scheduled") {
				const checkTime = scheduledStart + 2 * 60 * 60 * 1000 + 15 * 60 * 1000;
				await ctx.scheduler.runAt(
					checkTime,
					internal.wnba.actions.checkGameStatus,
					{ gameEventId },
				);
				console.log(`[WNBA] Scheduled check for game ${event.id} at ${new Date(checkTime).toISOString()}`);
			}
		}

		console.log(`[WNBA] Discovery complete: ${events.length} games processed`);
	},
});

// Per-game status check (self-rescheduling)
// Looks up the game by Convex ID, then delegates to the full check logic
export const checkGameStatus = internalAction({
	args: { gameEventId: v.id("wnbaGameEvent") },
	handler: async (ctx, args) => {
		const game = await ctx.runQuery(internal.wnba.queries.getGameEventById, {
			gameEventId: args.gameEventId,
		});

		if (!game) {
			console.error(`[WNBA] checkGameStatus: game event not found`);
			return;
		}

		// Delegate to the full check logic
		await ctx.runAction(internal.wnba.actions.checkGameStatusV2, {
			gameEventId: args.gameEventId,
			espnGameId: game.espnGameId,
		});
	},
});

// V2: Per-game status check with espnGameId (self-rescheduling)
export const checkGameStatusV2 = internalAction({
	args: {
		gameEventId: v.id("wnbaGameEvent"),
		espnGameId: v.string(),
	},
	handler: async (ctx, args) => {
		const baseUrl = getSiteApi();

		console.log(`[WNBA] Checking game ${args.espnGameId}...`);

		// Fetch game summary from API provider
		let summaryData: ApiGameSummaryResponse;
		try {
			const response = await fetch(`${baseUrl}/summary?event=${args.espnGameId}`, {
				headers: { "Content-Type": "application/json" },
			});

			if (!response.ok) {
				console.error(`[WNBA] Game summary fetch failed: ${response.status}`);
				// Reschedule in 15 minutes
				await ctx.scheduler.runAfter(15 * 60 * 1000, internal.wnba.actions.checkGameStatusV2, args);
				return;
			}

			summaryData = (await response.json()) as ApiGameSummaryResponse;
		} catch (error) {
			console.error(`[WNBA] Game summary fetch error:`, error);
			await ctx.scheduler.runAfter(15 * 60 * 1000, internal.wnba.actions.checkGameStatusV2, args);
			return;
		}

		const competition = summaryData.header?.competitions?.[0];
		const state = competition?.status?.type?.state;
		const detail = competition?.status?.type?.detail;
		const eventStatus = mapApiStateToEventStatus(state, detail);

		// Get scores
		const homeComp = competition?.competitors?.find((c) => c.homeAway === "home");
		const awayComp = competition?.competitors?.find((c) => c.homeAway === "away");
		const homeScore = parseApiScore(homeComp?.score);
		const awayScore = parseApiScore(awayComp?.score);
		const { seasonType } = parseEspnSeason("wnba", summaryData.header?.season);

		// Get current game to check count
		const currentGame = await ctx.runQuery(internal.wnba.queries.getGameEventInternal, {
			espnGameId: args.espnGameId,
		});
		const currentCheckCount = currentGame?.checkCount ?? 0;

		if (state === "pre") {
			// Game hasn't started yet, reschedule in 30 minutes
			console.log(`[WNBA] Game ${args.espnGameId} hasn't started, rescheduling in 30min`);
			await ctx.runMutation(internal.wnba.mutations.updateGameEventStatus, {
				gameEventId: args.gameEventId,
				seasonType,
				eventStatus: "scheduled",
				statusDetail: detail,
				checkCount: currentCheckCount + 1,
				lastFetchedAt: Date.now(),
			});

			if (currentCheckCount + 1 < 24) {
				await ctx.scheduler.runAfter(30 * 60 * 1000, internal.wnba.actions.checkGameStatusV2, args);
			} else {
				console.log(`[WNBA] Abandoning game ${args.espnGameId} after ${currentCheckCount + 1} checks`);
			}
			return;
		}

		if (state === "in") {
			// Game in progress: update scores and stats
			if (homeScore === undefined || awayScore === undefined) {
				const message = `[WNBA][SCORE_ANOMALY] In-progress game ${args.espnGameId} missing score(s): home=${homeComp?.score ?? "undefined"}, away=${awayComp?.score ?? "undefined"}`;
				console.error(message);
				await logScoreAnomaly(ctx, {
					espnGameId: args.espnGameId,
					anomalyType: "missing_in_progress_score",
					source: "checkGameStatusV2",
					message,
					eventStatus,
					rawHomeScore: homeComp?.score,
					rawAwayScore: awayComp?.score,
				});
				await ctx.runMutation(internal.wnba.mutations.updateGameEventStatus, {
					gameEventId: args.gameEventId,
					seasonType,
					eventStatus,
					statusDetail: detail,
					checkCount: currentCheckCount + 1,
					lastFetchedAt: Date.now(),
				});
				if (currentCheckCount + 1 < 24) {
					await ctx.scheduler.runAfter(2 * 60 * 1000, internal.wnba.actions.checkGameStatusV2, args);
				}
				return;
			}

			console.log(`[WNBA] Game ${args.espnGameId} in progress: ${awayScore}-${homeScore}`);

			await ctx.runMutation(internal.wnba.mutations.updateGameEventStatus, {
				gameEventId: args.gameEventId,
				seasonType,
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
				await ctx.scheduler.runAfter(15 * 60 * 1000, internal.wnba.actions.checkGameStatusV2, args);
			}
			return;
		}

		if (state === "post") {
			// Game completed: final update
			if (homeScore === undefined || awayScore === undefined) {
				const message = `[WNBA][SCORE_ANOMALY] Final state for game ${args.espnGameId} has incomplete score: home=${homeComp?.score ?? "undefined"}, away=${awayComp?.score ?? "undefined"}`;
				console.error(message);
				await logScoreAnomaly(ctx, {
					espnGameId: args.espnGameId,
					anomalyType: "missing_final_score",
					source: "checkGameStatusV2",
					message,
					eventStatus,
					rawHomeScore: homeComp?.score,
					rawAwayScore: awayComp?.score,
				});
				await ctx.runMutation(internal.wnba.mutations.updateGameEventStatus, {
					gameEventId: args.gameEventId,
					seasonType,
					eventStatus: currentGame?.eventStatus === "completed" ? "in_progress" : (currentGame?.eventStatus ?? "in_progress"),
					statusDetail: detail,
					checkCount: currentCheckCount + 1,
					lastFetchedAt: Date.now(),
				});
				if (currentCheckCount + 1 < 24) {
					await ctx.scheduler.runAfter(2 * 60 * 1000, internal.wnba.actions.checkGameStatusV2, args);
				}
				return;
			}

			if (isSuspiciousBlowoutWithZero(homeScore, awayScore)) {
				const message = `[WNBA][SCORE_ANOMALY] Suspicious final score for game ${args.espnGameId}: ${awayScore}-${homeScore}. Delaying completion and retrying.`;
				console.error(message);
				await logScoreAnomaly(ctx, {
					espnGameId: args.espnGameId,
					anomalyType: "suspicious_final_zero_blowout",
					source: "checkGameStatusV2",
					message,
					eventStatus,
					homeScore,
					awayScore,
				});
				await ctx.runMutation(internal.wnba.mutations.updateGameEventStatus, {
					gameEventId: args.gameEventId,
					seasonType,
					eventStatus: currentGame?.eventStatus === "completed" ? "in_progress" : (currentGame?.eventStatus ?? "in_progress"),
					statusDetail: detail,
					checkCount: currentCheckCount + 1,
					lastFetchedAt: Date.now(),
				});
				if (currentCheckCount + 1 < 24) {
					await ctx.scheduler.runAfter(2 * 60 * 1000, internal.wnba.actions.checkGameStatusV2, args);
				}
				return;
			}

			console.log(`[WNBA] Game ${args.espnGameId} completed: ${awayScore}-${homeScore}`);
			const wasCompleted = currentGame?.eventStatus === "completed";

			await ctx.runMutation(internal.wnba.mutations.updateGameEventStatus, {
				gameEventId: args.gameEventId,
				seasonType,
				eventStatus: "completed",
				statusDetail: detail,
				homeScore,
				awayScore,
				homeTeamRecord: getTotalRecord(homeComp),
				awayTeamRecord: getTotalRecord(awayComp),
				lastFetchedAt: Date.now(),
			});

			// Final box score sync
			await syncBoxScoreData(ctx, args.gameEventId, args.espnGameId, summaryData);

			// Pull fresh W-L once ESPN has had a moment to post the result
			if (!wasCompleted) {
				await scheduleStandingsRefresh(ctx);
			}

			// Recalculate averages for both teams
			const game = await ctx.runQuery(internal.wnba.queries.getGameEventInternal, {
				espnGameId: args.espnGameId,
			});

			if (game) {
				await ctx.runMutation(internal.wnba.mutations.recalculateTeamAverages, {
					teamId: game.homeTeamId,
				});
				await ctx.runMutation(internal.wnba.mutations.recalculateTeamAverages, {
					teamId: game.awayTeamId,
				});

				// Update league rankings
				await ctx.runMutation(internal.wnba.mutations.updateLeagueRankings, {
					season: game.season,
				});
			}

			console.log(`[WNBA] Game ${args.espnGameId} fully processed`);
			return;
		}

		// Unknown state - reschedule if under limit
		if (currentCheckCount + 1 < 24) {
			await ctx.scheduler.runAfter(15 * 60 * 1000, internal.wnba.actions.checkGameStatusV2, args);
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
	const game = await ctx.runQuery(internal.wnba.queries.getGameEventInternal, {
		espnGameId,
	});
	if (!game) return;

	const season = game.season;

	// Parse home team box score
	const homeBoxTeam = boxscoreTeams.find((t) => t.team.id === headerHome.team.id);
	const awayBoxTeam = boxscoreTeams.find((t) => t.team.id === headerAway.team.id);

	const homeStats = parseTeamBoxScore(homeBoxTeam?.statistics);
	const awayStats = parseTeamBoxScore(awayBoxTeam?.statistics);

	const homeScore = parseApiScore(headerHome.score);
	const awayScore = parseApiScore(headerAway.score);
	if (homeScore === undefined || awayScore === undefined) {
		const message = `[WNBA][SCORE_ANOMALY] Box score sync skipped for ${espnGameId}; missing header score(s): home=${headerHome.score ?? "undefined"}, away=${headerAway.score ?? "undefined"}`;
		console.error(message);
		await logScoreAnomaly(ctx, {
			espnGameId,
			anomalyType: "missing_boxscore_header_score",
			source: "syncBoxScoreData",
			message,
			rawHomeScore: headerHome.score,
			rawAwayScore: headerAway.score,
		});
		return;
	}

	// Upsert team events
	if (homeBoxTeam) {
		await ctx.runMutation(internal.wnba.mutations.upsertTeamEvent, {
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
		await ctx.runMutation(internal.wnba.mutations.upsertTeamEvent, {
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
			const playerId = await ctx.runMutation(internal.wnba.mutations.upsertPlayer, {
				espnPlayerId: player.espnPlayerId,
				season,
				teamId,
				name: player.name,
				jersey: player.jersey,
				position: player.position,
			});

			// Upsert player event
			await ctx.runMutation(internal.wnba.mutations.upsertPlayerEvent, {
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

		// Check if recently fetched (15s throttle)
		const existingGame = await ctx.runQuery(internal.wnba.queries.getGameEventInternal, {
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
			console.error(`[WNBA] Live sync fetch failed for ${args.espnGameId}: ${response.status}`);
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

		const homeScore = parseApiScore(homeComp.score);
		const awayScore = parseApiScore(awayComp.score);
		const scoresAreComplete = homeScore !== undefined && awayScore !== undefined;
		const suspiciousFinal = eventStatus === "completed" && isSuspiciousBlowoutWithZero(homeScore, awayScore);
		// ESPN has no score before tipoff; that's expected, not an anomaly
		const isPreGame = state === "pre";
		if (!scoresAreComplete && !isPreGame) {
			const message = `[WNBA][SCORE_ANOMALY] Live sync missing score(s) for ${args.espnGameId}: home=${homeComp.score ?? "undefined"}, away=${awayComp.score ?? "undefined"}, state=${state ?? "unknown"}`;
			console.error(message);
			await logScoreAnomaly(ctx, {
				espnGameId: args.espnGameId,
				anomalyType: "missing_live_sync_score",
				source: "syncLiveGameData",
				message,
				eventStatus,
				rawHomeScore: homeComp.score,
				rawAwayScore: awayComp.score,
			});
		}
		if (suspiciousFinal) {
			const message = `[WNBA][SCORE_ANOMALY] Live sync suspicious final for ${args.espnGameId}: ${awayScore}-${homeScore}. Keeping prior status until next sync.`;
			console.error(message);
			await logScoreAnomaly(ctx, {
				espnGameId: args.espnGameId,
				anomalyType: "suspicious_final_zero_blowout",
				source: "syncLiveGameData",
				message,
				eventStatus,
				homeScore,
				awayScore,
			});
		}

		// Tag with ESPN's season. Existing games keep their stored season, so look
		// up teams under it (box score rows reference those team ids).
		const { season: espnSeason, seasonType } = parseEspnSeason("wnba", summaryData.header?.season);
		const season = espnSeason ?? existingGame?.season ?? (await getCurrentSeasonName(ctx));
		const teamSeason = existingGame?.season ?? season;

		// Look up teams first to avoid overwriting standings data
		const homeTeamId = await ensureTeam(ctx, homeComp.team, teamSeason);
		const awayTeamId = await ensureTeam(ctx, awayComp.team, teamSeason);

		const scheduledStart = competition?.date
			? new Date(competition.date).getTime()
			: Date.now();

		const nextEventStatus = suspiciousFinal
			? (existingGame?.eventStatus === "completed" ? "in_progress" : (existingGame?.eventStatus ?? "in_progress"))
			: eventStatus;

		// Upsert game event
		const gameEventId = await ctx.runMutation(internal.wnba.mutations.upsertGameEvent, {
			espnGameId: args.espnGameId,
			season,
			seasonType,
			homeTeamId,
			awayTeamId,
			gameDate: existingGame?.gameDate ?? formatGameDate(scheduledStart),
			scheduledStart,
			eventStatus: nextEventStatus,
			statusDetail: detail,
			venue: competition?.venue?.fullName,
			homeScore: scoresAreComplete ? homeScore : undefined,
			awayScore: scoresAreComplete ? awayScore : undefined,
			homeTeamRecord: getTotalRecord(homeComp),
			awayTeamRecord: getTotalRecord(awayComp),
			lastFetchedAt: Date.now(),
		});

		// No box score exists before tipoff
		if (!isPreGame) {
			await syncBoxScoreData(ctx, gameEventId, args.espnGameId, summaryData);
		}

		// Refresh W-L when a tracked game first goes final
		if (existingGame && existingGame.eventStatus !== "completed" && nextEventStatus === "completed") {
			await scheduleStandingsRefresh(ctx);
		}
	},
});

// Public action: trigger live game sync (called from TanStack server functions)
export const requestGameSync = action({
	args: { espnGameId: v.string() },
	handler: async (ctx, args) => {
		await ctx.runAction(internal.wnba.actions.syncLiveGameData, {
			espnGameId: args.espnGameId,
		});
	},
});

// Public action: patch season player rows using ESPN Core athlete statistics endpoint.
export const backfillPlayerStatsFromCore = action({
	args: {
		season: v.optional(v.string()),
		limit: v.optional(v.number()),
		dryRun: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		return await runCorePlayerStatsBackfill(ctx, args);
	},
});

// Internal variant for crons and admin workflows.
export const backfillPlayerStatsFromCoreInternal = internalAction({
	args: {
		season: v.optional(v.string()),
		limit: v.optional(v.number()),
		dryRun: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		return await runCorePlayerStatsBackfill(ctx, args);
	},
});

// ============================================================================
// BOOTSTRAP / BACKFILL ACTIONS
// Run order: bootstrapTeams → bootstrapPlayers → backfillGames → recalculateAll
// ============================================================================

// Step 1: Bootstrap all WNBA teams from API standings
export const bootstrapTeams = internalAction({
	args: { bootstrapRunId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const season = await getCurrentSeasonName(ctx);

		console.log(`[WNBA Bootstrap] Fetching standings for season ${season}...`);

		const standings = await fetchStandings();
		if (!standings) {
			throw new Error("[WNBA Bootstrap] Standings fetch failed");
		}

		// Keyed by the current season (not the payload's) so the following
		// bootstrap steps, which look teams up by current season, find them.
		let teamCount = 0;

		for (const { team, record } of standings.teams) {
			await ctx.runMutation(internal.wnba.mutations.upsertTeam, {
				...teamInfoArgs(team),
				season,
				...record,
			});

			teamCount++;
		}

		console.log(`[WNBA Bootstrap] Created/updated ${teamCount} teams`);

		if (args.bootstrapRunId) {
			await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
				league: "wnba",
				completedStep: "teams",
			});
		}
	},
});

// Step 2: Bootstrap players from rosters (entry point)
export const bootstrapPlayers = internalAction({
	args: { bootstrapRunId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const season = await getCurrentSeasonName(ctx);

		console.log(`[WNBA Bootstrap] Starting player roster bootstrap for season ${season}...`);

		const teams = await ctx.runQuery(internal.wnba.queries.getAllTeamsInternal, { season });

		if (teams.length === 0) {
			console.error("[WNBA Bootstrap] No teams found. Run bootstrapTeams first.");
			if (args.bootstrapRunId) {
				await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
					league: "wnba",
					completedStep: "players",
				});
			}
			return;
		}

		const teamInfos = teams.map((t: any) => ({ espnTeamId: t.espnTeamId, convexTeamId: t._id }));

		console.log(`[WNBA Bootstrap] Found ${teams.length} teams, scheduling roster fetches...`);

		await ctx.scheduler.runAfter(100, internal.wnba.actions.bootstrapPlayersChunk, {
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
			convexTeamId: v.id("wnbaTeam"),
		})),
		offset: v.number(),
		bootstrapRunId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check for cancellation before processing
		if (args.bootstrapRunId) {
			const cancelled = await ctx.runMutation(internal.bootstrapAdmin.checkCancelled, { league: "wnba" });
			if (cancelled) {
				console.log(`[WNBA Bootstrap] Cancelled during player roster bootstrap`);
				return;
			}
		}

		const season = await getCurrentSeasonName(ctx);
		const commonBase = getCommonApi();
		const coreBase = getCoreApi();
		const coreSeasonYear = getCoreSeasonYear(season);
		const chunk = args.teamInfos.slice(args.offset, args.offset + ROSTER_TEAMS_PER_CHUNK);

		if (chunk.length === 0) {
			console.log(`[WNBA Bootstrap] Player roster bootstrap complete!`);
			if (args.bootstrapRunId) {
				await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
					league: "wnba",
					completedStep: "players",
				});
			}
			return;
		}

		// Update progress
		if (args.bootstrapRunId) {
			await ctx.runMutation(internal.bootstrapAdmin.updateProgress, {
				league: "wnba",
				progress: `Roster ${args.offset + 1}-${Math.min(args.offset + chunk.length, args.teamInfos.length)} of ${args.teamInfos.length} teams`,
			});
		}

		console.log(`[WNBA Bootstrap] Processing rosters for teams ${args.offset + 1}-${args.offset + chunk.length} of ${args.teamInfos.length}...`);

		for (const teamInfo of chunk) {
			try {
				const response = await fetch(`${commonBase}/teams/${teamInfo.espnTeamId}/roster`, {
					headers: { "Content-Type": "application/json" },
				});

				if (!response.ok) {
					console.error(`[WNBA Bootstrap] Roster fetch failed for team ${teamInfo.espnTeamId}: ${response.status}`);
					continue;
				}

				const rosterData = (await response.json()) as ApiRosterResponse;
				const allGroup = rosterData.positionGroups?.find((g) => g.type === "all");
				const athletes = allGroup?.athletes ?? rosterData.positionGroups?.[0]?.athletes ?? [];

				for (const athlete of athletes) {
					const coreStats = await fetchPlayerSeasonStatsFromCore(
						coreBase,
						coreSeasonYear,
						athlete.id,
					);
					await ctx.runMutation(internal.wnba.mutations.upsertPlayer, {
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
						...(coreStats ?? {}),
					});
				}

				console.log(`[WNBA Bootstrap] Team ${teamInfo.espnTeamId}: ${athletes.length} players`);
				await sleep(BACKFILL_GAME_DELAY_MS);
			} catch (error) {
				console.error(`[WNBA Bootstrap] Error fetching roster for team ${teamInfo.espnTeamId}:`, error);
			}
		}

		const nextOffset = args.offset + ROSTER_TEAMS_PER_CHUNK;
		if (nextOffset < args.teamInfos.length) {
			await ctx.scheduler.runAfter(BACKFILL_DELAY_MS, internal.wnba.actions.bootstrapPlayersChunk, {
				teamInfos: args.teamInfos,
				offset: nextOffset,
				bootstrapRunId: args.bootstrapRunId,
			});
		} else {
			console.log(`[WNBA Bootstrap] All player rosters processed!`);
			if (args.bootstrapRunId) {
				await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
					league: "wnba",
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
		const season = await getCurrentSeasonName(ctx);
		const startDate =
			args.startDate ??
			(await getCurrentSeasonEventDate(ctx, "preseasonStart", getSeasonStartDate(season)));
		const endDate =
			args.endDate ??
			(await getCurrentSeasonEventDate(ctx, "playoffEnd", getSeasonEndDate(season)));
		const dates = getDateRange(startDate, endDate);

		console.log(`[WNBA Backfill] Starting game backfill: ${startDate} to ${endDate} (${dates.length} dates)`);

		await ctx.scheduler.runAfter(100, internal.wnba.actions.backfillDateChunk, {
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
		// Only store as-of-game records on games we already have
		recordsOnly: v.optional(v.boolean()),
		bootstrapRunId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check for cancellation before processing
		if (args.bootstrapRunId) {
			const cancelled = await ctx.runMutation(internal.bootstrapAdmin.checkCancelled, { league: "wnba" });
			if (cancelled) {
				console.log(`[WNBA Backfill] Cancelled during game backfill`);
				return;
			}
		}

		if (args.offset >= args.dates.length) {
			console.log(`[WNBA Backfill] All dates processed! Run recalculateAll to compute averages.`);
			if (args.bootstrapRunId) {
				await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
					league: "wnba",
					completedStep: "backfill",
				});
			}
			return;
		}

		// Update progress
		if (args.bootstrapRunId) {
			await ctx.runMutation(internal.bootstrapAdmin.updateProgress, {
				league: "wnba",
				progress: `Date ${args.offset + 1} of ${args.dates.length}`,
			});
		}

		const date = args.dates[args.offset];
		const fallbackSeason = createSeasonFallback(ctx);
		const baseUrl = getSiteApi();

		console.log(`[WNBA Backfill] Processing date ${date} (${args.offset + 1}/${args.dates.length})...`);

		try {
			const scoreboardRes = await fetch(`${baseUrl}/scoreboard?dates=${date}`, {
				headers: { "Content-Type": "application/json" },
			});

			if (!scoreboardRes.ok) {
				console.error(`[WNBA Backfill] Scoreboard fetch failed for ${date}: ${scoreboardRes.status}`);
				await ctx.scheduler.runAfter(BACKFILL_DELAY_MS, internal.wnba.actions.backfillDateChunk, {
					dates: args.dates,
					offset: args.offset + 1,
					recordsOnly: args.recordsOnly,
					bootstrapRunId: args.bootstrapRunId,
				});
				return;
			}

			const scoreboardData = (await scoreboardRes.json()) as ApiScoreboardResponse;
			const events = scoreboardData.events ?? [];

			console.log(`[WNBA Backfill] ${date}: ${events.length} games found`);

			let processedGames = 0;
			const recordUpdates: Array<{
				espnGameId: string;
				homeTeamRecord: string;
				awayTeamRecord: string;
				seasonType?: number;
			}> = [];

			for (const event of events) {
				const competition = event.competitions[0];
				if (!competition) continue;

				const homeComp = competition.competitors.find((c) => c.homeAway === "home");
				const awayComp = competition.competitors.find((c) => c.homeAway === "away");
				if (!homeComp || !awayComp) continue;

				if (args.recordsOnly) {
					const homeTeamRecord = getTotalRecord(homeComp);
					const awayTeamRecord = getTotalRecord(awayComp);
					if (homeTeamRecord && awayTeamRecord) {
						recordUpdates.push({
							espnGameId: event.id,
							homeTeamRecord,
							awayTeamRecord,
							seasonType: event.season?.type,
						});
					}
					continue;
				}

				const { season, seasonType } = await resolveEventSeason(event.season, fallbackSeason);

				// Look up teams first to avoid overwriting standings data
				const homeTeamId = await ensureTeam(ctx, homeComp.team, season);
				const awayTeamId = await ensureTeam(ctx, awayComp.team, season);

				const scheduledStart = competition.startDate
					? new Date(competition.startDate).getTime()
					: Date.now();

				const state = event.status?.type?.state;
				const eventStatus = mapApiStateToEventStatus(state, event.status?.type?.detail);

				const gameEventId = await ctx.runMutation(internal.wnba.mutations.upsertGameEvent, {
					espnGameId: event.id,
					season,
					seasonType,
					homeTeamId,
					awayTeamId,
					gameDate: date,
					scheduledStart,
					eventStatus,
					statusDetail: event.status?.type?.detail,
					venue: competition.venue?.fullName,
					homeScore: parseApiScore(homeComp.score),
					awayScore: parseApiScore(awayComp.score),
					homeTeamRecord: getTotalRecord(homeComp),
					awayTeamRecord: getTotalRecord(awayComp),
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
							console.error(`[WNBA Backfill] Summary fetch failed for game ${event.id}: ${summaryRes.status}`);
						}
					} catch (error) {
						console.error(`[WNBA Backfill] Error processing game ${event.id}:`, error);
					}
				}
			}

			if (recordUpdates.length > 0) {
				await ctx.runMutation(internal.wnba.mutations.setGameRecords, { games: recordUpdates });
			}

			console.log(`[WNBA Backfill] ${date}: processed ${processedGames} completed games`);
		} catch (error) {
			console.error(`[WNBA Backfill] Error processing date ${date}:`, error);
		}

		await ctx.scheduler.runAfter(BACKFILL_DELAY_MS, internal.wnba.actions.backfillDateChunk, {
			dates: args.dates,
			offset: args.offset + 1,
			recordsOnly: args.recordsOnly,
			bootstrapRunId: args.bootstrapRunId,
		});
	},
});

// Daily: store the schedule from yesterday through the season's end so the
// scoreboard can page ahead, and give completed games their as-of-game records.
// Also safe to run by hand.
export const syncSchedule = internalAction({
	args: {},
	handler: async (ctx) => {
		const season = await getCurrentSeasonName(ctx);
		const { startDate, endDate } = getScheduleSyncRange({
			seasonEndDate: await getCurrentSeasonEventDate(ctx, "playoffEnd", getSeasonEndDate(season)),
			calendarSeasonEndDate: getSeasonEndDate(getCurrentSeason()),
		});
		const dates = getDateRange(startDate, endDate);

		console.log(`[WNBA Schedule] Syncing schedule: ${startDate} to ${endDate} (${dates.length} dates)`);

		await ctx.scheduler.runAfter(100, internal.wnba.actions.backfillDateChunk, {
			dates,
			offset: 0,
		});

		const recordDates = (
			await ctx.runQuery(internal.wnba.queries.getDatesMissingRecords, { season })
		).filter((date) => date < startDate);
		if (recordDates.length > 0) {
			console.log(`[WNBA Schedule] Backfilling records for ${recordDates.length} past dates`);
			await ctx.scheduler.runAfter(100, internal.wnba.actions.backfillDateChunk, {
				dates: recordDates,
				offset: 0,
				recordsOnly: true,
			});
		}
	},
});

// Step 4: Recalculate all averages and rankings
export const recalculateAll = internalAction({
	args: { bootstrapRunId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const season = await getCurrentSeasonName(ctx);

		console.log(`[WNBA Recalculate] Starting full recalculation for season ${season}...`);

		const teams = await ctx.runQuery(internal.wnba.queries.getAllTeamsInternal, { season });
		console.log(`[WNBA Recalculate] Recalculating averages for ${teams.length} teams...`);

		for (const team of teams) {
			await ctx.runMutation(internal.wnba.mutations.recalculateTeamAverages, {
				teamId: team._id,
			});
		}

		console.log(`[WNBA Recalculate] Team averages done. Reconciling player season stats from Core...`);
		await runCorePlayerStatsBackfill(ctx, { season, dryRun: false });

		console.log(`[WNBA Recalculate] Updating league rankings...`);
		await ctx.runMutation(internal.wnba.mutations.updateLeagueRankings, { season });

		console.log(`[WNBA Recalculate] Full recalculation complete!`);

		if (args.bootstrapRunId) {
			await ctx.runAction(internal.bootstrapAdmin.onStepComplete, {
				league: "wnba",
				completedStep: "recalculate",
			});
		}
	},
});

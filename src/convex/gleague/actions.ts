import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getSeasonDate, requireCurrentSeason } from "../shared/currentSeason";
import type { Id } from "../_generated/dataModel";
import {
	getCompetitionYear,
	getTodayDate,
	formatGameDate,
	mapApiStateToEventStatus,
	sleep,
	getDateRange,
	getScheduleSyncRange,
	parseEspnSeason,
	seasonFromEspnYear,
} from "../shared/seasonHelpers";
import {
	parseTeamBoxScore,
	parsePlayerBoxScores,
	getTotalRecord,
	parseRosterPlayer,
	getRecordsFromTeamSchedule,
} from "../shared/apiParser";
import type {
	ApiScoreboardResponse,
	ApiGameSummaryResponse,
	ApiStandingsResponse,
	ApiStandingsTeamEntry,
	ApiRosterResponse,
	ApiSiteRosterResponse,
	ApiTeamScheduleResponse,
} from "../shared/apiParser";

// Bootstrap constants
const BACKFILL_DELAY_MS = 2000;
const BACKFILL_GAME_DELAY_MS = 3000;
const RECORD_BATCH_SIZE = 200;
const ROSTER_TEAMS_PER_CHUNK = 5;
// Give ESPN a minute to roll a final into the standings before refreshing
const STANDINGS_REFRESH_DELAY_MS = 60_000;

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

function getCoreApi(): string {
	const url = process.env.GLEAGUE_CORE_API;
	if (!url) throw new Error("GLEAGUE_CORE_API not configured");
	return url;
}

function getCoreSeasonYear(season: string): number {
	const startYear = Number.parseInt(season.split("-")[0] ?? "", 10);
	if (Number.isFinite(startYear)) return startYear + 1;
	return new Date().getUTCFullYear();
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
	const allPlayers = await ctx.runQuery(internal.gleague.queries.getAllPlayersInternal, {
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
				await ctx.runMutation(internal.gleague.mutations.patchPlayerSeasonStats, {
					playerId: player._id,
					...patch,
				});
			}

			patched += 1;
		} catch (error) {
			errors += 1;
			console.error(
				`[GLEAGUE] Core stat backfill failed for player ${player.espnPlayerId}:`,
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

async function getCurrentSeasonName(ctx: any): Promise<string> {
	return await requireCurrentSeason(ctx, "gleague");
}

async function getCurrentSeasonEventDate(
	ctx: any,
	eventType: "seasonStart" | "seasonEnd" | "latestScheduledEnd",
): Promise<string | null> {
	return await getSeasonDate(ctx, "gleague", eventType);
}

// Lazily resolve the configured current season, only when ESPN omits one
function createSeasonFallback(ctx: any): () => Promise<string> {
	let cached: Promise<string> | undefined;
	return () => (cached ??= getCurrentSeasonName(ctx));
}

type ApiTeamRef = {
	id: string;
	name?: string;
	displayName?: string;
	abbreviation?: string;
	location?: string;
	slug?: string;
};

function teamIdentityArgs(team: ApiTeamRef, season: string) {
	return {
		espnTeamId: team.id,
		season,
		name: team.displayName ?? team.name ?? "Unknown",
		abbreviation: team.abbreviation ?? "???",
		location: team.location ?? "",
		slug: team.slug ?? team.id,
	};
}

// Look up a team for a season, creating it (without record fields) if missing
async function ensureTeam(ctx: any, team: ApiTeamRef, season: string): Promise<Id<"gleagueTeam">> {
	const existing = await ctx.runQuery(internal.gleague.queries.getTeamInternal, {
		espnTeamId: team.id,
		season,
	});
	if (existing) return existing._id;
	return await ctx.runMutation(internal.gleague.mutations.upsertTeam, teamIdentityArgs(team, season));
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
	// Season the rows belong to, from the payload (not the seasons table).
	// In the offseason ESPN still serves last season's standings.
	season?: string;
	entries: Array<{ team: ApiStandingsTeamEntry["team"]; record: StandingsRecord }>;
	byTeamId: Map<string, StandingsRecord>;
};

function parseStandings(data: ApiStandingsResponse): StandingsSnapshot {
	const conferences = data.children ?? [];
	// Each conference's `standings.season` describes the rows; the top-level
	// season is ESPN's current season and can be newer than the data.
	const espnYear = conferences.find((c) => typeof c.standings?.season === "number")?.standings?.season
		?? data.season?.year;
	const season = typeof espnYear === "number" ? seasonFromEspnYear("gleague", espnYear) : undefined;

	const entries: StandingsSnapshot["entries"] = [];
	const byTeamId = new Map<string, StandingsRecord>();

	for (const conf of conferences) {
		const confName = conf.name ?? "";
		for (const entry of conf.standings?.entries ?? []) {
			const getStat = (name: string) => entry.stats.find((s) => s.name === name)?.value ?? 0;
			const getDisplay = (name: string) => entry.stats.find((s) => s.name === name)?.displayValue ?? "";

			const record: StandingsRecord = {
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
			};
			entries.push({ team: entry.team, record });
			byTeamId.set(entry.team.id, record);
		}
	}

	return { season, entries, byTeamId };
}

// Fetch and parse standings; returns null on failure so callers keep existing records
async function fetchStandings(): Promise<StandingsSnapshot | null> {
	const standingsUrl = getSiteApi().replace("/site/v2/", "/v2/") + "/standings";
	try {
		const standingsRes = await fetch(standingsUrl, {
			headers: { "User-Agent": "Mozilla/5.0" },
		});
		if (!standingsRes.ok) {
			console.error(`[GLEAGUE] Standings fetch failed: ${standingsRes.status}`);
			return null;
		}
		return parseStandings((await standingsRes.json()) as ApiStandingsResponse);
	} catch (error) {
		console.error("[GLEAGUE] Standings fetch failed:", error);
		return null;
	}
}

// Standings record for a team, only if the standings belong to the given season
function getStandingsRecord(
	standings: StandingsSnapshot | null,
	espnTeamId: string,
	season: string,
): StandingsRecord | undefined {
	if (!standings || standings.season !== season) return undefined;
	return standings.byTeamId.get(espnTeamId);
}

async function scheduleStandingsRefresh(ctx: any) {
	await ctx.scheduler.runAfter(STANDINGS_REFRESH_DELAY_MS, internal.gleague.actions.refreshStandings, {});
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
			league: "gleague",
			...input,
		});
	} catch (error) {
		console.error("[GLEAGUE] Failed to persist score anomaly:", error);
	}
}

// Daily cron: discover today's games, update standings
export const discoverTodaysGames = internalAction({
	args: {},
	handler: async (ctx) => {
		const getFallbackSeason = createSeasonFallback(ctx);
		const date = getTodayDate();
		const baseUrl = getSiteApi();

		console.log(`[GLEAGUE] Discovering games for ${date}...`);

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
		const standings = await fetchStandings();

		// Process each game
		for (const event of events) {
			const competition = event.competitions[0];
			if (!competition) continue;

			const homeComp = competition.competitors.find((c) => c.homeAway === "home");
			const awayComp = competition.competitors.find((c) => c.homeAway === "away");
			if (!homeComp || !awayComp) continue;

			// Tag the game with ESPN's season; fall back to the configured season
			const espnSeason = parseEspnSeason("gleague", event.season);
			const season = espnSeason.season ?? (await getFallbackSeason());

			// Ensure team records exist; records only apply when standings match this season
			const homeTeamId = await ctx.runMutation(internal.gleague.mutations.upsertTeam, {
				...teamIdentityArgs(homeComp.team, season),
				...getStandingsRecord(standings, homeComp.team.id, season),
			});

			const awayTeamId = await ctx.runMutation(internal.gleague.mutations.upsertTeam, {
				...teamIdentityArgs(awayComp.team, season),
				...getStandingsRecord(standings, awayComp.team.id, season),
			});

			const scheduledStart = competition.startDate
				? new Date(competition.startDate).getTime()
				: Date.now();

			const state = event.status?.type?.state;
			const eventStatus = mapApiStateToEventStatus(state, event.status?.type?.detail);

			const gameEventId = await ctx.runMutation(internal.gleague.mutations.upsertGameEvent, {
				espnGameId: event.id,
				season,
				seasonType: espnSeason.seasonType,
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
					internal.gleague.actions.checkGameStatus,
					{ gameEventId },
				);
				console.log(`[GLEAGUE] Scheduled check for game ${event.id} at ${new Date(checkTime).toISOString()}`);
			}
		}

		console.log(`[GLEAGUE] Discovery complete: ${events.length} games processed`);
	},
});

// Refresh W-L records for every team in the standings (cron + after games finish).
// Rows are keyed by the payload's season so offseason standings never land on
// the next season's teams.
export const refreshStandings = internalAction({
	args: {},
	handler: async (ctx): Promise<{ season?: string; teamCount: number }> => {
		const standings = await fetchStandings();
		if (!standings) return { teamCount: 0 };

		if (!standings.season) {
			console.error("[GLEAGUE] Standings payload has no season; skipping refresh");
			return { teamCount: 0 };
		}

		for (const { team, record } of standings.entries) {
			await ctx.runMutation(internal.gleague.mutations.upsertTeam, {
				...teamIdentityArgs(team, standings.season),
				...record,
			});
		}

		console.log(`[GLEAGUE] Refreshed standings for ${standings.entries.length} teams, season ${standings.season}`);
		return { season: standings.season, teamCount: standings.entries.length };
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
		// Record ESPN's season type when available (season/team ids are never changed here)
		const { seasonType } = parseEspnSeason("gleague", summaryData.header?.season);

		// Get scores
		const homeComp = competition?.competitors?.find((c) => c.homeAway === "home");
		const awayComp = competition?.competitors?.find((c) => c.homeAway === "away");
		const homeScore = parseApiScore(homeComp?.score);
		const awayScore = parseApiScore(awayComp?.score);

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
				seasonType,
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
			if (homeScore === undefined || awayScore === undefined) {
				const message = `[GLEAGUE][SCORE_ANOMALY] In-progress game ${args.espnGameId} missing score(s): home=${homeComp?.score ?? "undefined"}, away=${awayComp?.score ?? "undefined"}`;
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
				await ctx.runMutation(internal.gleague.mutations.updateGameEventStatus, {
					gameEventId: args.gameEventId,
					seasonType,
					eventStatus,
					statusDetail: detail,
					checkCount: currentCheckCount + 1,
					lastFetchedAt: Date.now(),
				});
				if (currentCheckCount + 1 < 24) {
					await ctx.scheduler.runAfter(2 * 60 * 1000, internal.gleague.actions.checkGameStatusV2, args);
				}
				return;
			}

			console.log(`[GLEAGUE] Game ${args.espnGameId} in progress: ${awayScore}-${homeScore}`);

			await ctx.runMutation(internal.gleague.mutations.updateGameEventStatus, {
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
				await ctx.scheduler.runAfter(15 * 60 * 1000, internal.gleague.actions.checkGameStatusV2, args);
			}
			return;
		}

		if (state === "post") {
			// Game completed: final update
			if (homeScore === undefined || awayScore === undefined) {
				const message = `[GLEAGUE][SCORE_ANOMALY] Final state for game ${args.espnGameId} has incomplete score: home=${homeComp?.score ?? "undefined"}, away=${awayComp?.score ?? "undefined"}`;
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
				await ctx.runMutation(internal.gleague.mutations.updateGameEventStatus, {
					gameEventId: args.gameEventId,
					seasonType,
					eventStatus: currentGame?.eventStatus === "completed" ? "in_progress" : (currentGame?.eventStatus ?? "in_progress"),
					statusDetail: detail,
					checkCount: currentCheckCount + 1,
					lastFetchedAt: Date.now(),
				});
				if (currentCheckCount + 1 < 24) {
					await ctx.scheduler.runAfter(2 * 60 * 1000, internal.gleague.actions.checkGameStatusV2, args);
				}
				return;
			}

			if (isSuspiciousBlowoutWithZero(homeScore, awayScore)) {
				const message = `[GLEAGUE][SCORE_ANOMALY] Suspicious final score for game ${args.espnGameId}: ${awayScore}-${homeScore}. Delaying completion and retrying.`;
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
				await ctx.runMutation(internal.gleague.mutations.updateGameEventStatus, {
					gameEventId: args.gameEventId,
					seasonType,
					eventStatus: currentGame?.eventStatus === "completed" ? "in_progress" : (currentGame?.eventStatus ?? "in_progress"),
					statusDetail: detail,
					checkCount: currentCheckCount + 1,
					lastFetchedAt: Date.now(),
				});
				if (currentCheckCount + 1 < 24) {
					await ctx.scheduler.runAfter(2 * 60 * 1000, internal.gleague.actions.checkGameStatusV2, args);
				}
				return;
			}

			console.log(`[GLEAGUE] Game ${args.espnGameId} completed: ${awayScore}-${homeScore}`);

			await ctx.runMutation(internal.gleague.mutations.updateGameEventStatus, {
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

			// First transition to completed: refresh W-L once ESPN has rolled the final in
			if (currentGame?.eventStatus !== "completed") {
				await scheduleStandingsRefresh(ctx);
			}

			// Final box score sync
			await syncBoxScoreData(ctx, args.gameEventId, args.espnGameId, summaryData);

			// Recalculate averages for both teams
			const game = await ctx.runQuery(internal.gleague.queries.getGameEventInternal, {
				espnGameId: args.espnGameId,
			});

			if (game) {
				await recalculateTeamsAndRankings(ctx, [game.homeTeamId, game.awayTeamId], game.season);
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

// Recompute season averages for the given teams, then the season's league rankings
async function recalculateTeamsAndRankings(ctx: any, teamIds: Id<"gleagueTeam">[], season: string) {
	for (const teamId of new Set(teamIds)) {
		await ctx.runMutation(internal.gleague.mutations.recalculateTeamAverages, { teamId });
	}
	await ctx.runMutation(internal.gleague.mutations.updateLeagueRankings, { season });
}

// Helper: sync box score data from API summary response into Convex.
// Returns whether either team's box score was new or changed.
async function syncBoxScoreData(
	ctx: any,
	gameEventId: string,
	espnGameId: string,
	summaryData: ApiGameSummaryResponse,
): Promise<boolean> {
	const boxscoreTeams = summaryData.boxscore?.teams;
	const boxscorePlayers = summaryData.boxscore?.players;

	if (!boxscoreTeams || boxscoreTeams.length < 2) return false;

	const competition = summaryData.header?.competitions?.[0];
	// Pre-game summaries have no score yet; nothing to sync and nothing anomalous
	if (competition?.status?.type?.state === "pre") return false;

	const headerHome = competition?.competitors?.find((c) => c.homeAway === "home");
	const headerAway = competition?.competitors?.find((c) => c.homeAway === "away");

	if (!headerHome || !headerAway) return false;

	// Get team IDs from game event
	const game = await ctx.runQuery(internal.gleague.queries.getGameEventInternal, {
		espnGameId,
	});
	if (!game) return false;

	const season = game.season;

	// Parse home team box score
	const homeBoxTeam = boxscoreTeams.find((t) => t.team.id === headerHome.team.id);
	const awayBoxTeam = boxscoreTeams.find((t) => t.team.id === headerAway.team.id);

	const homeStats = parseTeamBoxScore(homeBoxTeam?.statistics);
	const awayStats = parseTeamBoxScore(awayBoxTeam?.statistics);

	const homeScore = parseApiScore(headerHome.score);
	const awayScore = parseApiScore(headerAway.score);
	if (homeScore === undefined || awayScore === undefined) {
		const message = `[GLEAGUE][SCORE_ANOMALY] Box score sync skipped for ${espnGameId}; missing header score(s): home=${headerHome.score ?? "undefined"}, away=${headerAway.score ?? "undefined"}`;
		console.error(message);
		await logScoreAnomaly(ctx, {
			espnGameId,
			anomalyType: "missing_boxscore_header_score",
			source: "syncBoxScoreData",
			message,
			rawHomeScore: headerHome.score,
			rawAwayScore: headerAway.score,
		});
		return false;
	}

	// Upsert team events
	let boxScoreChanged = false;
	if (homeBoxTeam) {
		const { changed } = await ctx.runMutation(internal.gleague.mutations.upsertTeamEvent, {
			gameEventId: game._id,
			teamId: game.homeTeamId,
			isHome: true,
			score: homeScore,
			oppScore: awayScore,
			winner: homeScore > awayScore,
			...homeStats,
		});
		boxScoreChanged ||= changed;
	}

	if (awayBoxTeam) {
		const { changed } = await ctx.runMutation(internal.gleague.mutations.upsertTeamEvent, {
			gameEventId: game._id,
			teamId: game.awayTeamId,
			isHome: false,
			score: awayScore,
			oppScore: homeScore,
			winner: awayScore > homeScore,
			...awayStats,
		});
		boxScoreChanged ||= changed;
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
			const playerId = await ctx.runMutation(internal.gleague.mutations.upsertPlayerFromBoxScore, {
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

	return boxScoreChanged;
}

// Sync a live game from API provider (triggered by page load server function)
export const syncLiveGameData = internalAction({
	args: {
		espnGameId: v.string(),
	},
	handler: async (ctx, args) => {
		const baseUrl = getSiteApi();

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
		const isPreGame = state === "pre";

		const homeComp = competition?.competitors?.find((c) => c.homeAway === "home");
		const awayComp = competition?.competitors?.find((c) => c.homeAway === "away");
		if (!homeComp || !awayComp) return;

		// Tag with ESPN's season; existing games keep their stored season and team ids
		const espnSeason = parseEspnSeason("gleague", summaryData.header?.season);
		const season = espnSeason.season ?? (await getCurrentSeasonName(ctx));
		const teamSeason = existingGame?.season ?? season;

		const homeScore = parseApiScore(homeComp.score);
		const awayScore = parseApiScore(awayComp.score);
		const scoresAreComplete = homeScore !== undefined && awayScore !== undefined;
		const suspiciousFinal = eventStatus === "completed" && isSuspiciousBlowoutWithZero(homeScore, awayScore);
		// ESPN has no score before tipoff; that's expected, not an anomaly
		if (!scoresAreComplete && !isPreGame) {
			const message = `[GLEAGUE][SCORE_ANOMALY] Live sync missing score(s) for ${args.espnGameId}: home=${homeComp.score ?? "undefined"}, away=${awayComp.score ?? "undefined"}, state=${state ?? "unknown"}`;
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
			const message = `[GLEAGUE][SCORE_ANOMALY] Live sync suspicious final for ${args.espnGameId}: ${awayScore}-${homeScore}. Keeping prior status until next sync.`;
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

		// Look up teams first to avoid overwriting standings data
		const homeTeamId = await ensureTeam(ctx, homeComp.team, teamSeason);
		const awayTeamId = await ensureTeam(ctx, awayComp.team, teamSeason);

		const scheduledStart = competition?.date
			? new Date(competition.date).getTime()
			: Date.now();

		// Upsert game event (pre-game still updates status, start time, venue)
		const gameEventId = await ctx.runMutation(internal.gleague.mutations.upsertGameEvent, {
			espnGameId: args.espnGameId,
			season,
			seasonType: espnSeason.seasonType,
			homeTeamId,
			awayTeamId,
			gameDate: existingGame?.gameDate ?? formatGameDate(scheduledStart),
			scheduledStart,
			eventStatus: suspiciousFinal
				? (existingGame?.eventStatus === "completed" ? "in_progress" : (existingGame?.eventStatus ?? "in_progress"))
				: eventStatus,
			statusDetail: detail,
			venue: competition?.venue?.fullName,
			homeScore: scoresAreComplete ? homeScore : undefined,
			awayScore: scoresAreComplete ? awayScore : undefined,
			homeTeamRecord: getTotalRecord(homeComp),
			awayTeamRecord: getTotalRecord(awayComp),
			lastFetchedAt: Date.now(),
		});

		if (isPreGame) return;

		// Sync box score data
		const boxScoreChanged = await syncBoxScoreData(ctx, gameEventId, args.espnGameId, summaryData);

		// First transition to completed: refresh W-L once ESPN has rolled the final in
		const isCompleted = eventStatus === "completed" && scoresAreComplete && !suspiciousFinal;
		const isNewlyCompleted = isCompleted && existingGame?.eventStatus !== "completed";
		if (isNewlyCompleted) {
			await scheduleStandingsRefresh(ctx);
		}

		// Season averages count finished games only: recompute when a game
		// goes final or ESPN revises a finished game's box score
		if (isCompleted && (boxScoreChanged || isNewlyCompleted)) {
			await recalculateTeamsAndRankings(ctx, [homeTeamId, awayTeamId], teamSeason);
		}
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

// Fetch a team's roster from the site API (the common API roster has no birthdates)
async function fetchSiteRoster(espnTeamId: string): Promise<ApiSiteRosterResponse | null> {
	const response = await fetch(`${getSiteApi()}/teams/${espnTeamId}/roster`, {
		headers: { "Content-Type": "application/json" },
	});
	if (!response.ok) {
		console.error(`[GLEAGUE Rosters] Roster fetch failed for team ${espnTeamId}: ${response.status}`);
		return null;
	}
	return (await response.json()) as ApiSiteRosterResponse;
}

// Refresh every team's roster from ESPN: bios (birthdates included), trades and
// signings, and players who've left. Only while the current season runs, so a
// finished season keeps its final rosters.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runRosterSync(ctx: any) {
	const season = await getCurrentSeasonName(ctx);
	const seasonEnd = await getSeasonDate(ctx, "gleague", "seasonEnd");
	if (seasonEnd !== null && getTodayDate() > seasonEnd) {
		console.log(`[GLEAGUE Rosters] Season ${season} ended ${seasonEnd}; keeping its final rosters`);
		return { season, skipped: true, teams: 0, players: 0, flagged: 0 };
	}

	const teams = await ctx.runQuery(internal.gleague.queries.getAllTeamsInternal, { season });
	let syncedTeams = 0;
	let players = 0;
	let flagged = 0;

	for (const team of teams) {
		// Placeholder teams (TBD) have no roster
		if (!/^\d+$/.test(team.espnTeamId)) continue;
		try {
			const roster = await fetchSiteRoster(team.espnTeamId);
			const athletes = roster?.athletes ?? [];
			const rosterYear = roster?.season?.year;
			// Never empty a roster from a failed response or another season's roster
			if (
				athletes.length === 0 ||
				rosterYear === undefined ||
				seasonFromEspnYear("gleague", rosterYear) !== season
			) {
				continue;
			}

			for (const athlete of athletes) {
				await ctx.runMutation(internal.gleague.mutations.upsertPlayer, {
					...parseRosterPlayer(athlete),
					season,
					teamId: team._id,
					onRoster: true,
				});
			}
			flagged += await ctx.runMutation(internal.gleague.mutations.markOffRoster, {
				teamId: team._id,
				rosterEspnPlayerIds: athletes.map((athlete) => athlete.id),
			});
			syncedTeams += 1;
			players += athletes.length;
		} catch (error) {
			console.error(`[GLEAGUE Rosters] Roster sync failed for team ${team.espnTeamId}:`, error);
		}
	}

	console.log(
		`[GLEAGUE Rosters] Synced ${syncedTeams}/${teams.length} teams (${players} players), ${flagged} newly off-roster`,
	);
	return { season, skipped: false, teams: syncedTeams, players, flagged };
}

// Refresh rosters on their own (the daily player refresh runs this first)
export const syncRosters = internalAction({
	args: {},
	handler: async (ctx) => {
		return await runRosterSync(ctx);
	},
});

// Daily: refresh rosters, then season stats from ESPN Core, so a newly signed
// player has their stats the same day
export const refreshPlayers = internalAction({
	args: {},
	handler: async (ctx) => {
		const rosters = await runRosterSync(ctx);
		const stats = await runCorePlayerStatsBackfill(ctx, {});
		return { rosters, stats };
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
		const season = await getCurrentSeasonName(ctx);

		console.log(`[GLEAGUE Bootstrap] Fetching standings for season ${season}...`);

		const standings = await fetchStandings();
		if (!standings) {
			throw new Error("[GLEAGUE Bootstrap] Standings fetch failed");
		}

		// Teams are created for the configured season; record fields are only
		// written when the standings payload is for that same season.
		const recordsMatchSeason = standings.season === season;
		let teamCount = 0;

		for (const { team, record } of standings.entries) {
			await ctx.runMutation(internal.gleague.mutations.upsertTeam, {
				...teamIdentityArgs(team, season),
				...(recordsMatchSeason ? record : { conference: record.conference }),
			});

			teamCount++;
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
		const season = await getCurrentSeasonName(ctx);

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

		const teamInfos = teams.map((t: any) => ({ espnTeamId: t.espnTeamId, convexTeamId: t._id }));

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

		const season = await getCurrentSeasonName(ctx);
		const commonBase = getCommonApi();
		const coreBase = getCoreApi();
		const coreSeasonYear = getCoreSeasonYear(season);
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
					const coreStats = await fetchPlayerSeasonStatsFromCore(
						coreBase,
						coreSeasonYear,
						athlete.id,
					);
					await ctx.runMutation(internal.gleague.mutations.upsertPlayer, {
						...parseRosterPlayer(athlete),
						season,
						teamId: teamInfo.convexTeamId,
						...(coreStats ?? {}),
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
		const season = await getCurrentSeasonName(ctx);
		const startDate = args.startDate ?? (await getCurrentSeasonEventDate(ctx, "seasonStart"));
		const endDate = args.endDate ?? (await getCurrentSeasonEventDate(ctx, "seasonEnd"));
		if (!startDate || !endDate) {
			throw new Error(`[GLEAGUE Backfill] Season ${season} has no dates in the seasons table; pass startDate and endDate`);
		}
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
		const getFallbackSeason = createSeasonFallback(ctx);
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
					bootstrapRunId: args.bootstrapRunId,
				});
				return;
			}

			const scoreboardData = (await scoreboardRes.json()) as ApiScoreboardResponse;
			const events = scoreboardData.events ?? [];

			console.log(`[GLEAGUE Backfill] ${date}: ${events.length} games found`);

			let processedGames = 0;
			// Teams whose finished games changed, by season, to recompute after the date
			const changedTeams = new Map<string, Id<"gleagueTeam">[]>();

			for (const event of events) {
				const competition = event.competitions[0];
				if (!competition) continue;

				const homeComp = competition.competitors.find((c) => c.homeAway === "home");
				const awayComp = competition.competitors.find((c) => c.homeAway === "away");
				if (!homeComp || !awayComp) continue;

				// Tag the game with ESPN's season; fall back to the configured season
				const espnSeason = parseEspnSeason("gleague", event.season);
				const season = espnSeason.season ?? (await getFallbackSeason());

				// Look up teams first to avoid overwriting standings data
				const homeTeamId = await ensureTeam(ctx, homeComp.team, season);
				const awayTeamId = await ensureTeam(ctx, awayComp.team, season);

				const scheduledStart = competition.startDate
					? new Date(competition.startDate).getTime()
					: Date.now();

				const state = event.status?.type?.state;
				const eventStatus = mapApiStateToEventStatus(state, event.status?.type?.detail);

				const gameEventId = await ctx.runMutation(internal.gleague.mutations.upsertGameEvent, {
					espnGameId: event.id,
					season,
					seasonType: espnSeason.seasonType,
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
							const boxScoreChanged = await syncBoxScoreData(ctx, gameEventId, event.id, summaryData);
							processedGames++;
							// Bootstrap recalculates everything once the backfill is done
							if (boxScoreChanged && !args.bootstrapRunId) {
								changedTeams.set(season, [...(changedTeams.get(season) ?? []), homeTeamId, awayTeamId]);
							}
						} else {
							console.error(`[GLEAGUE Backfill] Summary fetch failed for game ${event.id}: ${summaryRes.status}`);
						}
					} catch (error) {
						console.error(`[GLEAGUE Backfill] Error processing game ${event.id}:`, error);
					}
				}
			}

			for (const [season, teamIds] of changedTeams) {
				await recalculateTeamsAndRankings(ctx, teamIds, season);
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

// Daily: store the schedule from three days back through the season's end so
// the scoreboard can page ahead, give completed games their as-of-game records,
// and pick up ESPN's box score corrections.
// Also safe to run by hand.
export const syncSchedule = internalAction({
	args: {},
	handler: async (ctx) => {
		const season = await getCurrentSeasonName(ctx);
		const { startDate, endDate } = getScheduleSyncRange({
			seasonEndDate: await getCurrentSeasonEventDate(ctx, "seasonEnd"),
			latestScheduledEndDate: await getCurrentSeasonEventDate(ctx, "latestScheduledEnd"),
		});
		const dates = getDateRange(startDate, endDate);

		console.log(`[GLEAGUE Schedule] Syncing schedule: ${startDate} to ${endDate} (${dates.length} dates)`);

		await ctx.scheduler.runAfter(100, internal.gleague.actions.backfillDateChunk, {
			dates,
			offset: 0,
		});

		// ESPN's G-League records aren't as of the game; count them from team schedules
		await ctx.scheduler.runAfter(100, internal.gleague.actions.syncRecordsFromSchedules, { season });
	},
});

// ESPN's G-League scoreboards and summaries report each team's final record on
// every date rather than its record as of the game. Count each team's results
// from its ESPN schedule instead and store them on every game of the season.
export const syncRecordsFromSchedules = internalAction({
	args: { season: v.string() },
	handler: async (ctx, args) => {
		const baseUrl = getSiteApi();
		const espnYear = getCompetitionYear("gleague", args.season);
		const teams = await ctx.runQuery(internal.gleague.queries.getAllTeamsInternal, {
			season: args.season,
		});

		const byGame = new Map<
			string,
			{ homeTeamRecord?: string; awayTeamRecord?: string; seasonType?: number }
		>();
		for (const team of teams) {
			try {
				const res = await fetch(`${baseUrl}/teams/${team.espnTeamId}/schedule?season=${espnYear}`, {
					headers: { "Content-Type": "application/json" },
				});
				if (!res.ok) {
					console.error(`[GLEAGUE Records] Schedule fetch failed for team ${team.espnTeamId}: ${res.status}`);
					continue;
				}
				const schedule = (await res.json()) as ApiTeamScheduleResponse;
				for (const entry of getRecordsFromTeamSchedule(team.espnTeamId, schedule.events ?? [])) {
					const game = byGame.get(entry.espnGameId) ?? {};
					game[entry.homeAway === "home" ? "homeTeamRecord" : "awayTeamRecord"] = entry.record;
					game.seasonType = entry.seasonType;
					byGame.set(entry.espnGameId, game);
				}
			} catch (error) {
				console.error(`[GLEAGUE Records] Schedule fetch error for team ${team.espnTeamId}:`, error);
			}
			await sleep(BACKFILL_DELAY_MS);
		}

		const games = [...byGame].flatMap(([espnGameId, { homeTeamRecord, awayTeamRecord, seasonType }]) =>
			homeTeamRecord && awayTeamRecord
				? [{ espnGameId, homeTeamRecord, awayTeamRecord, seasonType }]
				: [],
		);
		let patched = 0;
		for (let i = 0; i < games.length; i += RECORD_BATCH_SIZE) {
			patched += await ctx.runMutation(internal.gleague.mutations.setGameRecords, {
				games: games.slice(i, i + RECORD_BATCH_SIZE),
			});
		}
		console.log(`[GLEAGUE Records] ${args.season}: ${games.length} games counted from ${teams.length} team schedules, ${patched} updated`);
	},
});


// Step 4: Recalculate all averages and rankings
export const recalculateAll = internalAction({
	args: { bootstrapRunId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const season = await getCurrentSeasonName(ctx);

		console.log(`[GLEAGUE Recalculate] Starting full recalculation for season ${season}...`);

		const teams = await ctx.runQuery(internal.gleague.queries.getAllTeamsInternal, { season });
		console.log(`[GLEAGUE Recalculate] Recalculating averages for ${teams.length} teams...`);

		for (const team of teams) {
			await ctx.runMutation(internal.gleague.mutations.recalculateTeamAverages, {
				teamId: team._id,
			});
		}

		console.log(`[GLEAGUE Recalculate] Team averages done. Reconciling player season stats from Core...`);
		await runCorePlayerStatsBackfill(ctx, { season, dryRun: false });

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

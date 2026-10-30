import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { getCurrentSeason, getTodayDate, formatGameDate, mapApiStateToEventStatus, sleep, getDateRange, getScheduleSyncRange, parseEspnSeason, seasonFromEspnYear } from "../shared/seasonHelpers";
import { parseTeamBoxScore, parsePlayerBoxScores, getTotalRecord } from "../shared/apiParser";
import type { Id } from "../_generated/dataModel";
import type {
	ApiScoreboardResponse,
	ApiGameSummaryResponse,
	ApiStandingsResponse,
	ApiStandingsTeamEntry,
	ApiRosterResponse,
	ApiEventSeason,
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

function getCoreApi(): string {
	const url = process.env.NBA_CORE_API;
	if (!url) throw new Error("NBA_CORE_API not configured");
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
	const allPlayers = await ctx.runQuery(internal.nba.queries.getAllPlayersInternal, {
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
				await ctx.runMutation(internal.nba.mutations.patchPlayerSeasonStats, {
					playerId: player._id,
					...patch,
				});
			}

			patched += 1;
		} catch (error) {
			errors += 1;
			console.error(
				`[NBA] Core stat backfill failed for player ${player.espnPlayerId}:`,
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

function compactIsoDate(date: string): string {
	return date.replaceAll("-", "");
}

async function getCurrentSeasonName(ctx: any): Promise<string> {
	return (
		(await ctx.runQuery(api.seasons.getCurrentName, { league: "nba" })) ??
		getCurrentSeason()
	);
}

async function getCurrentSeasonEventDate(
	ctx: any,
	eventType: "preseasonStart" | "playoffEnd",
	fallback: string,
): Promise<string> {
	const date = await ctx.runQuery(api.seasons.getCurrentEventDate, {
		league: "nba",
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

function isWriteConflictError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	return error.message.includes("Documents read from or written");
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
			league: "nba",
			...input,
		});
	} catch (error) {
		console.error("[NBA] Failed to persist score anomaly:", error);
	}
}

// Delay before refreshing standings after a game goes final, so ESPN has
// time to publish the updated records.
const STANDINGS_REFRESH_DELAY_MS = 60_000;

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

type StandingsTeam = {
	team: ApiStandingsTeamEntry["team"];
	record: StandingsRecord;
};

type ParsedStandings = {
	// Undefined when ESPN omits season metadata
	season?: string;
	teams: StandingsTeam[];
};

type TeamIdentity = {
	id: string;
	name?: string;
	displayName?: string;
	abbreviation?: string;
	location?: string;
	slug?: string;
};

function parseStandings(data: ApiStandingsResponse): ParsedStandings {
	const conferences = data.children ?? [];
	// Each conference's `standings.season` describes the rows; the top-level
	// season is ESPN's current season and can be newer than the data (offseason).
	const espnYear =
		conferences.find((conf) => typeof conf.standings?.season === "number")?.standings?.season ??
		data.season?.year;

	const teams: StandingsTeam[] = [];
	for (const conf of conferences) {
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

	return {
		season: typeof espnYear === "number" ? seasonFromEspnYear("nba", espnYear) : undefined,
		teams,
	};
}

// `seasonYear` (ESPN's end year, e.g. 2026 for 2025-26) fetches a past season's final standings
async function fetchStandings(baseUrl: string, seasonYear?: number): Promise<ParsedStandings | null> {
	const standingsUrl =
		baseUrl.replace("/site/v2/", "/v2/") + "/standings" + (seasonYear ? `?season=${seasonYear}` : "");
	const standingsRes = await fetch(standingsUrl, {
		headers: { "User-Agent": "Mozilla/5.0" },
	});
	if (!standingsRes.ok) {
		console.error(`[NBA] Standings fetch failed: ${standingsRes.status}`);
		return null;
	}
	return parseStandings((await standingsRes.json()) as ApiStandingsResponse);
}

function teamIdentityArgs(team: TeamIdentity) {
	return {
		espnTeamId: team.id,
		name: team.displayName ?? team.name ?? "Unknown",
		abbreviation: team.abbreviation ?? "???",
		location: team.location ?? "",
		slug: team.slug ?? team.id,
	};
}

// Upsert every team in a standings payload with its current record
async function upsertStandingsTeams(ctx: any, standings: ParsedStandings, season: string): Promise<number> {
	for (const { team, record } of standings.teams) {
		await ctx.runMutation(internal.nba.mutations.upsertTeam, {
			...teamIdentityArgs(team),
			season,
			...record,
		});
	}
	return standings.teams.length;
}

// Return the team row for a season, creating it (without a record) if missing.
// Existing rows are left alone so standings data isn't overwritten.
async function ensureTeam(ctx: any, team: TeamIdentity, season: string): Promise<Id<"nbaTeam">> {
	const existing = await ctx.runQuery(internal.nba.queries.getTeamInternal, {
		espnTeamId: team.id, season,
	});
	if (existing) return existing._id;
	return await ctx.runMutation(internal.nba.mutations.upsertTeam, {
		...teamIdentityArgs(team),
		season,
	});
}

// Memoized fallback season, only queried when ESPN omits season metadata
function createSeasonFallback(ctx: any): () => Promise<string> {
	let season: Promise<string> | undefined;
	return () => {
		season ??= getCurrentSeasonName(ctx);
		return season;
	};
}

// Season and season type for an event, preferring ESPN's own metadata
async function resolveEventSeason(
	espnSeason: ApiEventSeason | undefined,
	getFallbackSeason: () => Promise<string>,
): Promise<{ season: string; seasonType?: number }> {
	const parsed = parseEspnSeason("nba", espnSeason);
	return {
		season: parsed.season ?? (await getFallbackSeason()),
		seasonType: parsed.seasonType,
	};
}

async function scheduleStandingsRefresh(ctx: any, espnGameId: string) {
	console.log(`[NBA] Game ${espnGameId} went final; refreshing standings in ${STANDINGS_REFRESH_DELAY_MS / 1000}s`);
	await ctx.scheduler.runAfter(STANDINGS_REFRESH_DELAY_MS, internal.nba.actions.refreshStandings, {});
}

// Daily cron: discover today's games, update standings
export const discoverTodaysGames = internalAction({
	args: {},
	handler: async (ctx) => {
		const getFallbackSeason = createSeasonFallback(ctx);
		const date = getTodayDate();
		const baseUrl = getSiteApi();

		console.log(`[NBA] Discovering games for ${date}...`);

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

		// Also refresh standings so every team's record is current
		try {
			const standings = await fetchStandings(baseUrl);
			if (standings) {
				const standingsSeason = standings.season ?? (await getFallbackSeason());
				const teamCount = await upsertStandingsTeams(ctx, standings, standingsSeason);
				console.log(`[NBA] Updated standings for ${teamCount} teams, season ${standingsSeason}`);
			}
		} catch (error) {
			console.error("[NBA] Standings fetch failed:", error);
		}

		// Process each game
		for (const event of events) {
			const competition = event.competitions[0];
			if (!competition) continue;

			const homeComp = competition.competitors.find((c) => c.homeAway === "home");
			const awayComp = competition.competitors.find((c) => c.homeAway === "away");
			if (!homeComp || !awayComp) continue;

			const { season, seasonType } = await resolveEventSeason(event.season, getFallbackSeason);

			// Ensure team records exist for the game's season
			const homeTeamId = await ensureTeam(ctx, homeComp.team, season);
			const awayTeamId = await ensureTeam(ctx, awayComp.team, season);

			const scheduledStart = competition.startDate
				? new Date(competition.startDate).getTime()
				: Date.now();

			const state = event.status?.type?.state;
			const eventStatus = mapApiStateToEventStatus(state, event.status?.type?.detail);

			const gameEventId = await ctx.runMutation(internal.nba.mutations.upsertGameEvent, {
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
					internal.nba.actions.checkGameStatus,
					{ gameEventId },
				);
				console.log(`[NBA] Scheduled check for game ${event.id} at ${new Date(checkTime).toISOString()}`);
			}
		}

		console.log(`[NBA] Discovery complete: ${events.length} games processed`);
	},
});

// Refresh every team's record from ESPN standings.
// Scheduled after games go final; also safe to run from a cron.
export const refreshStandings = internalAction({
	args: { seasonYear: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const standings = await fetchStandings(getSiteApi(), args.seasonYear);
		if (!standings) return;
		if (args.seasonYear && !standings.season) {
			console.warn(`[NBA] Standings for season year ${args.seasonYear} had no season label; skipping`);
			return;
		}

		if (standings.teams.length === 0) {
			console.warn("[NBA] Standings refresh returned no teams; skipping");
			return;
		}

		const season = standings.season ?? (await getCurrentSeasonName(ctx));
		const teamCount = await upsertStandingsTeams(ctx, standings, season);
		console.log(`[NBA] Standings refreshed for ${teamCount} teams, season ${season}`);
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
		const lockAcquired = await ctx.runMutation(internal.nba.mutations.tryAcquireGameSyncLock, {
			gameEventId: args.gameEventId,
			lockMs: 90_000,
		});
		if (!lockAcquired) {
			console.log(`[NBA] Skipping check for ${args.espnGameId}; sync lock held`);
			return;
		}

		try {
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
		const homeScore = parseApiScore(homeComp?.score);
		const awayScore = parseApiScore(awayComp?.score);
		const { seasonType } = parseEspnSeason("nba", summaryData.header?.season);

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
				seasonType,
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
			if (homeScore === undefined || awayScore === undefined) {
				const message = `[NBA][SCORE_ANOMALY] In-progress game ${args.espnGameId} missing score(s): home=${homeComp?.score ?? "undefined"}, away=${awayComp?.score ?? "undefined"}`;
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
				await ctx.runMutation(internal.nba.mutations.updateGameEventStatus, {
					gameEventId: args.gameEventId,
					seasonType,
					eventStatus,
					statusDetail: detail,
					checkCount: currentCheckCount + 1,
					lastFetchedAt: Date.now(),
				});
				if (currentCheckCount + 1 < 24) {
					await ctx.scheduler.runAfter(2 * 60 * 1000, internal.nba.actions.checkGameStatusV2, args);
				}
				return;
			}

			console.log(`[NBA] Game ${args.espnGameId} in progress: ${awayScore}-${homeScore}`);

			await ctx.runMutation(internal.nba.mutations.updateGameEventStatus, {
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
				await ctx.scheduler.runAfter(15 * 60 * 1000, internal.nba.actions.checkGameStatusV2, args);
			}
			return;
		}

		if (state === "post") {
			// Game completed: final update
			if (homeScore === undefined || awayScore === undefined) {
				const message = `[NBA][SCORE_ANOMALY] Final state for game ${args.espnGameId} has incomplete score: home=${homeComp?.score ?? "undefined"}, away=${awayComp?.score ?? "undefined"}`;
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
				await ctx.runMutation(internal.nba.mutations.updateGameEventStatus, {
					gameEventId: args.gameEventId,
					seasonType,
					eventStatus: currentGame?.eventStatus === "completed" ? "in_progress" : (currentGame?.eventStatus ?? "in_progress"),
					statusDetail: detail,
					checkCount: currentCheckCount + 1,
					lastFetchedAt: Date.now(),
				});
				if (currentCheckCount + 1 < 24) {
					await ctx.scheduler.runAfter(2 * 60 * 1000, internal.nba.actions.checkGameStatusV2, args);
				}
				return;
			}

			if (isSuspiciousBlowoutWithZero(homeScore, awayScore)) {
				const message = `[NBA][SCORE_ANOMALY] Suspicious final score for game ${args.espnGameId}: ${awayScore}-${homeScore}. Delaying completion and retrying.`;
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
				await ctx.runMutation(internal.nba.mutations.updateGameEventStatus, {
					gameEventId: args.gameEventId,
					seasonType,
					eventStatus: currentGame?.eventStatus === "completed" ? "in_progress" : (currentGame?.eventStatus ?? "in_progress"),
					statusDetail: detail,
					checkCount: currentCheckCount + 1,
					lastFetchedAt: Date.now(),
				});
				if (currentCheckCount + 1 < 24) {
					await ctx.scheduler.runAfter(2 * 60 * 1000, internal.nba.actions.checkGameStatusV2, args);
				}
				return;
			}

			console.log(`[NBA] Game ${args.espnGameId} completed: ${awayScore}-${homeScore}`);
			const wasCompleted = currentGame?.eventStatus === "completed";

			await ctx.runMutation(internal.nba.mutations.updateGameEventStatus, {
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

				// Update league rankings
				await ctx.runMutation(internal.nba.mutations.updateLeagueRankings, {
					season: game.season,
				});
			}

			if (!wasCompleted) {
				await scheduleStandingsRefresh(ctx, args.espnGameId);
			}

			console.log(`[NBA] Game ${args.espnGameId} fully processed`);
			return;
		}

		// Unknown state - reschedule if under limit
		if (currentCheckCount + 1 < 24) {
			await ctx.scheduler.runAfter(15 * 60 * 1000, internal.nba.actions.checkGameStatusV2, args);
		}
		} finally {
			await ctx.runMutation(internal.nba.mutations.releaseGameSyncLock, {
				gameEventId: args.gameEventId,
			});
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

	// Pre-game summaries have no scores or box score yet
	if (competition?.status?.type?.state === "pre") return;

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

	const homeScore = parseApiScore(headerHome.score);
	const awayScore = parseApiScore(headerAway.score);
	if (homeScore === undefined || awayScore === undefined) {
		const message = `[NBA][SCORE_ANOMALY] Box score sync skipped for ${espnGameId}; missing header score(s): home=${headerHome.score ?? "undefined"}, away=${headerAway.score ?? "undefined"}`;
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
			try {
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
			} catch (error) {
				if (isWriteConflictError(error)) {
					console.warn(
						`[NBA] Player event upsert conflict for game ${espnGameId}, player ${player.espnPlayerId}; skipping row this pass`,
					);
					continue;
				}
				throw error;
			}
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
		let lockGameEventId: Id<"nbaGameEvent"> | undefined;

		const existingGame = await ctx.runQuery(internal.nba.queries.getGameEventInternal, {
			espnGameId: args.espnGameId,
		});
		if (existingGame) {
			const lockAcquired = await ctx.runMutation(internal.nba.mutations.tryAcquireGameSyncLock, {
				gameEventId: existingGame._id,
				lockMs: 90_000,
				minIntervalMs: 15_000,
			});
			if (!lockAcquired) {
				return;
			}
			lockGameEventId = existingGame._id;
		}

		try {
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
			// ESPN has no score or box score before tipoff; that's expected, not an anomaly
			const isPreGame = state === "pre";

			const homeComp = competition?.competitors?.find((c) => c.homeAway === "home");
			const awayComp = competition?.competitors?.find((c) => c.homeAway === "away");
			if (!homeComp || !awayComp) return;

			const homeScore = parseApiScore(homeComp.score);
			const awayScore = parseApiScore(awayComp.score);
			const scoresAreComplete = homeScore !== undefined && awayScore !== undefined;
			const suspiciousFinal = eventStatus === "completed" && isSuspiciousBlowoutWithZero(homeScore, awayScore);
			if (!scoresAreComplete && !isPreGame) {
				const message = `[NBA][SCORE_ANOMALY] Live sync missing score(s) for ${args.espnGameId}: home=${homeComp.score ?? "undefined"}, away=${awayComp.score ?? "undefined"}, state=${state ?? "unknown"}`;
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
				const message = `[NBA][SCORE_ANOMALY] Live sync suspicious final for ${args.espnGameId}: ${awayScore}-${homeScore}. Keeping prior status until next sync.`;
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

			const espnSeason = await resolveEventSeason(summaryData.header?.season, createSeasonFallback(ctx));
			// Existing games keep their stored season (and team ids); upsertGameEvent
			// warns and leaves them alone if ESPN disagrees.
			const season = existingGame?.season ?? espnSeason.season;

			// Look up teams first to avoid overwriting standings data
			const homeTeamId = await ensureTeam(ctx, homeComp.team, season);
			const awayTeamId = await ensureTeam(ctx, awayComp.team, season);

			const scheduledStart = competition?.date
				? new Date(competition.date).getTime()
				: Date.now();

			const nextEventStatus = suspiciousFinal
				? (existingGame?.eventStatus === "completed" ? "in_progress" : (existingGame?.eventStatus ?? "in_progress"))
				: eventStatus;

			// Upsert game event
			const gameEventId = await ctx.runMutation(internal.nba.mutations.upsertGameEvent, {
				espnGameId: args.espnGameId,
				season: espnSeason.season,
				seasonType: espnSeason.seasonType,
				homeTeamId,
				awayTeamId,
				gameDate: existingGame?.gameDate ?? formatGameDate(scheduledStart),
				scheduledStart,
				eventStatus: nextEventStatus,
				statusDetail: detail,
				venue: competition?.venue?.fullName,
				homeScore: scoresAreComplete && !isPreGame ? homeScore : undefined,
				awayScore: scoresAreComplete && !isPreGame ? awayScore : undefined,
				homeTeamRecord: getTotalRecord(homeComp),
				awayTeamRecord: getTotalRecord(awayComp),
				lastFetchedAt: Date.now(),
			});

			if (nextEventStatus === "completed" && existingGame?.eventStatus !== "completed") {
				await scheduleStandingsRefresh(ctx, args.espnGameId);
			}

			// Sync box score data
			if (!isPreGame) {
				await syncBoxScoreData(ctx, gameEventId, args.espnGameId, summaryData);
			}
		} finally {
			if (lockGameEventId) {
				await ctx.runMutation(internal.nba.mutations.releaseGameSyncLock, {
					gameEventId: lockGameEventId,
				});
			}
		}
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
// These are one-time actions for initial data population.
// Run order: bootstrapTeams → bootstrapPlayers → backfillGames → recalculateAll
// ============================================================================

// Step 1: Bootstrap all NBA teams from standings
export const bootstrapTeams = internalAction({
	args: { bootstrapRunId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		// Same season resolution as bootstrapPlayers, which looks these teams up next
		const season = await getCurrentSeasonName(ctx);
		const baseUrl = getSiteApi();

		console.log(`[NBA Bootstrap] Fetching standings for season ${season}...`);

		const standings = await fetchStandings(baseUrl);
		if (!standings) {
			throw new Error(`[NBA Bootstrap] Standings fetch failed`);
		}
		if (standings.season && standings.season !== season) {
			console.warn(`[NBA Bootstrap] Standings are for ${standings.season}, storing under ${season}`);
		}

		const teamCount = await upsertStandingsTeams(ctx, standings, season);

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
	coreBase: string,
	coreSeasonYear: number,
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
		const coreStats = await fetchPlayerSeasonStatsFromCore(
			coreBase,
			coreSeasonYear,
			athlete.id,
		);

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
			...(coreStats ?? {}),
		});
	}

	return athletes.length;
}

// Step 2: Bootstrap players from rosters (entry point)
export const bootstrapPlayers = internalAction({
	args: { bootstrapRunId: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const season = await getCurrentSeasonName(ctx);

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
		const teamInfos = teams.map((t: any) => ({ espnTeamId: t.espnTeamId, convexTeamId: t._id }));

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

		const season = await getCurrentSeasonName(ctx);
		const commonBase = getCommonApi();
		const coreBase = getCoreApi();
		const coreSeasonYear = getCoreSeasonYear(season);
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
				const playerCount = await fetchAndUpsertRoster(
					ctx,
					commonBase,
					coreBase,
					coreSeasonYear,
					teamInfo.espnTeamId,
					teamInfo.convexTeamId,
					season,
				);
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
		const season = await getCurrentSeasonName(ctx);
		const commonBase = getCommonApi();
		const coreBase = getCoreApi();
		const coreSeasonYear = getCoreSeasonYear(season);

		const team = await ctx.runQuery(internal.nba.queries.getTeamInternal, {
			espnTeamId: args.espnTeamId, season,
		});

		if (!team) {
			console.error(`[NBA Bootstrap] Team ${args.espnTeamId} not found. Run bootstrapTeams first.`);
			return;
		}

		console.log(`[NBA Bootstrap] Fetching roster for ${team.name} (${args.espnTeamId})...`);

		const playerCount = await fetchAndUpsertRoster(
			ctx,
			commonBase,
			coreBase,
			coreSeasonYear,
			args.espnTeamId,
			team._id,
			season,
		);

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
		const season = await getCurrentSeasonName(ctx);
		const startDate =
			args.startDate ??
			(await getCurrentSeasonEventDate(ctx, "preseasonStart", getSeasonStartDate(season)));
		const endDate =
			args.endDate ??
			(await getCurrentSeasonEventDate(ctx, "playoffEnd", getSeasonEndDate(season)));
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
		// Only store as-of-game records on games we already have
		recordsOnly: v.optional(v.boolean()),
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
		const getFallbackSeason = createSeasonFallback(ctx);
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
					recordsOnly: args.recordsOnly,
					targetEspnTeamId: args.targetEspnTeamId,
					bootstrapRunId: args.bootstrapRunId,
				});
				return;
			}

			const scoreboardData = (await scoreboardRes.json()) as ApiScoreboardResponse;
			const events = scoreboardData.events ?? [];

			console.log(`[NBA Backfill] ${date}: ${events.length} games found`);

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

				// If filtering by team, skip games that don't involve the target team
				if (args.targetEspnTeamId && homeComp.team.id !== args.targetEspnTeamId && awayComp.team.id !== args.targetEspnTeamId) {
					continue;
				}

				const { season, seasonType } = await resolveEventSeason(event.season, getFallbackSeason);

				// Look up teams first to avoid overwriting standings data
				const homeTeamId = await ensureTeam(ctx, homeComp.team, season);
				const awayTeamId = await ensureTeam(ctx, awayComp.team, season);

				const scheduledStart = competition.startDate
					? new Date(competition.startDate).getTime()
					: Date.now();

				const state = event.status?.type?.state;
				const eventStatus = mapApiStateToEventStatus(state, event.status?.type?.detail);

				const gameEventId = await ctx.runMutation(internal.nba.mutations.upsertGameEvent, {
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

			if (recordUpdates.length > 0) {
				await ctx.runMutation(internal.nba.mutations.setGameRecords, { games: recordUpdates });
			}

			console.log(`[NBA Backfill] ${date}: processed ${processedGames} completed games`);
		} catch (error) {
			console.error(`[NBA Backfill] Error processing date ${date}:`, error);
		}

		// Schedule next date
		await ctx.scheduler.runAfter(BACKFILL_DELAY_MS, internal.nba.actions.backfillDateChunk, {
			dates: args.dates,
			offset: args.offset + 1,
			recordsOnly: args.recordsOnly,
			targetEspnTeamId: args.targetEspnTeamId,
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

		console.log(`[NBA Schedule] Syncing schedule: ${startDate} to ${endDate} (${dates.length} dates)`);

		await ctx.scheduler.runAfter(100, internal.nba.actions.backfillDateChunk, {
			dates,
			offset: 0,
		});

		const recordDates = (
			await ctx.runQuery(internal.nba.queries.getDatesMissingRecords, { season })
		).filter((date) => date < startDate);
		if (recordDates.length > 0) {
			console.log(`[NBA Schedule] Backfilling records for ${recordDates.length} past dates`);
			await ctx.scheduler.runAfter(100, internal.nba.actions.backfillDateChunk, {
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

		console.log(`[NBA Recalculate] Starting full recalculation for season ${season}...`);

		// Recalculate team averages
		const teams = await ctx.runQuery(internal.nba.queries.getAllTeamsInternal, { season });
		console.log(`[NBA Recalculate] Recalculating averages for ${teams.length} teams...`);

		for (const team of teams) {
			await ctx.runMutation(internal.nba.mutations.recalculateTeamAverages, {
				teamId: team._id,
			});
		}

		console.log(`[NBA Recalculate] Team averages done. Reconciling player season stats from Core...`);
		await runCorePlayerStatsBackfill(ctx, { season, dryRun: false });

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

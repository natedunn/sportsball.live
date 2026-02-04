import { createServerFn } from "@tanstack/react-start";
import type { League } from "./league";
import { getLeagueSiteApi } from "./league";
import { getTeamColors, getProxiedLogoUrl } from "./team-utils";
import type {
	TeamStats,
	Player,
	GameDetails,
	SeasonSeries,
	MatchupGame,
	ApiStat,
	ApiBoxscorePlayers,
	ApiSeasonSeries,
	ApiGameDetailsResponse,
} from "./game-details.types";

// Re-export types for convenience
export type {
	TeamStats,
	PlayerStats,
	Player,
	GameDetailsTeam,
	MatchupGame,
	SeasonSeries,
	GameDetails,
} from "./game-details.types";

// Shared stat parsing utilities
function parseStatValue(stats: ApiStat[] | undefined, name: string): number {
	const stat = stats?.find((s) => s.name === name);
	if (!stat) return 0;

	// Handle combined stats like "43-93"
	if (stat.displayValue.includes("-")) {
		const [made] = stat.displayValue.split("-");
		return parseInt(made, 10) || 0;
	}

	return parseFloat(stat.displayValue) || 0;
}

function parseStatParts(stats: ApiStat[] | undefined, name: string): [number, number] {
	const stat = stats?.find((s) => s.name === name);
	if (!stat || !stat.displayValue.includes("-")) return [0, 0];

	const [made, attempted] = stat.displayValue.split("-");
	return [parseInt(made, 10) || 0, parseInt(attempted, 10) || 0];
}

function extractTeamStats(stats: ApiStat[] | undefined): TeamStats {
	const [fgMade, fgAttempted] = parseStatParts(stats, "fieldGoalsMade-fieldGoalsAttempted");
	const [threeMade, threeAttempted] = parseStatParts(stats, "threePointFieldGoalsMade-threePointFieldGoalsAttempted");
	const [ftMade, ftAttempted] = parseStatParts(stats, "freeThrowsMade-freeThrowsAttempted");

	return {
		fieldGoalsMade: fgMade,
		fieldGoalsAttempted: fgAttempted,
		fieldGoalPct: parseStatValue(stats, "fieldGoalPct"),
		threePointMade: threeMade,
		threePointAttempted: threeAttempted,
		threePointPct: parseStatValue(stats, "threePointFieldGoalPct"),
		freeThrowsMade: ftMade,
		freeThrowsAttempted: ftAttempted,
		freeThrowPct: parseStatValue(stats, "freeThrowPct"),
		totalRebounds: parseStatValue(stats, "totalRebounds"),
		offensiveRebounds: parseStatValue(stats, "offensiveRebounds"),
		defensiveRebounds: parseStatValue(stats, "defensiveRebounds"),
		assists: parseStatValue(stats, "assists"),
		steals: parseStatValue(stats, "steals"),
		blocks: parseStatValue(stats, "blocks"),
		turnovers: parseStatValue(stats, "turnovers") || parseStatValue(stats, "totalTurnovers"),
		fouls: parseStatValue(stats, "fouls"),
		pointsInPaint: parseStatValue(stats, "pointsInPaint"),
		fastBreakPoints: parseStatValue(stats, "fastBreakPoints"),
		largestLead: parseStatValue(stats, "largestLead"),
	};
}

function extractPlayers(boxscorePlayers: ApiBoxscorePlayers | undefined): Player[] {
	if (!boxscorePlayers?.statistics?.[0]) return [];

	const statCategory = boxscorePlayers.statistics[0];
	const statNames = statCategory.names;

	const getStatIndex = (name: string): number => statNames.indexOf(name);

	return statCategory.athletes.map((playerData): Player => {
		const stats = playerData.stats ?? [];
		const minIdx = getStatIndex("MIN");
		const fgIdx = getStatIndex("FG");
		const tpIdx = getStatIndex("3PT");
		const ftIdx = getStatIndex("FT");
		const orebIdx = getStatIndex("OREB");
		const drebIdx = getStatIndex("DREB");
		const rebIdx = getStatIndex("REB");
		const astIdx = getStatIndex("AST");
		const stlIdx = getStatIndex("STL");
		const blkIdx = getStatIndex("BLK");
		const toIdx = getStatIndex("TO");
		const pfIdx = getStatIndex("PF");
		const pmIdx = getStatIndex("+/-");
		const ptsIdx = getStatIndex("PTS");

		const getStat = (idx: number, fallback: string): string => {
			return idx >= 0 && stats[idx] != null ? stats[idx] : fallback;
		};

		const getStatNum = (idx: number): number => {
			return idx >= 0 && stats[idx] != null ? parseInt(stats[idx], 10) || 0 : 0;
		};

		return {
			id: playerData.athlete.id,
			name: playerData.athlete.displayName ?? "Unknown",
			jersey: playerData.athlete.jersey ?? "",
			position: playerData.athlete.position?.abbreviation ?? "",
			starter: playerData.starter ?? false,
			active: playerData.active ?? false,
			stats: {
				minutes: getStat(minIdx, "0"),
				fieldGoals: getStat(fgIdx, "0-0"),
				threePointers: getStat(tpIdx, "0-0"),
				freeThrows: getStat(ftIdx, "0-0"),
				offensiveRebounds: getStatNum(orebIdx),
				defensiveRebounds: getStatNum(drebIdx),
				totalRebounds: getStatNum(rebIdx),
				assists: getStatNum(astIdx),
				steals: getStatNum(stlIdx),
				blocks: getStatNum(blkIdx),
				turnovers: getStatNum(toIdx),
				fouls: getStatNum(pfIdx),
				plusMinus: getStat(pmIdx, "0"),
				points: getStatNum(ptsIdx),
			},
		};
	});
}

function extractAllSeries(
	seasonseries: ApiSeasonSeries[] | undefined,
	currentGameId: string,
): SeasonSeries[] {
	if (!seasonseries || seasonseries.length === 0) return [];

	return seasonseries
		.filter((series) => series.events && series.events.length > 0)
		.map((series): SeasonSeries => {
			const games: MatchupGame[] = (series.events ?? []).map((event) => {
				const homeCompetitor = event.competitors.find((c) => c.homeAway === "home");
				const awayCompetitor = event.competitors.find((c) => c.homeAway === "away");

				return {
					id: event.id,
					date: event.date,
					statusDetail: event.statusType?.detail ?? "Final",
					isCurrent: event.id === currentGameId,
					homeTeam: {
						id: homeCompetitor?.team.id ?? "",
						abbreviation: homeCompetitor?.team.abbreviation ?? "",
						score: parseInt(homeCompetitor?.score ?? "0", 10),
						winner: homeCompetitor?.winner ?? false,
					},
					awayTeam: {
						id: awayCompetitor?.team.id ?? "",
						abbreviation: awayCompetitor?.team.abbreviation ?? "",
						score: parseInt(awayCompetitor?.score ?? "0", 10),
						winner: awayCompetitor?.winner ?? false,
					},
				};
			});

			return {
				type: series.type === "playoff" ? "playoff" : "season",
				title: series.title ?? (series.type === "playoff" ? "Playoff Series" : "Regular Season Series"),
				summary: series.summary ?? "",
				completed: series.completed ?? false,
				games,
			};
		});
}

// Internal handler for fetching game details
async function fetchGameDetailsForLeague(
	league: League,
	gameId: string,
): Promise<GameDetails> {
	const baseUrl = getLeagueSiteApi(league);

	const response = await fetch(`${baseUrl}/summary?event=${gameId}`, {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Game details API error: ${response.status}`);
	}

	const apiData = (await response.json()) as ApiGameDetailsResponse;

	if (!apiData.boxscore?.teams || apiData.boxscore.teams.length < 2) {
		throw new Error("Invalid game data");
	}

	const competition = apiData.header?.competitions?.[0];
	const boxscoreTeams = apiData.boxscore.teams;
	const boxscorePlayers = apiData.boxscore.players;

	const headerAway = competition?.competitors?.find((c) => c.homeAway === "away");
	const headerHome = competition?.competitors?.find((c) => c.homeAway === "home");

	const awayStats = boxscoreTeams.find((t) => t.team.id === headerAway?.team.id);
	const homeStats = boxscoreTeams.find((t) => t.team.id === headerHome?.team.id);

	const awayPlayers = boxscorePlayers?.find((p) => p.team.id === headerAway?.team.id);
	const homePlayers = boxscorePlayers?.find((p) => p.team.id === headerHome?.team.id);

	const awayColors = getTeamColors(league, headerAway?.team.uid, headerAway?.team.id);
	const homeColors = getTeamColors(league, headerHome?.team.uid, headerHome?.team.id);

	return {
		id: gameId,
		state: competition?.status?.type?.state ?? "pre",
		statusDetail: competition?.status?.type?.detail,
		venue: competition?.venue?.fullName,
		date: competition?.date,
		allSeries: extractAllSeries(apiData.seasonseries, gameId),
		away: {
			id: headerAway?.team.id ?? "",
			uid: headerAway?.team.uid,
			name: headerAway?.team.name,
			abbreviation: headerAway?.team.abbreviation,
			score: parseInt(headerAway?.score ?? "0", 10) || 0,
			logo: getProxiedLogoUrl(league, awayStats?.team.logo, headerAway?.team.id),
			darkColor: awayColors.darkColor,
			lightColor: awayColors.lightColor,
			winner: headerAway?.winner ?? false,
			record: headerAway?.record?.find((r) => r.type === "total")?.summary,
			stats: extractTeamStats(awayStats?.statistics),
			players: extractPlayers(awayPlayers),
		},
		home: {
			id: headerHome?.team.id ?? "",
			uid: headerHome?.team.uid,
			name: headerHome?.team.name,
			abbreviation: headerHome?.team.abbreviation,
			score: parseInt(headerHome?.score ?? "0", 10) || 0,
			logo: getProxiedLogoUrl(league, homeStats?.team.logo, headerHome?.team.id),
			darkColor: homeColors.darkColor,
			lightColor: homeColors.lightColor,
			winner: headerHome?.winner ?? false,
			record: headerHome?.record?.find((r) => r.type === "total")?.summary,
			stats: extractTeamStats(homeStats?.statistics),
			players: extractPlayers(homePlayers),
		},
	};
}

// League-specific server functions
export const fetchGameDetails = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: gameId }): Promise<GameDetails> => {
		return fetchGameDetailsForLeague("nba", gameId);
	});

export const fetchWnbaGameDetails = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: gameId }): Promise<GameDetails> => {
		return fetchGameDetailsForLeague("wnba", gameId);
	});

export const fetchGLeagueGameDetails = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: gameId }): Promise<GameDetails> => {
		return fetchGameDetailsForLeague("gleague", gameId);
	});

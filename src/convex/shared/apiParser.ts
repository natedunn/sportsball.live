// API response parsing utilities for Convex functions

// ============================================================
// API provider response types
// (Convex functions can't import from src/lib)
// ============================================================

export interface ApiStat {
	name: string;
	displayValue: string;
}

export interface ApiBoxscoreTeam {
	team: {
		id: string;
		uid?: string;
		name?: string;
		abbreviation?: string;
		logo?: string;
	};
	score: string;
	winner?: boolean;
	statistics?: ApiStat[];
}

export interface ApiAthlete {
	id: string;
	displayName?: string;
	jersey?: string;
	position?: {
		abbreviation?: string;
	};
}

export interface ApiPlayerStats {
	athlete: ApiAthlete;
	stats: string[];
	starter?: boolean;
	active?: boolean;
}

export interface ApiPlayerStatCategory {
	names: string[];
	keys: string[];
	athletes: ApiPlayerStats[];
}

export interface ApiBoxscorePlayers {
	team: { id: string };
	statistics: ApiPlayerStatCategory[];
}

export interface ApiHeaderCompetitor {
	homeAway: "home" | "away";
	team: {
		id: string;
		uid?: string;
		name?: string;
		displayName?: string;
		abbreviation?: string;
		logo?: string;
		slug?: string;
		location?: string;
	};
	score: string;
	winner?: boolean;
	record?: Array<{
		type: string;
		summary?: string;
		displayValue?: string;
	}>;
}

export interface ApiGameSummaryResponse {
	boxscore?: {
		teams?: ApiBoxscoreTeam[];
		players?: ApiBoxscorePlayers[];
	};
	header?: {
		competitions?: Array<{
			status?: {
				type?: {
					state?: string;
					detail?: string;
				};
			};
			venue?: {
				fullName?: string;
			};
			date?: string;
			competitors?: ApiHeaderCompetitor[];
		}>;
	};
	seasonseries?: unknown[];
}

export interface ApiScoreboardEvent {
	id: string;
	uid: string;
	status?: {
		type: {
			state: string;
			detail?: string;
		};
	};
	competitions: Array<{
		startDate?: string;
		venue?: {
			fullName?: string;
		};
		competitors: Array<{
			homeAway: "home" | "away";
			team: {
				id: string;
				uid?: string;
				name?: string;
				displayName?: string;
				abbreviation?: string;
				slug?: string;
				location?: string;
				logo?: string;
			};
			score: string;
			records?: Array<{ type?: string; summary?: string }>;
		}>;
	}>;
}

export interface ApiScoreboardResponse {
	events?: ApiScoreboardEvent[];
}

export interface ApiStandingsTeamEntry {
	team: {
		id: string;
		uid?: string;
		displayName?: string;
		abbreviation?: string;
		slug?: string;
		location?: string;
	};
	stats: Array<{
		name: string;
		value: number;
		displayValue?: string;
	}>;
}

export interface ApiStandingsResponse {
	children?: Array<{
		name?: string;
		standings?: {
			entries?: ApiStandingsTeamEntry[];
		};
	}>;
}

export interface ApiRosterAthlete {
	id: string;
	firstName: string;
	lastName: string;
	displayName: string;
	jersey?: string;
	position?: { abbreviation?: string };
	displayHeight?: string;
	displayWeight?: string;
	age?: number;
	experience?: { years?: number };
	college?: { name?: string };
	headshot?: { href?: string };
}

export interface ApiRosterResponse {
	positionGroups?: Array<{
		type: string;
		athletes: ApiRosterAthlete[];
	}>;
}

// ============================================================
// Parsed output types (clean data for Convex mutations)
// ============================================================

export interface ParsedTeamBoxScore {
	fieldGoalsMade: number;
	fieldGoalsAttempted: number;
	fieldGoalPct: number;
	threePointMade: number;
	threePointAttempted: number;
	threePointPct: number;
	freeThrowsMade: number;
	freeThrowsAttempted: number;
	freeThrowPct: number;
	totalRebounds: number;
	offensiveRebounds: number;
	defensiveRebounds: number;
	assists: number;
	steals: number;
	blocks: number;
	turnovers: number;
	fouls: number;
	pointsInPaint: number;
	fastBreakPoints: number;
	largestLead: number;
}

export interface ParsedPlayerBoxScore {
	espnPlayerId: string;
	name: string;
	jersey: string;
	position: string;
	starter: boolean;
	active: boolean;
	minutes: number;
	points: number;
	totalRebounds: number;
	offensiveRebounds: number;
	defensiveRebounds: number;
	assists: number;
	steals: number;
	blocks: number;
	turnovers: number;
	fouls: number;
	fieldGoalsMade: number;
	fieldGoalsAttempted: number;
	threePointMade: number;
	threePointAttempted: number;
	freeThrowsMade: number;
	freeThrowsAttempted: number;
	plusMinus: number | undefined;
}

// ============================================================
// Parsing functions
// ============================================================

function parseStatValue(stats: ApiStat[] | undefined, name: string): number {
	const stat = stats?.find((s) => s.name === name);
	if (!stat) return 0;

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

/** Parse team box score stats from boxscore.teams[].statistics */
export function parseTeamBoxScore(stats: ApiStat[] | undefined): ParsedTeamBoxScore {
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

/** Parse player box scores from boxscore.players[].statistics */
export function parsePlayerBoxScores(boxscorePlayers: ApiBoxscorePlayers | undefined): ParsedPlayerBoxScore[] {
	if (!boxscorePlayers?.statistics?.[0]) return [];

	const statCategory = boxscorePlayers.statistics[0];
	const statNames = statCategory.names;

	const getStatIndex = (name: string): number => statNames.indexOf(name);

	return statCategory.athletes.map((playerData): ParsedPlayerBoxScore => {
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

		const getStatNum = (idx: number): number => {
			return idx >= 0 && stats[idx] != null ? parseInt(stats[idx], 10) || 0 : 0;
		};

		const getStatStr = (idx: number): string => {
			return idx >= 0 && stats[idx] != null ? stats[idx] : "0";
		};

		// Parse minutes from string like "32" or "32:15"
		const minutesStr = getStatStr(minIdx);
		const minutes = parseFloat(minutesStr) || 0;

		// Parse shooting splits like "5-10"
		const parseSplit = (idx: number): [number, number] => {
			const val = getStatStr(idx);
			if (val.includes("-")) {
				const [made, attempted] = val.split("-");
				return [parseInt(made, 10) || 0, parseInt(attempted, 10) || 0];
			}
			return [0, 0];
		};

		const [fgMade, fgAttempted] = parseSplit(fgIdx);
		const [threeMade, threeAttempted] = parseSplit(tpIdx);
		const [ftMade, ftAttempted] = parseSplit(ftIdx);

		// Parse plus/minus
		const pmStr = getStatStr(pmIdx);
		const plusMinus = pmStr !== "0" && pmStr !== "" ? parseInt(pmStr, 10) : undefined;

		return {
			espnPlayerId: playerData.athlete.id,
			name: playerData.athlete.displayName ?? "Unknown",
			jersey: playerData.athlete.jersey ?? "",
			position: playerData.athlete.position?.abbreviation ?? "",
			starter: playerData.starter ?? false,
			active: playerData.active ?? false,
			minutes,
			points: getStatNum(ptsIdx),
			totalRebounds: getStatNum(rebIdx),
			offensiveRebounds: getStatNum(orebIdx),
			defensiveRebounds: getStatNum(drebIdx),
			assists: getStatNum(astIdx),
			steals: getStatNum(stlIdx),
			blocks: getStatNum(blkIdx),
			turnovers: getStatNum(toIdx),
			fouls: getStatNum(pfIdx),
			fieldGoalsMade: fgMade,
			fieldGoalsAttempted: fgAttempted,
			threePointMade: threeMade,
			threePointAttempted: threeAttempted,
			freeThrowsMade: ftMade,
			freeThrowsAttempted: ftAttempted,
			plusMinus: plusMinus !== undefined && !isNaN(plusMinus) ? plusMinus : undefined,
		};
	});
}

/** Helper to get a stat value from standings entry stats array */
export function getStandingStat(stats: Array<{ name: string; value: number }>, name: string): number {
	return stats.find((s) => s.name === name)?.value ?? 0;
}

/** Helper to get a stat display value from standings entry stats array */
export function getStandingStatDisplay(stats: Array<{ name: string; value: number; displayValue?: string }>, name: string): string {
	return stats.find((s) => s.name === name)?.displayValue ?? "";
}

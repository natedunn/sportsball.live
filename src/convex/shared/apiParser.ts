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

/** ESPN season metadata: `year` is the year the season ends (2027 for 2026-27). */
export interface ApiEventSeason {
	year?: number;
	type?: number;
	slug?: string;
}

export interface ApiGameSummaryResponse {
	boxscore?: {
		teams?: ApiBoxscoreTeam[];
		players?: ApiBoxscorePlayers[];
	};
	header?: {
		season?: ApiEventSeason;
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
	season?: ApiEventSeason;
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
		/** "STD", "CC" (Cup championship), "ALLSTAR"... */
		type?: {
			abbreviation?: string;
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
	season?: {
		year?: number;
		displayName?: string;
	};
	children?: Array<{
		name?: string;
		standings?: {
			season?: number;
			seasonType?: number;
			seasonDisplayName?: string;
			entries?: ApiStandingsTeamEntry[];
		};
	}>;
}

// ESPN sends null for missing roster fields
export interface ApiRosterAthlete {
	id: string;
	firstName?: string | null;
	lastName?: string | null;
	displayName: string;
	jersey?: string | null;
	position?: { abbreviation?: string | null } | null;
	displayHeight?: string | null;
	displayWeight?: string | null;
	age?: number | null;
	/** ISO timestamp, e.g. "1996-10-30T08:00Z" (site API only) */
	dateOfBirth?: string | null;
	experience?: { years?: number | null } | null;
	college?: { name?: string | null } | null;
	headshot?: { href?: string | null } | null;
}

/** Common API roster (`/teams/{id}/roster`): no birthdates */
export interface ApiRosterResponse {
	positionGroups?: Array<{
		type: string;
		athletes: ApiRosterAthlete[];
	}>;
}

/** Site API roster (`/teams/{id}/roster`): flat, with birthdates */
export interface ApiSiteRosterResponse {
	season?: ApiEventSeason;
	athletes?: ApiRosterAthlete[];
}

/** Core API athlete (`/athletes/{id}`): carries the draft, absent for undrafted players */
export interface ApiCoreAthleteResponse {
	draft?: {
		year?: number;
		round?: number;
		selection?: number;
		team?: { $ref?: string };
	} | null;
}

export interface PlayerDraft {
	year: number;
	round: number;
	pick: number;
	/** ESPN id of the team that made the pick (before any draft-night trade) */
	teamEspnId?: string;
}

/** A player's draft from the Core athlete record; null when undrafted */
export function parseCoreDraft(athlete: ApiCoreAthleteResponse): PlayerDraft | null {
	const draft = athlete.draft;
	if (!draft || draft.year === undefined || draft.round === undefined || draft.selection === undefined) {
		return null;
	}
	const teamEspnId = draft.team?.$ref?.match(/\/teams\/(\d+)/)?.[1];
	return {
		year: draft.year,
		round: draft.round,
		pick: draft.selection,
		...(teamEspnId ? { teamEspnId } : {}),
	};
}

/** A roster athlete's bio, as stored on the player record (missing fields left out) */
export function parseRosterPlayer(athlete: ApiRosterAthlete) {
	const years = athlete.experience?.years;
	return {
		espnPlayerId: athlete.id,
		name: athlete.displayName,
		firstName: athlete.firstName ?? undefined,
		lastName: athlete.lastName ?? undefined,
		jersey: athlete.jersey ?? undefined,
		position: athlete.position?.abbreviation ?? undefined,
		headshot: athlete.headshot?.href ?? undefined,
		height: athlete.displayHeight ?? undefined,
		weight: athlete.displayWeight ?? undefined,
		age: athlete.age ?? undefined,
		birthDate: athlete.dateOfBirth?.slice(0, 10),
		experience: years !== undefined && years !== null ? `${years}` : undefined,
		college: athlete.college?.name ?? undefined,
	};
}

export interface ApiTeamScheduleEvent {
	id: string;
	date: string;
	seasonType?: { type?: number };
	competitions?: Array<{
		status?: { type?: { completed?: boolean } };
		competitors?: Array<{
			homeAway?: "home" | "away";
			team?: { id?: string };
			score?: { value?: number };
			winner?: boolean;
		}>;
	}>;
}

export interface ApiTeamScheduleResponse {
	events?: ApiTeamScheduleEvent[];
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

/**
 * A competitor's overall record ("W-L") as of the game. Scoreboard competitors
 * carry it as `records`, summary header competitors as `record`.
 */
export function getTotalRecord(
	competitor:
		| {
				records?: Array<{ type?: string; summary?: string }>;
				record?: Array<{ type?: string; summary?: string }>;
		  }
		| undefined,
): string | undefined {
	const records = competitor?.records ?? competitor?.record;
	return records?.find((r) => r.type === "total")?.summary || undefined;
}

export interface TeamScheduleRecord {
	espnGameId: string;
	homeAway: "home" | "away";
	/** The team's record ("W-L") after this game */
	record: string;
	seasonType?: number;
}

/**
 * Count a team's record as of each finished game on its ESPN schedule. Each
 * season type (Tip-Off Tournament, regular season, ...) keeps its own record,
 * as ESPN reports them.
 */
export function getRecordsFromTeamSchedule(
	espnTeamId: string,
	events: ApiTeamScheduleEvent[],
): TeamScheduleRecord[] {
	const tallies = new Map<number, { wins: number; losses: number }>();
	const records: TeamScheduleRecord[] = [];
	const ordered = [...events].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

	for (const event of ordered) {
		const competition = event.competitions?.[0];
		if (!competition?.status?.type?.completed) continue;
		const team = competition.competitors?.find((c) => c.team?.id === espnTeamId);
		const opponent = competition.competitors?.find((c) => c.team?.id !== espnTeamId);
		if (!team?.homeAway || !opponent) continue;

		const won =
			team.winner ??
			(team.score?.value !== undefined && opponent.score?.value !== undefined
				? team.score.value > opponent.score.value
				: undefined);
		if (won === undefined) continue;

		const seasonType = event.seasonType?.type;
		const tally = tallies.get(seasonType ?? 0) ?? { wins: 0, losses: 0 };
		if (won) tally.wins += 1;
		else tally.losses += 1;
		tallies.set(seasonType ?? 0, tally);

		records.push({
			espnGameId: event.id,
			homeAway: team.homeAway,
			record: `${tally.wins}-${tally.losses}`,
			seasonType,
		});
	}

	return records;
}

/** Helper to get a stat value from standings entry stats array */
export function getStandingStat(stats: Array<{ name: string; value: number }>, name: string): number {
	return stats.find((s) => s.name === name)?.value ?? 0;
}

/** Helper to get a stat display value from standings entry stats array */
export function getStandingStatDisplay(stats: Array<{ name: string; value: number; displayValue?: string }>, name: string): string {
	return stats.find((s) => s.name === name)?.displayValue ?? "";
}

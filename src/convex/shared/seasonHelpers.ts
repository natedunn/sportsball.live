// Season detection, date formatting, and shared utilities for Convex functions

/**
 * ESPN and all major US sports leagues organize game dates by US Eastern Time.
 * A game at 10 PM ET on Feb 9 has a UTC time of 3 AM Feb 10, so we must
 * use ET (not UTC) when computing date strings.
 */
const GAME_TIMEZONE = "America/New_York";
type League = "nba" | "wnba" | "gleague";

/**
 * Extract year, month (1-indexed), and day from a Date in the given timezone.
 * Uses Intl.DateTimeFormat.formatToParts() — no external dependencies.
 */
export function getDatePartsInTimezone(
	date: Date,
	timezone: string,
): { year: number; month: number; day: number } {
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const parts = formatter.formatToParts(date);
	const get = (type: string) =>
		parseInt(parts.find((p) => p.type === type)!.value, 10);
	return { year: get("year"), month: get("month"), day: get("day") };
}

export function getSeasonStartYear(season: string): number {
	const firstYear = Number.parseInt(season.split("-")[0] ?? "", 10);
	if (Number.isFinite(firstYear)) return firstYear;
	return getDatePartsInTimezone(new Date(), GAME_TIMEZONE).year;
}

export function getSeasonEndYear(season: string): number {
	const startYear = getSeasonStartYear(season);
	const rawEndYear = season.split("-")[1];
	if (!rawEndYear) return startYear;

	const parsedEndYear = Number.parseInt(rawEndYear, 10);
	if (!Number.isFinite(parsedEndYear)) return startYear;
	if (parsedEndYear >= 100) return parsedEndYear;

	const century = Math.floor(startYear / 100) * 100;
	let endYear = century + parsedEndYear;
	if (endYear < startYear) endYear += 100;
	return endYear;
}

export function getCompetitionYear(league: League, season: string): number {
	switch (league) {
		case "nba":
		case "wnba":
		case "gleague":
			return getSeasonEndYear(season);
	}
}

/** ESPN `season.type` values found on scoreboard events and summary headers. */
export const ESPN_SEASON_TYPE = {
	preseason: 1,
	regular: 2,
	postseason: 3,
	// NBA play-in tournament; G-League Showdown Cup
	special: 5,
} as const;

type StatGame = { eventStatus?: string; seasonType?: number; competitionType?: string };

/**
 * Whether a game counts toward season averages: finished regular-season games
 * (ESPN season type 2) only, as ESPN and the leagues report them. ESPN also
 * files Cup championships ("CC") and All-Star games under type 2; neither
 * counts. Games with no season type don't count.
 */
export function countsTowardSeasonAverages<T extends StatGame>(game: T | null | undefined): game is T {
	return (
		game?.eventStatus === "completed" &&
		game.seasonType === ESPN_SEASON_TYPE.regular &&
		game.competitionType !== "CC" &&
		game.competitionType !== "ALLSTAR"
	);
}

/**
 * Whether a game belongs in game logs, trends and recent-form splits: every
 * finished game a team really played (regular season, play-in, playoffs, Cup
 * championships), but not preseason or All-Star games.
 */
export function countsTowardGameLog<T extends StatGame>(game: T | null | undefined): game is T {
	return (
		game?.eventStatus === "completed" &&
		(game.seasonType === ESPN_SEASON_TYPE.regular ||
			game.seasonType === ESPN_SEASON_TYPE.postseason ||
			game.seasonType === ESPN_SEASON_TYPE.special) &&
		game.competitionType !== "ALLSTAR"
	);
}

/**
 * Convert ESPN's season year (the year the season ends, e.g. 2027 for 2026-27)
 * into our season string: "2026-27" for NBA/G-League, "2026" for WNBA.
 */
export function seasonFromEspnYear(league: League, year: number): string {
	if (league === "wnba") return String(year);
	return `${year - 1}-${String(year).slice(-2)}`;
}

/** The season after this one: "2026-27" after "2025-26", "2027" after "2026" (WNBA). */
export function getNextSeason(league: League, season: string): string {
	return seasonFromEspnYear(league, getSeasonEndYear(season) + 1);
}

/**
 * Read the season string and season type ESPN attaches to an event
 * (`event.season` on the scoreboard, `header.season` on the summary).
 * Returns undefined fields when ESPN omits them so callers can fall back.
 */
export function parseEspnSeason(
	league: League,
	espnSeason: { year?: number; type?: number } | undefined,
): { season?: string; seasonType?: number } {
	const year = espnSeason?.year;
	return {
		season: typeof year === "number" && Number.isFinite(year) ? seasonFromEspnYear(league, year) : undefined,
		seasonType: typeof espnSeason?.type === "number" ? espnSeason.type : undefined,
	};
}

/** Compare season strings by start year ("2026-27" > "2025-26", "2026" > "2025"). */
export function compareSeasons(a: string, b: string): number {
	return getSeasonStartYear(a) - getSeasonStartYear(b);
}

/**
 * Get today's date in YYYYMMDD format (US Eastern Time).
 */
export function getTodayDate(): string {
	const { year, month, day } = getDatePartsInTimezone(
		new Date(),
		GAME_TIMEZONE,
	);
	return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

/**
 * Format a Date or timestamp to YYYYMMDD string (US Eastern Time).
 */
export function formatGameDate(date: Date | number): string {
	const d = typeof date === "number" ? new Date(date) : date;
	const { year, month, day } = getDatePartsInTimezone(d, GAME_TIMEZONE);
	return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

/**
 * Map API provider game status state to our eventStatus enum.
 */
export function mapApiStateToEventStatus(
	state: string | undefined,
	detail?: string,
): "scheduled" | "in_progress" | "halftime" | "end_of_period" | "overtime" | "completed" | "postponed" | "cancelled" {
	if (!state) return "scheduled";

	switch (state) {
		case "pre":
			return "scheduled";
		case "in": {
			const detailLower = detail?.toLowerCase() ?? "";
			if (detailLower.includes("halftime")) return "halftime";
			if (detailLower.includes("end of")) return "end_of_period";
			if (detailLower.includes("overtime") || detailLower.includes(" ot")) return "overtime";
			return "in_progress";
		}
		case "post": {
			// ESPN reports postponed and canceled games as "post" too, with an
			// all-zero box score
			const detailLower = detail?.toLowerCase() ?? "";
			if (detailLower.includes("postponed")) return "postponed";
			if (detailLower.includes("canceled") || detailLower.includes("cancelled")) return "cancelled";
			return "completed";
		}
		default:
			if (state === "postponed") return "postponed";
			if (state === "cancelled") return "cancelled";
			return "scheduled";
	}
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate YYYYMMDD date strings from startDate to endDate (inclusive).
 */
export function getDateRange(startDate: string, endDate: string): string[] {
	const dates: string[] = [];
	const start = new Date(
		parseInt(startDate.slice(0, 4), 10),
		parseInt(startDate.slice(4, 6), 10) - 1,
		parseInt(startDate.slice(6, 8), 10),
	);
	const end = new Date(
		parseInt(endDate.slice(0, 4), 10),
		parseInt(endDate.slice(4, 6), 10) - 1,
		parseInt(endDate.slice(6, 8), 10),
	);

	for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const dd = String(d.getDate()).padStart(2, "0");
		dates.push(`${yyyy}${mm}${dd}`);
	}

	return dates;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEDULE_MIN_DAYS_AHEAD = 7;
// ESPN revises box scores for a day or two after the final
const SCHEDULE_RESYNC_DAYS_BACK = 3;

/**
 * Dates (YYYYMMDD, US Eastern) the daily schedule sync covers: from three days
 * back, so recent finals pick up their settled records and ESPN's box score
 * corrections, through the current
 * season's last day. Once that season is over, it runs through the latest
 * scheduled season instead (the next one, once ESPN publishes it). Always at
 * least a week ahead, so a season ESPN hasn't published yet still shows up.
 */
export function getScheduleSyncRange(
	{
		seasonEndDate,
		latestScheduledEndDate,
	}: { seasonEndDate: string | null; latestScheduledEndDate: string | null },
	now: number = Date.now(),
): { startDate: string; endDate: string } {
	const startDate = formatGameDate(now - SCHEDULE_RESYNC_DAYS_BACK * DAY_MS);
	const today = formatGameDate(now);
	const seasonEnd =
		seasonEndDate !== null && seasonEndDate >= today ? seasonEndDate : latestScheduledEndDate;
	const minEndDate = formatGameDate(now + SCHEDULE_MIN_DAYS_AHEAD * DAY_MS);
	return {
		startDate,
		endDate: seasonEnd !== null && seasonEnd > minEndDate ? seasonEnd : minEndDate,
	};
}

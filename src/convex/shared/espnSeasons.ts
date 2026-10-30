// Map ESPN's season calendar onto rows of the seasons table
import {
	getDatePartsInTimezone,
	getSeasonEndYear,
	getSeasonStartYear,
	seasonFromEspnYear,
} from "./seasonHelpers";

type League = "nba" | "wnba" | "gleague";

export type SeasonPhaseType =
	| "tournament"
	| "pre-season"
	| "regular-season"
	| "play-in"
	| "playoffs";

/** One season type from ESPN's core API (`/seasons/{year}/types/{n}`). */
export interface EspnSeasonType {
	type: number;
	name?: string;
	startDate?: string;
	endDate?: string;
}

export interface SeasonPhase {
	league: League;
	startYear: number;
	endYear: number;
	name: string;
	type: SeasonPhaseType;
	startDate: string;
	endDate: string;
	status: "confirmed" | "estimated";
}

/**
 * ESPN puts phase boundaries at midnight Pacific (07:00Z, or 08:00Z in
 * winter), and ends a phase one minute before the next one starts. Reading
 * them as Pacific dates gives each phase's first and last day.
 */
export function espnBoundaryDate(iso: string): string {
	const { year, month, day } = getDatePartsInTimezone(new Date(iso), "America/Los_Angeles");
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function phaseFor(type: EspnSeasonType): { type: SeasonPhaseType; name: string } | null {
	switch (type.type) {
		case 1:
			return { type: "pre-season", name: "Preseason" };
		case 2:
			return { type: "regular-season", name: "Regular season" };
		case 3:
			return { type: "playoffs", name: "Playoffs" };
		case 5:
			// NBA Play-In; G-League Tip-Off Tournament
			return /play-?in/i.test(type.name ?? "")
				? { type: "play-in", name: "Play-In Tournament" }
				: { type: "tournament", name: type.name || "Tournament" };
		default:
			// 4 is the offseason, the gap between seasons
			return null;
	}
}

/**
 * Season phases for one ESPN season year. `gameDays` is the scoreboard's
 * calendar of dates with games. A phase is confirmed once ESPN has games in
 * it. Preseason starts on its first game (ESPN's starts when its season
 * rolls over) and is left out when it has none, as in the G-League.
 */
export function buildSeasonPhases(
	league: League,
	espnYear: number,
	types: EspnSeasonType[],
	gameDays: string[],
): SeasonPhase[] {
	const season = seasonFromEspnYear(league, espnYear);
	const startYear = getSeasonStartYear(season);
	const endYear = getSeasonEndYear(season);
	const days = gameDays.map(espnBoundaryDate).sort();
	const phases: SeasonPhase[] = [];

	for (const type of types) {
		const phase = phaseFor(type);
		if (!phase || !type.startDate || !type.endDate) continue;

		let startDate = espnBoundaryDate(type.startDate);
		const endDate = espnBoundaryDate(type.endDate);
		const phaseDays = days.filter((day) => day >= startDate && day <= endDate);

		if (phase.type === "pre-season") {
			if (phaseDays.length === 0) continue;
			startDate = phaseDays[0];
		}
		if (endDate < startDate) continue;

		phases.push({
			league,
			startYear,
			endYear,
			name: phase.name,
			type: phase.type,
			startDate,
			endDate,
			status: phaseDays.length > 0 ? "confirmed" : "estimated",
		});
	}

	return phases;
}

import type { Doc } from "@convex/_generated/dataModel";

export type SeasonSchedule = Doc<"seasons">;

export type SeasonPhase =
	| "tournament"
	| "preseason"
	| "regular"
	| "play-in"
	| "playoffs"
	| "offseason"
	| null;

/** A date as YYYY-MM-DD in US Eastern, the timezone season and game dates use. */
function toEasternIsoDate(date: Date): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/New_York",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

export function getSeasonPhase(date: Date, season: SeasonSchedule): SeasonPhase {
	const dateStr = toEasternIsoDate(date);
	if (dateStr < season.startDate || dateStr > season.endDate) return null;

	switch (season.type) {
		case "tournament":
			return "tournament";
		case "pre-season":
			return "preseason";
		case "regular-season":
			return "regular";
		case "play-in":
			return "play-in";
		case "playoffs":
			return "playoffs";
	}
}

export function getCurrentSeason(seasons: SeasonSchedule[], date = new Date()) {
	const dateStr = toEasternIsoDate(date);
	const sorted = [...seasons].sort((a, b) => a.startDate.localeCompare(b.startDate));

	const active = sorted.find((season) => dateStr >= season.startDate && dateStr <= season.endDate);
	if (active) return active;

	const mostRecentPast = [...sorted].reverse().find((season) => dateStr >= season.startDate);
	if (mostRecentPast) return mostRecentPast;

	return sorted[0] ?? null;
}

export function getCurrentRegularSeason(
	seasons: SeasonSchedule[],
	date = new Date(),
) {
	const current = getCurrentSeason(seasons, date);
	if (!current) return null;
	return (
		seasons.find(
			(season) =>
				season.startYear === current.startYear &&
				season.endYear === current.endYear &&
				season.type === "regular-season",
		) ?? null
	);
}

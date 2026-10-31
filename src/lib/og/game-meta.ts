import type { League } from "@/lib/shared/league";

// Who and when for a game's page tags and social card. No score or status:
// chat apps keep a link's preview long after the final buzzer.

export interface GameMeta {
	awayTeamId: string;
	homeTeamId: string;
	scheduledStart: number;
	season: string;
	seasonType?: number;
	venue?: string;
}

interface GameDoc {
	scheduledStart: number;
	season: string;
	seasonType?: number;
	venue?: string;
}

/** From getGameDetails: ESPN team ids plus the schedule fields */
export function toGameMeta(
	details:
		| {
				game: GameDoc;
				homeTeam: { espnTeamId: string } | null;
				awayTeam: { espnTeamId: string } | null;
		  }
		| null
		| undefined,
): GameMeta | undefined {
	if (!details?.homeTeam || !details.awayTeam) return undefined;
	const { game } = details;
	return {
		awayTeamId: details.awayTeam.espnTeamId,
		homeTeamId: details.homeTeam.espnTeamId,
		scheduledStart: game.scheduledStart,
		season: game.season,
		seasonType: game.seasonType,
		venue: game.venue,
	};
}

// Eastern time, as the leagues list their schedules; the server has no
// reader's time zone to go by
const TIME_ZONE = "America/New_York";

/** "Friday, October 30, 2026" */
export function formatGameDate(scheduledStart: number) {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: TIME_ZONE,
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	}).format(scheduledStart);
}

/** "Oct 30, 2026" */
export function formatShortGameDate(scheduledStart: number) {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: TIME_ZONE,
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(scheduledStart);
}

/** "7:30 PM ET" */
export function formatGameTime(scheduledStart: number) {
	const time = new Intl.DateTimeFormat("en-US", {
		timeZone: TIME_ZONE,
		hour: "numeric",
		minute: "2-digit",
	}).format(scheduledStart);
	return `${time} ET`;
}

/** ESPN season types: 1 preseason, 2 regular season, 3 postseason, 5 NBA play-in */
export function gameStageLabel(league: League, seasonType?: number) {
	if (seasonType === 1) return "Preseason";
	if (seasonType === 3) return "Playoffs";
	if (seasonType === 5 && league === "nba") return "Play-In Tournament";
	return undefined;
}

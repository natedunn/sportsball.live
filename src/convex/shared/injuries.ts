// Pure helpers for the injury report refresh (see injuries.ts)

const MINUTE_MS = 60 * 1000;

// Game-day refreshes, in minutes before tip-off: once statuses firm up, again
// when questionable players are usually decided, and at tip for late scratches
export const PRE_GAME_REFRESH_MINUTES = [50, 25, 0];

// Tip-offs this close together share one set of refreshes (ESPN's report covers
// the whole league), timed from the earliest of them
export const TIP_OFF_GROUP_MS = 15 * MINUTE_MS;

/** ESPN's league-wide injuries endpoint ({SITE_API}/injuries) */
export interface ApiInjuriesResponse {
	status?: string;
	injuries?: Array<{
		id: string;
		displayName?: string;
		injuries?: Array<{
			id: string;
			status?: string;
			date?: string;
			shortComment?: string;
			athlete?: {
				displayName?: string;
				headshot?: { href?: string };
				position?: { abbreviation?: string };
				links?: Array<{ href?: string }>;
			};
			details?: {
				type?: string;
				detail?: string;
				side?: string;
				returnDate?: string;
			};
		}>;
	}>;
}

/**
 * Who sat out a game and the reason ESPN gave, from each team's box score.
 * Long-term injured players aren't on the box score, so they aren't here.
 */
export function parseGameAbsences(
	teams: Array<{
		espnTeamId: string;
		players: Array<{ espnPlayerId: string; didNotPlayReason?: string }>;
	}>,
) {
	return teams.flatMap(({ espnTeamId, players }) =>
		players.flatMap(({ espnPlayerId, didNotPlayReason }) =>
			didNotPlayReason ? [{ espnPlayerId, espnTeamId, reason: didNotPlayReason }] : [],
		),
	);
}

export interface ParsedInjury {
	espnTeamId: string;
	espnInjuryId: string;
	espnPlayerId?: string;
	name: string;
	position?: string;
	headshot?: string;
	status: string;
	description?: string;
	shortComment?: string;
	returnDate?: string;
	reportedAt?: string;
}

/** Every injured player in ESPN's league report, or null if the report failed */
export function parseInjuryReport(response: ApiInjuriesResponse): ParsedInjury[] | null {
	if (response.status !== "success" || !Array.isArray(response.injuries)) return null;

	return response.injuries.flatMap((team) =>
		(team.injuries ?? []).flatMap((injury): ParsedInjury[] => {
			const name = injury.athlete?.displayName;
			if (!name || !injury.status) return [];
			const details = injury.details;
			// "Left Shoulder Surgery"
			const description = [details?.side, details?.type, details?.detail]
				.filter((part) => part && part !== "Not Specified")
				.join(" ");
			const playerLink = injury.athlete?.links?.find((link) => /\/id\/\d+/.test(link.href ?? ""));
			return [
				{
					espnTeamId: team.id,
					espnInjuryId: injury.id,
					espnPlayerId: playerLink?.href?.match(/\/id\/(\d+)/)?.[1],
					name,
					position: injury.athlete?.position?.abbreviation,
					headshot: injury.athlete?.headshot?.href,
					status: injury.status,
					description: description || undefined,
					shortComment: injury.shortComment,
					returnDate: details?.returnDate,
					reportedAt: injury.date,
				},
			];
		}),
	);
}

/**
 * When to refresh the injury report for a day's tip-offs: the pre-game
 * refreshes for each group of nearby tip-offs, skipping times already past.
 */
export function injuryRefreshTimes(tipOffs: number[], now: number): number[] {
	const sorted = [...new Set(tipOffs)].sort((a, b) => a - b);
	const groupStarts: number[] = [];
	for (const tipOff of sorted) {
		const groupStart = groupStarts[groupStarts.length - 1];
		if (groupStart === undefined || tipOff - groupStart > TIP_OFF_GROUP_MS) groupStarts.push(tipOff);
	}
	const times = groupStarts.flatMap((tipOff) =>
		PRE_GAME_REFRESH_MINUTES.map((minutes) => tipOff - minutes * MINUTE_MS),
	);
	return [...new Set(times)].filter((time) => time > now).sort((a, b) => a - b);
}

import { createServerFn } from "@tanstack/react-start";
import type { GameData } from "@/lib/types";
import type { League } from "./league";
import { getLeagueSiteApi } from "./league";
import { getTeamColors, getProxiedLogoUrl } from "./team-utils";
import type { ApiScoreboardResponse } from "./api-types";

// Internal handler that does the actual fetching - shared across all leagues
async function fetchGamesForLeague(
	league: League,
	date: string,
): Promise<GameData[]> {
	const baseUrl = getLeagueSiteApi(league);

	const response = await fetch(`${baseUrl}/scoreboard?dates=${date}`, {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Scoreboard API error: ${response.status}`);
	}

	const apiData = (await response.json()) as ApiScoreboardResponse;

	if (!apiData.events) {
		return [];
	}

	return apiData.events.map((event) => {
		const homeTeam = event.competitions[0].competitors.find(
			(c) => c.homeAway === "home",
		);
		const awayTeam = event.competitions[0].competitors.find(
			(c) => c.homeAway === "away",
		);

		if (!homeTeam || !awayTeam || !event.status || !event.uid) {
			throw new Error("Invalid data from scoreboard API");
		}

		const homeColors = getTeamColors(league, homeTeam.team.uid, homeTeam.team.id);
		const awayColors = getTeamColors(league, awayTeam.team.uid, awayTeam.team.id);

		return {
			id: event.id,
			uid: event.uid,
			state: event.status.type.state,
			time: {
				start: event.competitions[0].startDate,
				detail: event.status.type.detail,
			},
			away: {
				id: awayTeam.team.id,
				uid: awayTeam.team.uid,
				name: awayTeam.team.name,
				score: awayTeam.score,
				logo: getProxiedLogoUrl(league, awayTeam.team.logo, awayTeam.team.id),
				primaryColor: awayTeam.team.color,
				darkColor: awayColors.darkColor,
				lightColor: awayColors.lightColor,
				seasonRecord:
					awayTeam.records?.find((r) => r.type === "total")?.summary ?? "N/A",
			},
			home: {
				id: homeTeam.team.id,
				uid: homeTeam.team.uid,
				name: homeTeam.team.name,
				score: homeTeam.score,
				logo: getProxiedLogoUrl(league, homeTeam.team.logo, homeTeam.team.id),
				primaryColor: homeTeam.team.color,
				darkColor: homeColors.darkColor,
				lightColor: homeColors.lightColor,
				seasonRecord:
					homeTeam.records?.find((r) => r.type === "total")?.summary ?? "N/A",
			},
		};
	});
}

// Create league-specific server functions
// TanStack Start requires each server function to be a separate export
export const fetchNbaGames = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: date }): Promise<GameData[]> => {
		return fetchGamesForLeague("nba", date);
	});

export const fetchWnbaGames = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: date }): Promise<GameData[]> => {
		return fetchGamesForLeague("wnba", date);
	});

export const fetchGLeagueGames = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: date }): Promise<GameData[]> => {
		return fetchGamesForLeague("gleague", date);
	});

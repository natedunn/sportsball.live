import { queryOptions } from "@tanstack/react-query";
import type { GameData } from "@/lib/types";
import { fetchNbaGames, fetchWnbaGames, fetchGLeagueGames } from "./games.server";

// Shared stale time calculation for game queries
export function getStaleTime(date: string): number {
	const today = new Date();
	const todayStr = today.toISOString().slice(0, 10).replace(/-/g, "");

	if (date < todayStr) {
		// Past dates: games are final, cache for 5 minutes
		return 5 * 60 * 1000;
	} else if (date === todayStr) {
		// Today: games might be live, cache for 30 seconds
		return 30 * 1000;
	} else {
		// Future dates: no games yet, cache for 2 minutes
		return 2 * 60 * 1000;
	}
}

// League-specific query options
export const nbaGamesQueryOptions = (date: string) =>
	queryOptions<GameData[]>({
		queryKey: ["nba", "games", date],
		queryFn: () => fetchNbaGames({ data: date }),
		staleTime: getStaleTime(date),
		gcTime: 10 * 60 * 1000,
	});

export const wnbaGamesQueryOptions = (date: string) =>
	queryOptions<GameData[]>({
		queryKey: ["wnba", "games", date],
		queryFn: () => fetchWnbaGames({ data: date }),
		staleTime: getStaleTime(date),
		gcTime: 10 * 60 * 1000,
	});

export const gleagueGamesQueryOptions = (date: string) =>
	queryOptions<GameData[]>({
		queryKey: ["gleague", "games", date],
		queryFn: () => fetchGLeagueGames({ data: date }),
		staleTime: getStaleTime(date),
		gcTime: 10 * 60 * 1000,
	});

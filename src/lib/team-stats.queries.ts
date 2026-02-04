import { convexQuery } from "@convex-dev/react-query";
import { api } from "@convex/_generated/api";
import { queryOptions } from "@tanstack/react-query";

export type League = "nba" | "wnba" | "gleague";

// Get all team stats for a league
export const teamStatsQueryOptions = (league: League) =>
	queryOptions({
		...convexQuery(api.teamStats.getByLeague, { league }),
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

// Get team stats history for trends (weekly snapshots)
export const teamStatsHistoryQueryOptions = (league: League, teamId: string) =>
	queryOptions({
		...convexQuery(api.statsHistory.getTeamStatsHistory, { league, teamId }),
		staleTime: 5 * 60 * 1000, // 5 minutes
		enabled: !!teamId,
	});

// Get team recent games for rolling averages (game-by-game data)
export const teamRecentGamesQueryOptions = (league: League, teamId: string, limit?: number) =>
	queryOptions({
		...convexQuery(api.statsHistory.getTeamRecentGames, { league, teamId, limit }),
		staleTime: 5 * 60 * 1000, // 5 minutes
		enabled: !!teamId,
	});

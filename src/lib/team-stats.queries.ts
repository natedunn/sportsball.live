import { convexQuery } from "@convex-dev/react-query";
import { api } from "@convex/_generated/api";
import { queryOptions } from "@tanstack/react-query";

export type League = "nba" | "wnba" | "gleague";
export type StatType = "offensiveRating" | "defensiveRating" | "netRating" | "pace";

// Get all team stats for a league
export const teamStatsQueryOptions = (league: League) =>
	queryOptions({
		...convexQuery(api.teamStats.getByLeague, { league }),
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

// Get top teams by a specific stat
export const topTeamsQueryOptions = (
	league: League,
	stat: StatType,
	options?: { limit?: number; ascending?: boolean },
) =>
	queryOptions({
		...convexQuery(api.teamStats.getTopTeams, {
			league,
			stat,
			limit: options?.limit,
			ascending: options?.ascending,
		}),
		staleTime: 5 * 60 * 1000,
	});

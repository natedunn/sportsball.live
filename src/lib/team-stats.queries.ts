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

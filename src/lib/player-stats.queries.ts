import { convexQuery } from "@convex-dev/react-query";
import { api } from "@convex/_generated/api";
import { queryOptions } from "@tanstack/react-query";
import type { League } from "@/lib/shared/league";

export type { League };

// Get all player stats for a team
export const playerStatsByTeamQueryOptions = (league: League, teamId: string) =>
	queryOptions({
		...convexQuery(api.playerStats.getByTeam, { league, teamId }),
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

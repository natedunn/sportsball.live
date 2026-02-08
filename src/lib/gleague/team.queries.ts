import { queryOptions } from "@tanstack/react-query";
import { fetchTeamInjuries } from "@/lib/gleague/team.server";

export const teamInjuriesQueryOptions = (teamSlug: string) =>
  queryOptions({
    queryKey: ["gleague", "team", teamSlug, "injuries"],
    queryFn: () => fetchTeamInjuries({ data: teamSlug }),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

import { queryOptions } from "@tanstack/react-query";
import { fetchTeamNews } from "./news.server";
import type { League } from "./league";

export const teamNewsQueryOptions = (league: League, teamSlug: string) =>
  queryOptions({
    queryKey: [league, "team", teamSlug, "news"],
    queryFn: () => fetchTeamNews({ data: { league, teamSlug } }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });

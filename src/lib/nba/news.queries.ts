import { queryOptions } from "@tanstack/react-query";
import { fetchNbaNews } from "./news.server";

export const nbaNewsQueryOptions = () =>
  queryOptions({
    queryKey: ["nba", "news"],
    queryFn: () => fetchNbaNews(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes - news doesn't change frequently
  });

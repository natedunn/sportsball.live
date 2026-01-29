import { queryOptions } from "@tanstack/react-query";
import { fetchGLeagueNews } from "./news.server";

export const gleagueNewsQueryOptions = () =>
  queryOptions({
    queryKey: ["gleague", "news"],
    queryFn: () => fetchGLeagueNews(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes - news doesn't change frequently
  });

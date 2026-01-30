import { queryOptions } from "@tanstack/react-query";
import { fetchTodayGames } from "./today-games.server";

export const todayGamesQueryOptions = () =>
  queryOptions({
    queryKey: ["today-games"],
    queryFn: () => fetchTodayGames(),
    staleTime: 30 * 1000, // 30 seconds - refresh frequently for live scores
    refetchInterval: 30 * 1000,
  });

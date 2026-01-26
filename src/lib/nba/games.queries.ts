import { queryOptions } from "@tanstack/react-query";
import { fetchNbaGames } from "./games.server";

export const nbaGamesQueryOptions = (date: string) =>
  queryOptions({
    queryKey: ["nba", "games", date],
    queryFn: () => fetchNbaGames({ data: date }),
    staleTime: 30 * 1000, // 30 seconds
  });

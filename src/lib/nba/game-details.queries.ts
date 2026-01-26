import { queryOptions } from "@tanstack/react-query";
import { fetchGameDetails } from "./game-details.server";

export const gameDetailsQueryOptions = (gameId: string) =>
  queryOptions({
    queryKey: ["nba", "game", gameId],
    queryFn: () => fetchGameDetails({ data: gameId }),
    staleTime: 30 * 1000, // 30 seconds for live games
  });

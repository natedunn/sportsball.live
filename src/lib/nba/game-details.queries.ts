import { queryOptions } from "@tanstack/react-query";
import { fetchGameDetails } from "./game-details.server";

export const gameDetailsQueryOptions = (gameId: string) =>
  queryOptions({
    queryKey: ["nba", "game", gameId],
    queryFn: () => fetchGameDetails({ data: gameId }),
    staleTime: 15 * 1000,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === "in" ? 15 * 1000 : false;
    },
  });

import { queryOptions } from "@tanstack/react-query";
import { fetchWnbaGameDetails } from "./game-details.server";

export const wnbaGameDetailsQueryOptions = (gameId: string) =>
  queryOptions({
    queryKey: ["wnba", "game", gameId],
    queryFn: () => fetchWnbaGameDetails({ data: gameId }),
    staleTime: 15 * 1000, // 15 seconds - frequent updates for live games
    gcTime: 5 * 60 * 1000, // 5 minutes - shorter retention for live data
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === "in" ? 15 * 1000 : false;
    },
  });

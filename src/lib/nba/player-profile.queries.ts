import { queryOptions } from "@tanstack/react-query";
import { fetchPlayerProfile } from "./player-profile.server";

export const playerProfileQueryOptions = (playerId: string) =>
  queryOptions({
    queryKey: ["nba", "player", playerId],
    queryFn: () => fetchPlayerProfile({ data: playerId }),
    staleTime: 5 * 60 * 1000, // 5 minutes - season stats don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });

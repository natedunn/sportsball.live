import { queryOptions } from "@tanstack/react-query";
import { fetchGLeagueStandings } from "./standings.server";

export const gleagueStandingsQueryOptions = () =>
	queryOptions({
		queryKey: ["gleague", "standings"],
		queryFn: () => fetchGLeagueStandings(),
		staleTime: 5 * 60 * 1000, // 5 minutes - standings update after games complete
		gcTime: 30 * 60 * 1000, // 30 minutes cache
	});

import { queryOptions } from "@tanstack/react-query";
import { fetchNbaStandings } from "./standings.server";

export const nbaStandingsQueryOptions = () =>
	queryOptions({
		queryKey: ["nba", "standings"],
		queryFn: () => fetchNbaStandings(),
		staleTime: 5 * 60 * 1000, // 5 minutes - standings update after games complete
		gcTime: 30 * 60 * 1000, // 30 minutes cache
	});

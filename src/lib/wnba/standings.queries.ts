import { queryOptions } from "@tanstack/react-query";
import { fetchWnbaStandings } from "./standings.server";

export function wnbaStandingsQueryOptions() {
	return queryOptions({
		queryKey: ["wnba", "standings"],
		queryFn: () => fetchWnbaStandings(),
		staleTime: 1000 * 60 * 5, // 5 minutes
	});
}

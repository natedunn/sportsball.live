import { queryOptions } from "@tanstack/react-query";
import {
	fetchNbaLeaders,
	fetchWnbaLeaders,
	fetchGLeagueLeaders,
} from "./leaders.server";

export const nbaLeadersQueryOptions = () =>
	queryOptions({
		queryKey: ["nba", "leaders"],
		queryFn: () => fetchNbaLeaders(),
		staleTime: 10 * 60 * 1000, // 10 minutes
		gcTime: 30 * 60 * 1000,
	});

export const wnbaLeadersQueryOptions = () =>
	queryOptions({
		queryKey: ["wnba", "leaders"],
		queryFn: () => fetchWnbaLeaders(),
		staleTime: 10 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
	});

export const gleagueLeadersQueryOptions = () =>
	queryOptions({
		queryKey: ["gleague", "leaders"],
		queryFn: () => fetchGLeagueLeaders(),
		staleTime: 10 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
	});

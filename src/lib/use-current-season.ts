import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "~api";
import type { League } from "@/lib/shared/league";

export function useCurrentSeasonName(league: League): string | undefined {
	const { data } = useQuery(convexQuery(api.seasons.getCurrentName, { league }));
	return data ?? undefined;
}

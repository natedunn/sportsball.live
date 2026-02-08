import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { getCurrentSeason } from "@/lib/shared/season";
import type { League } from "@/lib/shared/league";
import { AdvancedTeamRankings } from "./advanced-team-rankings";

interface SmartTeamRankingsProps {
	league: League;
}

const season = getCurrentSeason();

function getTeamStatsQuery(league: League): any {
	switch (league) {
		case "nba":
			return convexQuery(api.nba.queries.getAllTeamStats, { season });
		case "wnba":
			return convexQuery(api.wnba.queries.getAllTeamStats, { season });
		case "gleague":
			return convexQuery(api.gleague.queries.getAllTeamStats, { season });
	}
}

/**
 * Component that displays advanced team ratings from Convex.
 * Shows error state if data is unavailable.
 */
export function SmartTeamRankings({ league }: SmartTeamRankingsProps) {
	const { data: advancedStats = [], isLoading, isError } = useQuery(
		getTeamStatsQuery(league),
	) as { data: unknown[] | undefined; isLoading: boolean; isError: boolean };

	if (isLoading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{[1, 2, 3].map((i) => (
					<div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<p className="text-sm text-destructive">
				Error loading team rankings. Please try again later.
			</p>
		);
	}

	if (advancedStats.length === 0) {
		return (
			<p className="text-sm text-destructive">
				No team rankings data available. Stats are updated nightly.
			</p>
		);
	}

	return <AdvancedTeamRankings league={league} />;
}

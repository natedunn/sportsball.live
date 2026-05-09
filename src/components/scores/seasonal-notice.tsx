import { format, parseISO } from "date-fns";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "~api";
import {
	getCurrentSeason,
	getCurrentRegularSeason,
	getSeasonPhase,
	type SeasonPhase,
} from "@/lib/season-schedules";
import type { League } from "@/lib/shared/league";

const LEAGUE_NAMES: Record<League, string> = {
	nba: "NBA",
	wnba: "WNBA",
	gleague: "G League",
};

function formatNoticeDate(dateStr: string): string {
	const date = parseISO(dateStr);
	return format(date, "MMMM d, yyyy");
}

interface SeasonalNoticeProps {
	league: League;
	className?: string;
}

export function SeasonalNotice({ league, className }: SeasonalNoticeProps) {
	const { data: seasons } = useQuery(convexQuery(api.seasons.list, { league }));

	if (!seasons || seasons.length === 0) {
		return null;
	}

	const now = new Date();
	const currentSeason = getCurrentSeason(seasons, now);
	if (!currentSeason) {
		return null;
	}

	let phase: SeasonPhase = getSeasonPhase(now, currentSeason);
	const regularSeason = getCurrentRegularSeason(seasons, now);
	const nextSegment = [...seasons]
		.filter((season) => season.startDate > currentSeason.endDate)
		.sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

	if (!phase && nextSegment) {
		phase = "offseason";
	}

	if (phase !== "offseason" && phase !== "preseason") {
		return null;
	}

	const leagueName = LEAGUE_NAMES[league];

	if (phase === "offseason" && nextSegment) {
		return (
			<div
				className={`rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 ${className ?? ""}`}
			>
				The {leagueName} is currently in the offseason so there might not be too
				much data here until the next scheduled segment starts on{" "}
				{formatNoticeDate(nextSegment.startDate)}.
			</div>
		);
	}

	if (phase === "preseason" && regularSeason) {
		return (
			<div
				className={`rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-400 ${className ?? ""}`}
			>
				The {leagueName}'s preseason is here! Expect sporadic data since games
				can be inconsistent until the start of the season on{" "}
				{formatNoticeDate(regularSeason.startDate)}.
			</div>
		);
	}

	return null;
}

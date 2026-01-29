import { format, parseISO } from "date-fns";
import {
  type League,
  SEASONS,
  getSeasonPhase,
  type SeasonPhase,
} from "@/lib/seasons";

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
  const seasons = SEASONS[league];
  const now = new Date();

  // Check current season phase
  let phase: SeasonPhase = getSeasonPhase(now, seasons.current);

  // If not in current season, check past season
  if (!phase && seasons.past) {
    phase = getSeasonPhase(now, seasons.past);
  }

  // Only show notice for offseason or preseason
  if (phase !== "offseason" && phase !== "preseason") {
    return null;
  }

  const leagueName = LEAGUE_NAMES[league];
  const currentSeason = seasons.current;

  if (phase === "offseason") {
    return (
      <div
        className={`rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 ${className ?? ""}`}
      >
        The {leagueName} is currently in the offseason so there might not be too
        much data here until the estimated tip off of the preseason on{" "}
        {formatNoticeDate(currentSeason.preSeasonStart)}.
      </div>
    );
  }

  if (phase === "preseason") {
    return (
      <div
        className={`rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-400 ${className ?? ""}`}
      >
        The {leagueName}'s preseason is here! Expect sporadic data since games
        can be inconsistent until the start of the season on{" "}
        {formatNoticeDate(currentSeason.regularSeasonStart)}.
      </div>
    );
  }

  return null;
}

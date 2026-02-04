/**
 * Hardcoded season dates for each league
 * Last updated: January 28, 2026
 */

export type League = "nba" | "wnba" | "gleague";

export interface Season {
  name: string;
  preSeasonStart: string;
  preSeasonEnd: string;
  regularSeasonStart: string;
  regularSeasonEnd: string;
  playoffStart: string;
  playoffEnd: string;
  offSeasonStart: string;
}

export interface LeagueSeasons {
  current: Season;
  upcoming?: Season;
  past?: Season;
}

export const SEASONS: Record<League, LeagueSeasons> = {
  nba: {
    current: {
      name: "2025-26",
      preSeasonStart: "2025-10-02",
      preSeasonEnd: "2025-10-17",
      regularSeasonStart: "2025-10-21",
      regularSeasonEnd: "2026-04-12",
      playoffStart: "2026-04-14", // Play-in tournament
      playoffEnd: "2026-06-19", // Finals Game 7
      offSeasonStart: "2026-06-20",
    },
  },
  wnba: {
    past: {
      name: "2025",
      preSeasonStart: "2025-05-02",
      preSeasonEnd: "2025-05-12",
      regularSeasonStart: "2025-05-16",
      regularSeasonEnd: "2025-09-11",
      playoffStart: "2025-09-14",
      playoffEnd: "2025-10-10", // Aces won championship
      offSeasonStart: "2025-10-11",
    },
    current: {
      name: "2026",
      preSeasonStart: "2026-04-24", // Estimated ~2 weeks before regular season
      preSeasonEnd: "2026-05-04",
      regularSeasonStart: "2026-05-08",
      regularSeasonEnd: "2026-09-24",
      playoffStart: "2026-09-27", // Estimated
      playoffEnd: "2026-10-15", // Estimated
      offSeasonStart: "2026-10-16",
    },
  },
  gleague: {
    current: {
      name: "2025-26",
      preSeasonStart: "2025-10-27", // Training camp
      preSeasonEnd: "2025-11-06",
      regularSeasonStart: "2025-11-07", // Tip-off tournament
      regularSeasonEnd: "2026-03-28",
      playoffStart: "2026-03-31",
      playoffEnd: "2026-04-15", // Finals estimated
      offSeasonStart: "2026-04-16",
    },
  },
};

/**
 * Get the current active season for a league
 */
export function getCurrentSeason(league: League): Season {
  return SEASONS[league].current;
}

/**
 * Determine what phase of the season a date falls into
 */
export type SeasonPhase =
  | "preseason"
  | "regular"
  | "playoffs"
  | "offseason"
  | null;

export function getSeasonPhase(date: Date, season: Season): SeasonPhase {
  const dateStr = date.toISOString().split("T")[0];

  if (dateStr >= season.preSeasonStart && dateStr <= season.preSeasonEnd) {
    return "preseason";
  }
  if (dateStr >= season.regularSeasonStart && dateStr <= season.regularSeasonEnd) {
    return "regular";
  }
  if (dateStr >= season.playoffStart && dateStr <= season.playoffEnd) {
    return "playoffs";
  }
  if (dateStr >= season.offSeasonStart) {
    return "offseason";
  }
  return null;
}

/**
 * Check if a league is currently in active play (preseason, regular, or playoffs)
 */
export function isLeagueInSeason(league: League, date: Date = new Date()): boolean {
  const seasons = SEASONS[league];
  const dateStr = date.toISOString().split("T")[0];

  // Check current season
  const current = seasons.current;
  if (dateStr >= current.preSeasonStart && dateStr <= current.playoffEnd) {
    return true;
  }

  // Check past season if it exists
  if (seasons.past) {
    const past = seasons.past;
    if (dateStr >= past.preSeasonStart && dateStr <= past.playoffEnd) {
      return true;
    }
  }

  return false;
}

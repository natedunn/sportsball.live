import { createServerFn } from "@tanstack/react-start";

export interface PlayerSeasonStats {
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  fieldGoalPct: number;
}

export interface PlayerProfile {
  id: string;
  name: string;
  jersey: string;
  position: string;
  height: string;
  weight: string;
  age: number | null;
  college: string | null;
  experience: string | null;
  headshot: string | null;
  seasonStats: PlayerSeasonStats | null;
}

interface ApiStatistic {
  name: string;
  value: number;
  displayValue: string;
}

interface ApiAthlete {
  id: string;
  displayName?: string;
  jersey?: string;
  displayJersey?: string;
  position?: {
    abbreviation?: string;
  };
  displayHeight?: string;
  displayWeight?: string;
  age?: number;
  college?: {
    name?: string;
    mascot?: string;
  };
  displayExperience?: string;
  headshot?: {
    href?: string;
  };
  statsSummary?: {
    statistics?: ApiStatistic[];
  };
}

interface ApiResponse {
  athlete?: ApiAthlete;
}

function extractSeasonStats(athlete: ApiAthlete): PlayerSeasonStats | null {
  const statistics = athlete.statsSummary?.statistics;
  if (!statistics || statistics.length === 0) return null;

  const statsMap: Record<string, number> = {};
  for (const stat of statistics) {
    statsMap[stat.name] = stat.value;
  }

  // Check if we have at least points
  if (statsMap.avgPoints === undefined) return null;

  return {
    pointsPerGame: statsMap.avgPoints ?? 0,
    reboundsPerGame: statsMap.avgRebounds ?? 0,
    assistsPerGame: statsMap.avgAssists ?? 0,
    fieldGoalPct: statsMap.fieldGoalPct ?? 0,
  };
}

export const fetchPlayerProfile = createServerFn({ method: "GET" })
  .inputValidator((d: string) => d)
  .handler(async ({ data: playerId }): Promise<PlayerProfile | null> => {
    const baseUrl = process.env.NBA_PLAYER_API_BASE;
    if (!baseUrl) {
      console.warn("NBA_PLAYER_API_BASE not configured");
      return null;
    }

    try {
      const response = await fetch(`${baseUrl}/${playerId}`, {
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        return null;
      }

      const apiData = (await response.json()) as ApiResponse;
      const athlete = apiData.athlete;

      if (!athlete) {
        return null;
      }

      return {
        id: athlete.id,
        name: athlete.displayName ?? "",
        jersey: athlete.displayJersey ?? athlete.jersey ?? "",
        position: athlete.position?.abbreviation ?? "",
        height: athlete.displayHeight ?? "",
        weight: athlete.displayWeight ?? "",
        age: athlete.age ?? null,
        college: athlete.college?.name ?? null,
        experience: athlete.displayExperience ?? null,
        headshot: athlete.headshot?.href ?? null,
        seasonStats: extractSeasonStats(athlete),
      };
    } catch {
      return null;
    }
  });

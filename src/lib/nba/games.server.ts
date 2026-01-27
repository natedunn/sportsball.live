import { createServerFn } from "@tanstack/react-start";
import type { GameData } from "@/lib/types";
import { getTeamColors, getProxiedLogoUrl } from "./team-utils.server";

interface ApiCompetitor {
  homeAway: "home" | "away";
  team: {
    id: string;
    uid?: string;
    name?: string;
    logo?: string;
    color?: string;
  };
  score: string;
  records?: Array<{ type?: string; summary?: string }>;
}

interface ApiEvent {
  id: string;
  uid: string;
  status?: {
    type: {
      state: "pre" | "in" | "post";
      detail?: string;
    };
  };
  competitions: Array<{
    startDate?: string;
    competitors: ApiCompetitor[];
  }>;
}

interface ApiResponse {
  events?: ApiEvent[];
}

export const fetchNbaGames = createServerFn({ method: "GET" })
  .inputValidator((d: string) => d)
  .handler(async ({ data: date }): Promise<GameData[]> => {
    const baseUrl = process.env.NBA_API_BASE;
    if (!baseUrl) {
      throw new Error("NBA_API_BASE not configured");
    }

    const response = await fetch(`${baseUrl}/scoreboard?dates=${date}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Scoreboard API error: ${response.status}`);
    }

    const apiData = (await response.json()) as ApiResponse;

    if (!apiData.events) {
      return [];
    }

    return apiData.events.map((event) => {
      const homeTeam = event.competitions[0].competitors.find(
        (c) => c.homeAway === "home"
      );
      const awayTeam = event.competitions[0].competitors.find(
        (c) => c.homeAway === "away"
      );

      if (!homeTeam || !awayTeam || !event.status || !event.uid) {
        throw new Error("Invalid data from scoreboard API");
      }

      const homeColors = getTeamColors(homeTeam.team.uid);
      const awayColors = getTeamColors(awayTeam.team.uid);

      return {
        id: event.id,
        uid: event.uid,
        state: event.status.type.state,
        time: {
          start: event.competitions[0].startDate,
          detail: event.status.type.detail,
        },
        away: {
          id: awayTeam.team.id,
          uid: awayTeam.team.uid,
          name: awayTeam.team.name,
          score: awayTeam.score,
          logo: getProxiedLogoUrl(awayTeam.team.logo),
          primaryColor: awayTeam.team.color,
          darkColor: awayColors.darkColor,
          lightColor: awayColors.lightColor,
          seasonRecord:
            awayTeam.records?.find((r) => r.type === "total")?.summary ?? "N/A",
        },
        home: {
          id: homeTeam.team.id,
          uid: homeTeam.team.uid,
          name: homeTeam.team.name,
          score: homeTeam.score,
          logo: getProxiedLogoUrl(homeTeam.team.logo),
          primaryColor: homeTeam.team.color,
          darkColor: homeColors.darkColor,
          lightColor: homeColors.lightColor,
          seasonRecord:
            homeTeam.records?.find((r) => r.type === "total")?.summary ?? "N/A",
        },
      };
    });
  });

import { createServerFn } from "@tanstack/react-start";
import type { GameData } from "@/lib/types";
import { getTeamSlugFromLogoUrl, NBA_TEAM_LOGOS } from "./team-logos";

// Team data for colors
const nbaTeamsConfig = [
  { teamId: "s:40~l:46~t:1", darkColor: "c8102e", lightColor: "c8102e" },
  { teamId: "s:40~l:46~t:2", darkColor: "008348", lightColor: "008348" },
  { teamId: "s:40~l:46~t:17", darkColor: "FFFFFF", lightColor: "000000" },
  { teamId: "s:40~l:46~t:30", darkColor: "008ca8", lightColor: "008ca8" },
  { teamId: "s:40~l:46~t:4", darkColor: "ce1141", lightColor: "ce1141" },
  { teamId: "s:40~l:46~t:5", darkColor: "FDBB30", lightColor: "860038" },
  { teamId: "s:40~l:46~t:6", darkColor: "0064b1", lightColor: "0064b1" },
  { teamId: "s:40~l:46~t:7", darkColor: "FEC524", lightColor: "0E2240" },
  { teamId: "s:40~l:46~t:8", darkColor: "C8102E", lightColor: "1d42ba" },
  { teamId: "s:40~l:46~t:9", darkColor: "fdb927", lightColor: "fdb927" },
  { teamId: "s:40~l:46~t:10", darkColor: "ce1141", lightColor: "ce1141" },
  { teamId: "s:40~l:46~t:11", darkColor: "FDBB30", lightColor: "002D62" },
  { teamId: "s:40~l:46~t:12", darkColor: "BEC0C2", lightColor: "1d428a" },
  { teamId: "s:40~l:46~t:13", darkColor: "FDB927", lightColor: "552583" },
  { teamId: "s:40~l:46~t:29", darkColor: "5d76a9", lightColor: "5d76a9" },
  { teamId: "s:40~l:46~t:14", darkColor: "98002e", lightColor: "98002e" },
  { teamId: "s:40~l:46~t:15", darkColor: "EEE1C6", lightColor: "00471b" },
  { teamId: "s:40~l:46~t:16", darkColor: "266092", lightColor: "266092" },
  { teamId: "s:40~l:46~t:3", darkColor: "85714D", lightColor: "0C2340" },
  { teamId: "s:40~l:46~t:18", darkColor: "F58426", lightColor: "006BB6" },
  { teamId: "s:40~l:46~t:25", darkColor: "007ac1", lightColor: "007ac1" },
  { teamId: "s:40~l:46~t:19", darkColor: "0077c0", lightColor: "0077c0" },
  { teamId: "s:40~l:46~t:20", darkColor: "006bb6", lightColor: "1d428a" },
  { teamId: "s:40~l:46~t:21", darkColor: "e56020", lightColor: "1d1160" },
  { teamId: "s:40~l:46~t:22", darkColor: "e03a3e", lightColor: "e03a3e" },
  { teamId: "s:40~l:46~t:23", darkColor: "63727A", lightColor: "5a2d81" },
  { teamId: "s:40~l:46~t:24", darkColor: "c4ced4", lightColor: "000000" },
  { teamId: "s:40~l:46~t:28", darkColor: "d91244", lightColor: "d91244" },
  { teamId: "s:40~l:46~t:26", darkColor: "FFFFFF", lightColor: "002B5C" },
  { teamId: "s:40~l:46~t:27", darkColor: "e31837", lightColor: "e31837" },
];

function getTeamColors(teamUid: string | undefined) {
  const team = nbaTeamsConfig.find((t) => t.teamId === teamUid);
  return {
    darkColor: team?.darkColor ?? "000000",
    lightColor: team?.lightColor ?? "000000",
  };
}

function getProxiedLogoUrl(logoUrl: string | undefined): string | undefined {
  if (!logoUrl) return undefined;
  const slug = getTeamSlugFromLogoUrl(logoUrl);
  if (slug) {
    return `/api/nba/logo/${slug}`;
  }
  return undefined;
}

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

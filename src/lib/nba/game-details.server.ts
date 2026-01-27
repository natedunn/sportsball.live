import { createServerFn } from "@tanstack/react-start";
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

function getProxiedLogoUrl(espnLogoUrl: string | undefined): string | undefined {
  if (!espnLogoUrl) return undefined;
  const slug = getTeamSlugFromLogoUrl(espnLogoUrl);
  if (slug && NBA_TEAM_LOGOS[slug]) {
    return `/api/nba/logo/${slug}`;
  }
  return espnLogoUrl;
}

export interface TeamStats {
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalPct: number;
  threePointMade: number;
  threePointAttempted: number;
  threePointPct: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  freeThrowPct: number;
  totalRebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  pointsInPaint: number;
  fastBreakPoints: number;
  largestLead: number;
}

export interface GameDetailsTeam {
  id: string;
  uid: string | undefined;
  name: string | undefined;
  abbreviation: string | undefined;
  score: number;
  logo: string | undefined;
  darkColor: string;
  lightColor: string;
  winner: boolean;
  stats: TeamStats;
}

export interface GameDetails {
  id: string;
  state: "pre" | "in" | "post";
  statusDetail: string | undefined;
  venue: string | undefined;
  date: string | undefined;
  away: GameDetailsTeam;
  home: GameDetailsTeam;
}

interface ApiStat {
  name: string;
  displayValue: string;
}

interface ApiTeam {
  team: {
    id: string;
    uid?: string;
    name?: string;
    abbreviation?: string;
    logo?: string;
  };
  score: string;
  winner?: boolean;
  statistics?: ApiStat[];
}

interface ApiBoxscore {
  teams?: ApiTeam[];
}

interface ApiHeader {
  competitions?: Array<{
    status?: {
      type?: {
        state?: "pre" | "in" | "post";
        detail?: string;
      };
    };
    venue?: {
      fullName?: string;
    };
    date?: string;
  }>;
}

interface ApiResponse {
  boxscore?: ApiBoxscore;
  header?: ApiHeader;
}

function parseStatValue(stats: ApiStat[] | undefined, name: string): number {
  const stat = stats?.find((s) => s.name === name);
  if (!stat) return 0;

  // Handle combined stats like "43-93"
  if (stat.displayValue.includes("-")) {
    const [made] = stat.displayValue.split("-");
    return parseInt(made, 10) || 0;
  }

  return parseFloat(stat.displayValue) || 0;
}

function parseStatParts(stats: ApiStat[] | undefined, name: string): [number, number] {
  const stat = stats?.find((s) => s.name === name);
  if (!stat || !stat.displayValue.includes("-")) return [0, 0];

  const [made, attempted] = stat.displayValue.split("-");
  return [parseInt(made, 10) || 0, parseInt(attempted, 10) || 0];
}

function extractTeamStats(stats: ApiStat[] | undefined): TeamStats {
  const [fgMade, fgAttempted] = parseStatParts(stats, "fieldGoalsMade-fieldGoalsAttempted");
  const [threeMade, threeAttempted] = parseStatParts(stats, "threePointFieldGoalsMade-threePointFieldGoalsAttempted");
  const [ftMade, ftAttempted] = parseStatParts(stats, "freeThrowsMade-freeThrowsAttempted");

  return {
    fieldGoalsMade: fgMade,
    fieldGoalsAttempted: fgAttempted,
    fieldGoalPct: parseStatValue(stats, "fieldGoalPct"),
    threePointMade: threeMade,
    threePointAttempted: threeAttempted,
    threePointPct: parseStatValue(stats, "threePointFieldGoalPct"),
    freeThrowsMade: ftMade,
    freeThrowsAttempted: ftAttempted,
    freeThrowPct: parseStatValue(stats, "freeThrowPct"),
    totalRebounds: parseStatValue(stats, "totalRebounds"),
    offensiveRebounds: parseStatValue(stats, "offensiveRebounds"),
    defensiveRebounds: parseStatValue(stats, "defensiveRebounds"),
    assists: parseStatValue(stats, "assists"),
    steals: parseStatValue(stats, "steals"),
    blocks: parseStatValue(stats, "blocks"),
    turnovers: parseStatValue(stats, "turnovers") || parseStatValue(stats, "totalTurnovers"),
    fouls: parseStatValue(stats, "fouls"),
    pointsInPaint: parseStatValue(stats, "pointsInPaint"),
    fastBreakPoints: parseStatValue(stats, "fastBreakPoints"),
    largestLead: parseStatValue(stats, "largestLead"),
  };
}

export const fetchGameDetails = createServerFn({ method: "GET" })
  .inputValidator((d: string) => d)
  .handler(async ({ data: gameId }): Promise<GameDetails> => {
    const baseUrl = process.env.NBA_API_BASE;
    if (!baseUrl) {
      throw new Error("NBA_API_BASE not configured");
    }

    const response = await fetch(`${baseUrl}/summary?event=${gameId}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Game details API error: ${response.status}`);
    }

    const apiData = (await response.json()) as ApiResponse;

    if (!apiData.boxscore?.teams || apiData.boxscore.teams.length < 2) {
      throw new Error("Invalid game data");
    }

    const competition = apiData.header?.competitions?.[0];
    const awayTeamData = apiData.boxscore.teams[0];
    const homeTeamData = apiData.boxscore.teams[1];

    const awayColors = getTeamColors(awayTeamData.team.uid);
    const homeColors = getTeamColors(homeTeamData.team.uid);

    return {
      id: gameId,
      state: competition?.status?.type?.state ?? "pre",
      statusDetail: competition?.status?.type?.detail,
      venue: competition?.venue?.fullName,
      date: competition?.date,
      away: {
        id: awayTeamData.team.id,
        uid: awayTeamData.team.uid,
        name: awayTeamData.team.name,
        abbreviation: awayTeamData.team.abbreviation,
        score: parseInt(awayTeamData.score, 10) || 0,
        logo: getProxiedLogoUrl(awayTeamData.team.logo),
        darkColor: awayColors.darkColor,
        lightColor: awayColors.lightColor,
        winner: awayTeamData.winner ?? false,
        stats: extractTeamStats(awayTeamData.statistics),
      },
      home: {
        id: homeTeamData.team.id,
        uid: homeTeamData.team.uid,
        name: homeTeamData.team.name,
        abbreviation: homeTeamData.team.abbreviation,
        score: parseInt(homeTeamData.score, 10) || 0,
        logo: getProxiedLogoUrl(homeTeamData.team.logo),
        darkColor: homeColors.darkColor,
        lightColor: homeColors.lightColor,
        winner: homeTeamData.winner ?? false,
        stats: extractTeamStats(homeTeamData.statistics),
      },
    };
  });

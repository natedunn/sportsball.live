import { createServerFn } from "@tanstack/react-start";
import { getTeamColors, getProxiedLogoUrl } from "./team-utils.server";

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

interface ApiHeaderCompetitor {
  homeAway: "home" | "away";
  team: {
    id: string;
    uid?: string;
    name?: string;
    abbreviation?: string;
    logo?: string;
  };
  score: string;
  winner?: boolean;
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
    competitors?: ApiHeaderCompetitor[];
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
    const boxscoreTeams = apiData.boxscore.teams;

    // Get scores and basic info from header competitors
    const headerAway = competition?.competitors?.find(c => c.homeAway === "away");
    const headerHome = competition?.competitors?.find(c => c.homeAway === "home");

    // Match boxscore teams by team id for stats
    const awayStats = boxscoreTeams.find(t => t.team.id === headerAway?.team.id);
    const homeStats = boxscoreTeams.find(t => t.team.id === headerHome?.team.id);

    const awayColors = getTeamColors(headerAway?.team.uid);
    const homeColors = getTeamColors(headerHome?.team.uid);

    return {
      id: gameId,
      state: competition?.status?.type?.state ?? "pre",
      statusDetail: competition?.status?.type?.detail,
      venue: competition?.venue?.fullName,
      date: competition?.date,
      away: {
        id: headerAway?.team.id ?? "",
        uid: headerAway?.team.uid,
        name: headerAway?.team.name,
        abbreviation: headerAway?.team.abbreviation,
        score: parseInt(headerAway?.score ?? "0", 10) || 0,
        logo: getProxiedLogoUrl(headerAway?.team.logo),
        darkColor: awayColors.darkColor,
        lightColor: awayColors.lightColor,
        winner: headerAway?.winner ?? false,
        stats: extractTeamStats(awayStats?.statistics),
      },
      home: {
        id: headerHome?.team.id ?? "",
        uid: headerHome?.team.uid,
        name: headerHome?.team.name,
        abbreviation: headerHome?.team.abbreviation,
        score: parseInt(headerHome?.score ?? "0", 10) || 0,
        logo: getProxiedLogoUrl(headerHome?.team.logo),
        darkColor: homeColors.darkColor,
        lightColor: homeColors.lightColor,
        winner: headerHome?.winner ?? false,
        stats: extractTeamStats(homeStats?.statistics),
      },
    };
  });

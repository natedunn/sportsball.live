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

export interface PlayerStats {
  minutes: string;
  fieldGoals: string;
  threePointers: string;
  freeThrows: string;
  offensiveRebounds: number;
  defensiveRebounds: number;
  totalRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  plusMinus: string;
  points: number;
}

export interface Player {
  id: string;
  name: string;
  jersey: string;
  position: string;
  starter: boolean;
  active: boolean;
  stats: PlayerStats;
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
  record: string | undefined;
  stats: TeamStats;
  players: Player[];
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

interface ApiAthlete {
  id: string;
  displayName?: string;
  jersey?: string;
  position?: {
    abbreviation?: string;
  };
  starter?: boolean;
}

interface ApiPlayerStats {
  athlete: ApiAthlete;
  stats: string[];
  starter?: boolean;
  active?: boolean;
}

interface ApiPlayerStatCategory {
  names: string[];
  keys: string[];
  athletes: ApiPlayerStats[];
}

interface ApiBoxscorePlayers {
  team: {
    id: string;
  };
  statistics: ApiPlayerStatCategory[];
}

interface ApiBoxscore {
  teams?: ApiTeam[];
  players?: ApiBoxscorePlayers[];
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
  record?: Array<{
    type: string;
    summary?: string;
    displayValue?: string;
  }>;
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

function extractPlayers(boxscorePlayers: ApiBoxscorePlayers | undefined): Player[] {
  if (!boxscorePlayers?.statistics?.[0]) return [];

  const statCategory = boxscorePlayers.statistics[0];
  const statNames = statCategory.names;

  // Map stat names to indices
  const getStatIndex = (name: string): number => statNames.indexOf(name);

  return statCategory.athletes.map((playerData): Player => {
    const stats = playerData.stats ?? [];
    const minIdx = getStatIndex("MIN");
    const fgIdx = getStatIndex("FG");
    const tpIdx = getStatIndex("3PT");
    const ftIdx = getStatIndex("FT");
    const orebIdx = getStatIndex("OREB");
    const drebIdx = getStatIndex("DREB");
    const rebIdx = getStatIndex("REB");
    const astIdx = getStatIndex("AST");
    const stlIdx = getStatIndex("STL");
    const blkIdx = getStatIndex("BLK");
    const toIdx = getStatIndex("TO");
    const pfIdx = getStatIndex("PF");
    const pmIdx = getStatIndex("+/-");
    const ptsIdx = getStatIndex("PTS");

    const getStat = (idx: number, fallback: string): string => {
      return idx >= 0 && stats[idx] != null ? stats[idx] : fallback;
    };

    const getStatNum = (idx: number): number => {
      return idx >= 0 && stats[idx] != null ? parseInt(stats[idx], 10) || 0 : 0;
    };

    return {
      id: playerData.athlete.id,
      name: playerData.athlete.displayName ?? "Unknown",
      jersey: playerData.athlete.jersey ?? "",
      position: playerData.athlete.position?.abbreviation ?? "",
      starter: playerData.starter ?? false,
      active: playerData.active ?? false,
      stats: {
        minutes: getStat(minIdx, "0"),
        fieldGoals: getStat(fgIdx, "0-0"),
        threePointers: getStat(tpIdx, "0-0"),
        freeThrows: getStat(ftIdx, "0-0"),
        offensiveRebounds: getStatNum(orebIdx),
        defensiveRebounds: getStatNum(drebIdx),
        totalRebounds: getStatNum(rebIdx),
        assists: getStatNum(astIdx),
        steals: getStatNum(stlIdx),
        blocks: getStatNum(blkIdx),
        turnovers: getStatNum(toIdx),
        fouls: getStatNum(pfIdx),
        plusMinus: getStat(pmIdx, "0"),
        points: getStatNum(ptsIdx),
      },
    };
  });
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
    const boxscorePlayers = apiData.boxscore.players;

    // Get scores and basic info from header competitors
    const headerAway = competition?.competitors?.find(c => c.homeAway === "away");
    const headerHome = competition?.competitors?.find(c => c.homeAway === "home");

    // Match boxscore teams by team id for stats
    const awayStats = boxscoreTeams.find(t => t.team.id === headerAway?.team.id);
    const homeStats = boxscoreTeams.find(t => t.team.id === headerHome?.team.id);

    // Match boxscore players by team id
    const awayPlayers = boxscorePlayers?.find(p => p.team.id === headerAway?.team.id);
    const homePlayers = boxscorePlayers?.find(p => p.team.id === headerHome?.team.id);

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
        logo: getProxiedLogoUrl(awayStats?.team.logo),
        darkColor: awayColors.darkColor,
        lightColor: awayColors.lightColor,
        winner: headerAway?.winner ?? false,
        record: headerAway?.record?.find(r => r.type === "total")?.summary,
        stats: extractTeamStats(awayStats?.statistics),
        players: extractPlayers(awayPlayers),
      },
      home: {
        id: headerHome?.team.id ?? "",
        uid: headerHome?.team.uid,
        name: headerHome?.team.name,
        abbreviation: headerHome?.team.abbreviation,
        score: parseInt(headerHome?.score ?? "0", 10) || 0,
        logo: getProxiedLogoUrl(homeStats?.team.logo),
        darkColor: homeColors.darkColor,
        lightColor: homeColors.lightColor,
        winner: headerHome?.winner ?? false,
        record: headerHome?.record?.find(r => r.type === "total")?.summary,
        stats: extractTeamStats(homeStats?.statistics),
        players: extractPlayers(homePlayers),
      },
    };
  });

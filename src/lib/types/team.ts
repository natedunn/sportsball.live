// Team page types shared across NBA, WNBA, and G-League

export interface TeamOverview {
  // Basic info
  id: string;
  name: string;
  abbreviation: string;
  location: string;
  logo: string | undefined;
  darkColor: string;
  lightColor: string;

  // Record
  record: {
    wins: number;
    losses: number;
    winPct: number;
    streak: string | undefined;
    home: string | undefined;
    away: string | undefined;
  };

  // Standings
  standings: {
    conferenceRank: number | undefined;
    conference: string | undefined;
    divisionRank: number | undefined;
    division: string | undefined;
  };

  // Quick stats (per game averages)
  stats: {
    ppg: number;
    oppPpg: number;
    ortg: number;
    drtg: number;
    netRtg: number;
  };

  // Stat rankings (league position)
  ranks?: {
    ppg?: number;
    oppPpg?: number;
    ortg?: number;
    drtg?: number;
    netRtg?: number;
  };
}

export interface RosterPlayer {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  jersey: string;
  position: string;
  height: string;
  weight: string;
  age: number | undefined;
  experience: string;
  college: string | undefined;
  headshot: string | undefined;
  injured: boolean;
  injuryStatus: string | undefined;
  injuryDescription: string | undefined;
  // Season averages
  stats: {
    gp: number;
    gs: number;
    mpg: number;
    ppg: number;
    rpg: number;
    apg: number;
    spg: number;
    bpg: number;
    topg: number;
    fgPct: number;
    threePct: number;
    ftPct: number;
  };
}

export interface ScheduleGame {
  id: string;
  date: string;
  isHome: boolean;
  opponent: {
    id: string;
    name: string;
    abbreviation: string;
    logo: string | undefined;
  };
  // Result (for completed games)
  result?: {
    isWin: boolean;
    score: number;
    opponentScore: number;
    margin: number;
  };
  // Status
  state: "pre" | "in" | "post";
  statusDetail: string;
  venue: string | undefined;
}

export interface TeamStats {
  // Scoring
  scoring: {
    ppg: number;
    oppPpg: number;
    pace: number;
    ortg: number;
    drtg: number;
    netRtg: number;
  };

  // Shooting
  shooting: {
    fgPct: number;
    fgMade: number;
    fgAttempted: number;
    threePct: number;
    threeMade: number;
    threeAttempted: number;
    ftPct: number;
    ftMade: number;
    ftAttempted: number;
    efgPct: number;
    tsPct: number;
  };

  // Rebounding
  rebounding: {
    rpg: number;
    orpg: number;
    drpg: number;
    orebPct: number;
  };

  // Playmaking
  playmaking: {
    apg: number;
    tovPg: number;
    astToRatio: number;
  };

  // Defense
  defense: {
    spg: number;
    bpg: number;
    oppFgPct: number;
    oppThreePct: number;
  };

  // Rankings (league position, from Convex DB)
  ranks?: {
    // Scoring ranks
    rankPpg?: number;
    rankOppPpg?: number;
    rankMargin?: number;
    rankPace?: number;
    rankOrtg?: number;
    rankDrtg?: number;
    rankNetRtg?: number;
    // Shooting ranks
    rankFgPct?: number;
    rankThreePct?: number;
    rankFtPct?: number;
    rankEfgPct?: number;
    rankTsPct?: number;
    // Rebounding ranks
    rankRpg?: number;
    rankOrpg?: number;
    rankDrpg?: number;
    // Playmaking ranks
    rankApg?: number;
    rankTov?: number;
    rankAstToRatio?: number;
    // Defense ranks
    rankSpg?: number;
    rankBpg?: number;
  };
}

export interface TeamLeader {
  player: {
    id: string;
    name: string;
    headshot: string | undefined;
    position: string;
  };
  value: number;
  category: "ppg" | "rpg" | "apg";
}

export interface InjuredPlayer {
  id: string;
  name: string;
  position: string;
  status: string;
  description: string | undefined;
  shortComment: string | undefined;
  headshot: string | undefined;
}

export interface TeamTrends {
  // Rolling averages
  last5: RollingAverage;
  last10: RollingAverage;
  last15: RollingAverage;

  // Splits
  home: SplitRecord;
  away: SplitRecord;
  vsConference: SplitRecord;
  vsDivision: SplitRecord;

  // Monthly breakdown
  monthly: MonthlyRecord[];
}

export interface RollingAverage {
  wins: number;
  losses: number;
  ppg: number;
  oppPpg: number;
  margin: number;
  ortg?: number;
  drtg?: number;
}

export interface SplitRecord {
  wins: number;
  losses: number;
  ppg?: number;
  oppPpg?: number;
}

export interface MonthlyRecord {
  month: string;
  wins: number;
  losses: number;
  ppg: number;
  oppPpg: number;
}

export interface TeamDetailsData {
  overview: TeamOverview;
  roster: RosterPlayer[];
  schedule: ScheduleGame[];
  stats: TeamStats;
  leaders: TeamLeader[];
  injuries: InjuredPlayer[];
}

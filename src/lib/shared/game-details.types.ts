// Shared game details types used across all leagues

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

export interface MatchupGame {
	id: string;
	date: string;
	statusDetail: string;
	isCurrent: boolean;
	homeTeam: {
		id: string;
		abbreviation: string;
		score: number;
		winner: boolean;
	};
	awayTeam: {
		id: string;
		abbreviation: string;
		score: number;
		winner: boolean;
	};
}

export interface SeasonSeries {
	type: "season" | "playoff";
	title: string;
	summary: string;
	completed: boolean;
	games: MatchupGame[];
}

export interface GameDetails {
	id: string;
	state: "pre" | "in" | "post";
	statusDetail: string | undefined;
	venue: string | undefined;
	date: string | undefined;
	away: GameDetailsTeam;
	home: GameDetailsTeam;
	allSeries: SeasonSeries[];
}

// API response types
export interface ApiStat {
	name: string;
	displayValue: string;
}

export interface ApiTeam {
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

export interface ApiAthlete {
	id: string;
	displayName?: string;
	jersey?: string;
	position?: {
		abbreviation?: string;
	};
	starter?: boolean;
}

export interface ApiPlayerStats {
	athlete: ApiAthlete;
	stats: string[];
	starter?: boolean;
	active?: boolean;
}

export interface ApiPlayerStatCategory {
	names: string[];
	keys: string[];
	athletes: ApiPlayerStats[];
}

export interface ApiBoxscorePlayers {
	team: {
		id: string;
	};
	statistics: ApiPlayerStatCategory[];
}

export interface ApiBoxscore {
	teams?: ApiTeam[];
	players?: ApiBoxscorePlayers[];
}

export interface ApiHeaderCompetitor {
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

export interface ApiHeader {
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

export interface ApiSeasonSeriesCompetitor {
	homeAway: "home" | "away";
	winner: boolean;
	team: {
		id: string;
		abbreviation?: string;
	};
	score: string;
}

export interface ApiSeasonSeriesEvent {
	id: string;
	date: string;
	statusType?: {
		detail?: string;
	};
	competitors: ApiSeasonSeriesCompetitor[];
}

export interface ApiSeasonSeries {
	type?: string;
	title?: string;
	summary?: string;
	completed?: boolean;
	events?: ApiSeasonSeriesEvent[];
}

export interface ApiGameDetailsResponse {
	boxscore?: ApiBoxscore;
	header?: ApiHeader;
	seasonseries?: ApiSeasonSeries[];
}

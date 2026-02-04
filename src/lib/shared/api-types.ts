// Shared ESPN API response types for scoreboard/games endpoints

export interface ApiCompetitor {
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

export interface ApiEvent {
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

export interface ApiScoreboardResponse {
	events?: ApiEvent[];
}

// Standings API types (ESPN v2 format - used by NBA/WNBA)
export interface ApiStandingsTeamEntry {
	team: {
		id: string;
		uid?: string;
		displayName?: string;
		abbreviation?: string;
		logos?: Array<{ href?: string }>;
	};
	stats: Array<{
		name: string;
		value: number;
		displayValue?: string;
	}>;
}

export interface ApiStandingsGroup {
	name?: string;
	standings?: {
		entries?: ApiStandingsTeamEntry[];
	};
}

export interface ApiStandingsResponse {
	children?: ApiStandingsGroup[];
}

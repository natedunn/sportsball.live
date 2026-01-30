export type LeaderCategory = "pts" | "ast" | "reb" | "stock";

export interface LeaderPlayer {
	id: string;
	name: string;
	firstName: string;
	lastName: string;
	headshot?: string;
	jersey?: string;
	team: {
		id: string;
		name: string;
		abbreviation: string;
		logo?: string;
	};
}

export interface LeaderEntry {
	player: LeaderPlayer;
	value: number;
	displayValue: string;
	// For STOCK, we include the breakdown
	breakdown?: {
		steals: number;
		blocks: number;
	};
}

export interface CategoryLeaders {
	category: LeaderCategory;
	displayName: string;
	abbreviation: string;
	leaders: LeaderEntry[];
}

export interface LeagueLeadersResponse {
	points: CategoryLeaders;
	assists: CategoryLeaders;
	rebounds: CategoryLeaders;
	stocks: CategoryLeaders;
}

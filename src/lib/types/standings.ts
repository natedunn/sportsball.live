export interface StandingTeam {
	id: string;
	name: string;
	abbreviation: string;
	logo: string | undefined;
	darkColor: string;
	lightColor: string;
	wins: number;
	losses: number;
	winPct: number;
	gamesBack: number;
	streak: string;
	homeRecord: string;
	awayRecord: string;
	divisionRecord: string;
	conferenceRecord: string;
	last10: string;
	pointsFor: number;
	pointsAgainst: number;
	differential: number;
}

export interface ConferenceStandings {
	name: string;
	teams: StandingTeam[];
}

export interface StandingsResponse {
	eastern: ConferenceStandings;
	western: ConferenceStandings;
}

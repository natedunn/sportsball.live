// Shared ESPN Team API response types

export interface ApiTeamResponse {
	team: {
		id: string;
		uid?: string;
		name: string;
		displayName: string;
		abbreviation: string;
		location: string;
		logo?: string;
		color?: string;
		alternateColor?: string;
		standingSummary?: string;
		record?: {
			items?: Array<{
				type: string;
				summary?: string;
				stats?: Array<{
					name: string;
					value: number;
					displayValue?: string;
				}>;
			}>;
		};
		athletes?: Array<ApiAthlete>;
	};
}

export interface ApiAthlete {
	id: string;
	uid?: string;
	firstName: string;
	lastName: string;
	displayName: string;
	jersey?: string;
	position?: {
		abbreviation?: string;
		name?: string;
	};
	displayHeight?: string;
	displayWeight?: string;
	age?: number;
	experience?: {
		years?: number;
	};
	college?: {
		name?: string;
	};
	headshot?: {
		href?: string;
	};
	injuries?: Array<{
		status?: string;
		type?: {
			description?: string;
		};
	}>;
	statistics?: Array<{
		name: string;
		labels?: string[];
		values?: number[];
		displayNames?: string[];
	}>;
}

export interface ApiScheduleResponse {
	requestedSeason?: {
		year: number;
		type: number;
	};
	events?: Array<{
		id: string;
		date: string;
		name: string;
		shortName?: string;
		season?: {
			year: number;
			type: number;
		};
		competitions: Array<{
			id: string;
			date: string;
			status: {
				type: {
					state: "pre" | "in" | "post";
					detail?: string;
				};
			};
			venue?: {
				fullName?: string;
			};
			competitors: Array<{
				id: string;
				homeAway: "home" | "away";
				winner?: boolean;
				score?: {
					value?: number;
					displayValue?: string;
				};
				team: {
					id: string;
					name?: string;
					abbreviation?: string;
					displayName?: string;
					logo?: string;
				};
			}>;
		}>;
	}>;
}

export interface ApiStatsResponse {
	results?: {
		stats?: {
			categories?: Array<{
				name: string;
				stats: Array<{
					name: string;
					displayName?: string;
					value: number;
					rank?: number;
				}>;
			}>;
		};
	};
}

export interface ApiRosterResponse {
	positionGroups?: Array<{
		type: string;
		displayName: string;
		athletes: Array<{
			id: string;
			firstName: string;
			lastName: string;
			displayName: string;
			jersey?: string;
			position?: {
				abbreviation?: string;
				name?: string;
			};
			displayHeight?: string;
			displayWeight?: string;
			age?: number;
			experience?: {
				years?: number;
			};
			college?: {
				name?: string;
				shortName?: string;
			};
			headshot?: {
				href?: string;
			};
			status?: {
				type?: string;
				name?: string;
			};
			injuries?: Array<{
				status?: string;
				date?: string;
				type?: {
					id?: string;
					description?: string;
					abbreviation?: string;
				};
				details?: {
					type?: string;
					location?: string;
					detail?: string;
					side?: string;
					returnDate?: string;
				};
			}>;
			statistics?: {
				splits?: {
					categories?: Array<{
						name: string;
						stats: Array<{
							name: string;
							value: number;
							displayValue?: string;
						}>;
					}>;
				};
			};
		}>;
	}>;
}

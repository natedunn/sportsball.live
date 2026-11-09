export interface PlayerDraftInfo {
	year: number;
	round: number;
	pick: number;
	/** Abbreviation of the team that made the pick */
	team?: string;
}

export interface PlayerBio {
	/** YYYY-MM-DD, when ESPN provides it */
	birthDate?: string;
	/** Age as of the last roster sync; birthDate is preferred when known */
	age?: number;
	college: string;
	/** Undefined when unknown, null when undrafted */
	draft?: PlayerDraftInfo | null;
	/** ESPN's season count, this one included (0 for rookies) */
	experienceYears?: number;
	height: string;
	weight: string;
}

export interface PlayerProfileData {
	id: string;
	name: string;
	team: string;
	position: string;
	headshot?: string;
	bio: PlayerBio;
	basicStats: {
		games: number;
		points: number;
		rebounds: number;
		assists: number;
		steals: number;
		blocks: number;
		minutes: number;
		turnovers: number;
	};
	/** Season percentages, 0-100 */
	shooting: {
		fieldGoalPct: number;
		threePointPct: number;
		freeThrowPct: number;
		effectiveFgPct: number;
	};
	calculatedStats: {
		trueShootingPct: number;
		/** NBA efficiency (EFF) per game */
		efficiency: number;
		assistToTurnover: number;
	};
}

function calculateAge(birthDate: string): number {
	const birth = new Date(`${birthDate}T00:00:00`);
	const now = new Date();
	let age = now.getFullYear() - birth.getFullYear();
	const monthDelta = now.getMonth() - birth.getMonth();
	if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
		age -= 1;
	}
	return age;
}

/** "2015 · Rd 1, Pk 13 (PHX)", "Undrafted", or undefined when unknown */
export function formatDraft(draft: PlayerDraftInfo | null | undefined): string | undefined {
	if (draft === undefined) return undefined;
	if (draft === null) return "Undrafted";
	const team = draft.team ? ` (${draft.team})` : "";
	return `${draft.year} · Rd ${draft.round}, Pk ${draft.pick}${team}`;
}

/** "12th season", "Rookie", or undefined when unknown */
export function formatExperience(years: number | undefined): string | undefined {
	if (years === undefined) return undefined;
	if (years <= 0) return "Rookie";
	const lastTwo = years % 100;
	const suffix =
		lastTwo >= 11 && lastTwo <= 13 ? "th" : (["th", "st", "nd", "rd"][years % 10] ?? "th");
	return `${years}${suffix} season`;
}

export function getPlayerAge(bio: PlayerBio): number | undefined {
	return bio.birthDate ? calculateAge(bio.birthDate) : bio.age;
}

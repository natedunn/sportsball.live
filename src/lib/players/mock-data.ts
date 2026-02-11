export interface PlayerRankingRow {
	id: string;
	name: string;
	team: string;
	position: string;
	games: number;
	points: number;
	rebounds: number;
	assists: number;
	trueShootingPct: number;
	usagePct: number;
	efficiency: number;
}

export interface PlayerBio {
	birthDate: string;
	college: string;
	draftInfo: string;
	height: string;
	weight: string;
	status: "Active" | "Questionable" | "Out";
}

export interface PlayerSplitLine {
	label: string;
	minutes: number;
	points: number;
	rebounds: number;
	assists: number;
	fieldGoalPct: number;
	threePointPct: number;
	freeThrowPct: number;
}

export interface LastTenGameLine {
	gameLabel: string;
	minutes: number;
	fieldGoalPct: number;
	threePointPct: number;
	freeThrowPct: number;
	rebounds: number;
	assists: number;
	blocks: number;
	points: number;
}

export interface PlayerProfileData {
	id: string;
	name: string;
	team: string;
	position: string;
	bio: PlayerBio;
	basicStats: {
		games: number;
		points: number;
		rebounds: number;
		assists: number;
		steals: number;
		blocks: number;
	};
	calculatedStats: {
		trueShootingPct: number;
		usagePct: number;
		playerEfficiency: number;
		assistToTurnover: number;
	};
	splits: PlayerSplitLine[];
	lastTen: LastTenGameLine[];
	teammateIds: string[];
}

const playerProfiles: PlayerProfileData[] = [
	{
		id: "jalen-carter",
		name: "Jalen Carter",
		team: "Austin Arrows",
		position: "G",
		bio: {
			birthDate: "2000-11-02",
			college: "Baylor",
			draftInfo: "2022, R1 Pick 14",
			height: "6'4\"",
			weight: "198 lb",
			status: "Active",
		},
		basicStats: {
			games: 47,
			points: 27.1,
			rebounds: 6.3,
			assists: 8.4,
			steals: 1.7,
			blocks: 0.4,
		},
		calculatedStats: {
			trueShootingPct: 62.3,
			usagePct: 31.9,
			playerEfficiency: 26.8,
			assistToTurnover: 2.6,
		},
		splits: [
			{ label: "Last Game", minutes: 37, points: 33, rebounds: 7, assists: 10, fieldGoalPct: 52.6, threePointPct: 41.7, freeThrowPct: 87.5 },
			{ label: "Last 10", minutes: 35, points: 29.8, rebounds: 6.1, assists: 9.2, fieldGoalPct: 49.3, threePointPct: 39.1, freeThrowPct: 88.2 },
			{ label: "Home", minutes: 34, points: 28.4, rebounds: 6.5, assists: 8.8, fieldGoalPct: 48.7, threePointPct: 38.8, freeThrowPct: 87.1 },
			{ label: "Road", minutes: 35, points: 25.8, rebounds: 6.1, assists: 8.0, fieldGoalPct: 47.2, threePointPct: 36.4, freeThrowPct: 86.8 },
		],
		lastTen: [
			{ gameLabel: "vs SEA", minutes: 37, fieldGoalPct: 52.6, threePointPct: 41.7, freeThrowPct: 87.5, rebounds: 7, assists: 10, blocks: 1, points: 33 },
			{ gameLabel: "@ PHX", minutes: 34, fieldGoalPct: 47.4, threePointPct: 44.4, freeThrowPct: 100, rebounds: 4, assists: 8, blocks: 0, points: 28 },
			{ gameLabel: "vs LVA", minutes: 36, fieldGoalPct: 51.9, threePointPct: 37.5, freeThrowPct: 90.0, rebounds: 8, assists: 11, blocks: 0, points: 31 },
			{ gameLabel: "@ MIN", minutes: 33, fieldGoalPct: 46.2, threePointPct: 35.7, freeThrowPct: 83.3, rebounds: 6, assists: 9, blocks: 1, points: 24 },
			{ gameLabel: "vs DAL", minutes: 35, fieldGoalPct: 55.0, threePointPct: 42.9, freeThrowPct: 85.7, rebounds: 7, assists: 9, blocks: 0, points: 30 },
			{ gameLabel: "@ NYL", minutes: 34, fieldGoalPct: 44.4, threePointPct: 36.4, freeThrowPct: 88.9, rebounds: 5, assists: 8, blocks: 0, points: 26 },
			{ gameLabel: "vs LAS", minutes: 38, fieldGoalPct: 53.8, threePointPct: 40.0, freeThrowPct: 90.9, rebounds: 9, assists: 12, blocks: 1, points: 34 },
			{ gameLabel: "@ IND", minutes: 32, fieldGoalPct: 45.0, threePointPct: 33.3, freeThrowPct: 84.6, rebounds: 4, assists: 7, blocks: 0, points: 22 },
			{ gameLabel: "vs CHI", minutes: 36, fieldGoalPct: 50.0, threePointPct: 40.0, freeThrowPct: 92.3, rebounds: 6, assists: 10, blocks: 0, points: 29 },
			{ gameLabel: "@ ATL", minutes: 34, fieldGoalPct: 48.1, threePointPct: 38.5, freeThrowPct: 86.7, rebounds: 5, assists: 8, blocks: 0, points: 27 },
		],
		teammateIds: ["mason-li", "isaiah-kane", "malik-bryant"],
	},
	{
		id: "mason-li",
		name: "Mason Li",
		team: "Austin Arrows",
		position: "F",
		bio: {
			birthDate: "1998-07-16",
			college: "Gonzaga",
			draftInfo: "2020, R1 Pick 8",
			height: "6'8\"",
			weight: "224 lb",
			status: "Questionable",
		},
		basicStats: {
			games: 44,
			points: 22.7,
			rebounds: 10.9,
			assists: 4.2,
			steals: 1.1,
			blocks: 1.3,
		},
		calculatedStats: {
			trueShootingPct: 60.2,
			usagePct: 27.5,
			playerEfficiency: 23.4,
			assistToTurnover: 1.7,
		},
		splits: [
			{ label: "Last Game", minutes: 31, points: 19, rebounds: 11, assists: 3, fieldGoalPct: 50.0, threePointPct: 28.6, freeThrowPct: 80.0 },
			{ label: "Last 10", minutes: 33, points: 21.5, rebounds: 11.2, assists: 4.0, fieldGoalPct: 52.1, threePointPct: 34.5, freeThrowPct: 81.4 },
			{ label: "Home", minutes: 32, points: 23.2, rebounds: 11.1, assists: 4.3, fieldGoalPct: 53.3, threePointPct: 35.1, freeThrowPct: 82.0 },
			{ label: "Road", minutes: 33, points: 22.0, rebounds: 10.7, assists: 4.1, fieldGoalPct: 51.0, threePointPct: 33.2, freeThrowPct: 79.8 },
		],
		lastTen: [
			{ gameLabel: "vs SEA", minutes: 31, fieldGoalPct: 50.0, threePointPct: 28.6, freeThrowPct: 80.0, rebounds: 11, assists: 3, blocks: 2, points: 19 },
			{ gameLabel: "@ PHX", minutes: 34, fieldGoalPct: 58.8, threePointPct: 40.0, freeThrowPct: 83.3, rebounds: 12, assists: 4, blocks: 1, points: 24 },
			{ gameLabel: "vs LVA", minutes: 35, fieldGoalPct: 53.3, threePointPct: 33.3, freeThrowPct: 75.0, rebounds: 10, assists: 5, blocks: 2, points: 22 },
			{ gameLabel: "@ MIN", minutes: 32, fieldGoalPct: 47.1, threePointPct: 25.0, freeThrowPct: 85.7, rebounds: 12, assists: 4, blocks: 1, points: 20 },
			{ gameLabel: "vs DAL", minutes: 33, fieldGoalPct: 55.6, threePointPct: 37.5, freeThrowPct: 80.0, rebounds: 13, assists: 3, blocks: 2, points: 25 },
			{ gameLabel: "@ NYL", minutes: 31, fieldGoalPct: 48.1, threePointPct: 30.0, freeThrowPct: 77.8, rebounds: 9, assists: 3, blocks: 1, points: 18 },
			{ gameLabel: "vs LAS", minutes: 36, fieldGoalPct: 60.0, threePointPct: 42.9, freeThrowPct: 83.3, rebounds: 11, assists: 5, blocks: 2, points: 27 },
			{ gameLabel: "@ IND", minutes: 32, fieldGoalPct: 50.0, threePointPct: 33.3, freeThrowPct: 75.0, rebounds: 10, assists: 4, blocks: 1, points: 21 },
			{ gameLabel: "vs CHI", minutes: 34, fieldGoalPct: 52.9, threePointPct: 36.4, freeThrowPct: 81.8, rebounds: 12, assists: 4, blocks: 2, points: 23 },
			{ gameLabel: "@ ATL", minutes: 33, fieldGoalPct: 54.5, threePointPct: 35.7, freeThrowPct: 80.0, rebounds: 12, assists: 5, blocks: 1, points: 24 },
		],
		teammateIds: ["jalen-carter", "isaiah-kane", "malik-bryant"],
	},
	{
		id: "isaiah-kane",
		name: "Isaiah Kane",
		team: "Austin Arrows",
		position: "C",
		bio: {
			birthDate: "1997-03-11",
			college: "Duke",
			draftInfo: "2019, R1 Pick 3",
			height: "6'11\"",
			weight: "248 lb",
			status: "Active",
		},
		basicStats: {
			games: 46,
			points: 19.6,
			rebounds: 12.4,
			assists: 2.8,
			steals: 0.8,
			blocks: 2.1,
		},
		calculatedStats: {
			trueShootingPct: 64.1,
			usagePct: 24.8,
			playerEfficiency: 24.3,
			assistToTurnover: 1.2,
		},
		splits: [
			{ label: "Last Game", minutes: 30, points: 18, rebounds: 13, assists: 2, fieldGoalPct: 61.1, threePointPct: 0, freeThrowPct: 72.7 },
			{ label: "Last 10", minutes: 31, points: 20.4, rebounds: 12.8, assists: 3.0, fieldGoalPct: 60.3, threePointPct: 22.2, freeThrowPct: 74.1 },
			{ label: "Home", minutes: 30, points: 19.9, rebounds: 12.9, assists: 2.9, fieldGoalPct: 61.4, threePointPct: 24.0, freeThrowPct: 74.8 },
			{ label: "Road", minutes: 31, points: 19.3, rebounds: 11.9, assists: 2.7, fieldGoalPct: 59.6, threePointPct: 20.1, freeThrowPct: 73.4 },
		],
		lastTen: [
			{ gameLabel: "vs SEA", minutes: 30, fieldGoalPct: 61.1, threePointPct: 0, freeThrowPct: 72.7, rebounds: 13, assists: 2, blocks: 3, points: 18 },
			{ gameLabel: "@ PHX", minutes: 31, fieldGoalPct: 63.6, threePointPct: 0, freeThrowPct: 75.0, rebounds: 14, assists: 2, blocks: 2, points: 20 },
			{ gameLabel: "vs LVA", minutes: 33, fieldGoalPct: 57.9, threePointPct: 33.3, freeThrowPct: 70.0, rebounds: 12, assists: 3, blocks: 2, points: 21 },
			{ gameLabel: "@ MIN", minutes: 30, fieldGoalPct: 59.1, threePointPct: 0, freeThrowPct: 76.9, rebounds: 11, assists: 4, blocks: 1, points: 19 },
			{ gameLabel: "vs DAL", minutes: 29, fieldGoalPct: 64.3, threePointPct: 0, freeThrowPct: 75.0, rebounds: 13, assists: 2, blocks: 3, points: 22 },
			{ gameLabel: "@ NYL", minutes: 32, fieldGoalPct: 56.0, threePointPct: 25.0, freeThrowPct: 72.7, rebounds: 12, assists: 3, blocks: 2, points: 18 },
			{ gameLabel: "vs LAS", minutes: 31, fieldGoalPct: 66.7, threePointPct: 0, freeThrowPct: 78.6, rebounds: 14, assists: 3, blocks: 4, points: 24 },
			{ gameLabel: "@ IND", minutes: 30, fieldGoalPct: 58.8, threePointPct: 0, freeThrowPct: 70.0, rebounds: 12, assists: 4, blocks: 2, points: 17 },
			{ gameLabel: "vs CHI", minutes: 30, fieldGoalPct: 62.5, threePointPct: 0, freeThrowPct: 72.7, rebounds: 13, assists: 3, blocks: 2, points: 20 },
			{ gameLabel: "@ ATL", minutes: 31, fieldGoalPct: 59.1, threePointPct: 0, freeThrowPct: 73.3, rebounds: 14, assists: 3, blocks: 2, points: 21 },
		],
		teammateIds: ["jalen-carter", "mason-li", "malik-bryant"],
	},
	{
		id: "malik-bryant",
		name: "Malik Bryant",
		team: "Austin Arrows",
		position: "G",
		bio: {
			birthDate: "2001-01-19",
			college: "UCLA",
			draftInfo: "2023, R1 Pick 20",
			height: "6'3\"",
			weight: "190 lb",
			status: "Active",
		},
		basicStats: {
			games: 41,
			points: 16.4,
			rebounds: 3.9,
			assists: 5.2,
			steals: 1.4,
			blocks: 0.2,
		},
		calculatedStats: {
			trueShootingPct: 58.9,
			usagePct: 22.4,
			playerEfficiency: 16.6,
			assistToTurnover: 2.1,
		},
		splits: [
			{ label: "Last Game", minutes: 29, points: 15, rebounds: 4, assists: 5, fieldGoalPct: 46.7, threePointPct: 36.4, freeThrowPct: 83.3 },
			{ label: "Last 10", minutes: 30, points: 17.1, rebounds: 4.1, assists: 5.4, fieldGoalPct: 47.8, threePointPct: 37.6, freeThrowPct: 84.8 },
			{ label: "Home", minutes: 29, points: 16.8, rebounds: 4.0, assists: 5.0, fieldGoalPct: 47.1, threePointPct: 38.3, freeThrowPct: 85.2 },
			{ label: "Road", minutes: 30, points: 15.9, rebounds: 3.8, assists: 5.4, fieldGoalPct: 46.2, threePointPct: 36.7, freeThrowPct: 83.7 },
		],
		lastTen: [
			{ gameLabel: "vs SEA", minutes: 29, fieldGoalPct: 46.7, threePointPct: 36.4, freeThrowPct: 83.3, rebounds: 4, assists: 5, blocks: 0, points: 15 },
			{ gameLabel: "@ PHX", minutes: 31, fieldGoalPct: 50.0, threePointPct: 40.0, freeThrowPct: 85.7, rebounds: 4, assists: 6, blocks: 0, points: 19 },
			{ gameLabel: "vs LVA", minutes: 32, fieldGoalPct: 48.1, threePointPct: 38.5, freeThrowPct: 80.0, rebounds: 5, assists: 6, blocks: 0, points: 18 },
			{ gameLabel: "@ MIN", minutes: 29, fieldGoalPct: 44.4, threePointPct: 33.3, freeThrowPct: 87.5, rebounds: 3, assists: 5, blocks: 0, points: 14 },
			{ gameLabel: "vs DAL", minutes: 31, fieldGoalPct: 52.9, threePointPct: 42.9, freeThrowPct: 83.3, rebounds: 4, assists: 6, blocks: 1, points: 20 },
			{ gameLabel: "@ NYL", minutes: 28, fieldGoalPct: 42.1, threePointPct: 35.7, freeThrowPct: 80.0, rebounds: 3, assists: 4, blocks: 0, points: 13 },
			{ gameLabel: "vs LAS", minutes: 33, fieldGoalPct: 50.0, threePointPct: 40.0, freeThrowPct: 88.9, rebounds: 5, assists: 7, blocks: 0, points: 21 },
			{ gameLabel: "@ IND", minutes: 30, fieldGoalPct: 45.0, threePointPct: 33.3, freeThrowPct: 85.7, rebounds: 4, assists: 5, blocks: 0, points: 16 },
			{ gameLabel: "vs CHI", minutes: 31, fieldGoalPct: 47.6, threePointPct: 37.5, freeThrowPct: 84.6, rebounds: 4, assists: 6, blocks: 0, points: 17 },
			{ gameLabel: "@ ATL", minutes: 30, fieldGoalPct: 46.2, threePointPct: 35.7, freeThrowPct: 86.7, rebounds: 4, assists: 5, blocks: 0, points: 16 },
		],
		teammateIds: ["jalen-carter", "mason-li", "isaiah-kane"],
	},
	{
		id: "kendra-shaw",
		name: "Kendra Shaw",
		team: "Metro Sparks",
		position: "G",
		bio: {
			birthDate: "1999-05-04",
			college: "South Carolina",
			draftInfo: "2021, R1 Pick 6",
			height: "5'11\"",
			weight: "170 lb",
			status: "Active",
		},
		basicStats: {
			games: 45,
			points: 24.0,
			rebounds: 4.8,
			assists: 7.9,
			steals: 2.0,
			blocks: 0.4,
		},
		calculatedStats: {
			trueShootingPct: 61.0,
			usagePct: 30.4,
			playerEfficiency: 24.7,
			assistToTurnover: 2.8,
		},
		splits: [
			{ label: "Last Game", minutes: 36, points: 27, rebounds: 5, assists: 8, fieldGoalPct: 50.0, threePointPct: 39.1, freeThrowPct: 90.0 },
			{ label: "Last 10", minutes: 35, points: 25.1, rebounds: 4.9, assists: 8.1, fieldGoalPct: 48.9, threePointPct: 38.2, freeThrowPct: 88.7 },
			{ label: "Home", minutes: 34, points: 24.7, rebounds: 4.9, assists: 8.0, fieldGoalPct: 49.2, threePointPct: 39.0, freeThrowPct: 89.4 },
			{ label: "Road", minutes: 35, points: 23.3, rebounds: 4.7, assists: 7.8, fieldGoalPct: 47.8, threePointPct: 37.1, freeThrowPct: 87.9 },
		],
		lastTen: [],
		teammateIds: [],
	},
	{
		id: "noah-wright",
		name: "Noah Wright",
		team: "Pacific Waves",
		position: "F",
		bio: {
			birthDate: "1996-10-22",
			college: "Kansas",
			draftInfo: "2018, R2 Pick 35",
			height: "6'7\"",
			weight: "220 lb",
			status: "Out",
		},
		basicStats: {
			games: 29,
			points: 21.8,
			rebounds: 9.1,
			assists: 3.6,
			steals: 1.2,
			blocks: 1.0,
		},
		calculatedStats: {
			trueShootingPct: 59.7,
			usagePct: 28.1,
			playerEfficiency: 22.1,
			assistToTurnover: 1.6,
		},
		splits: [
			{ label: "Last Game", minutes: 0, points: 0, rebounds: 0, assists: 0, fieldGoalPct: 0, threePointPct: 0, freeThrowPct: 0 },
			{ label: "Last 10", minutes: 0, points: 0, rebounds: 0, assists: 0, fieldGoalPct: 0, threePointPct: 0, freeThrowPct: 0 },
			{ label: "Home", minutes: 32, points: 22.1, rebounds: 9.2, assists: 3.7, fieldGoalPct: 48.4, threePointPct: 35.0, freeThrowPct: 82.1 },
			{ label: "Road", minutes: 33, points: 21.5, rebounds: 9.0, assists: 3.5, fieldGoalPct: 47.6, threePointPct: 34.2, freeThrowPct: 81.3 },
		],
		lastTen: [],
		teammateIds: [],
	},
];

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

export function getAllPlayers(): PlayerProfileData[] {
	return playerProfiles;
}

export function getPlayerById(id: string): PlayerProfileData | undefined {
	return playerProfiles.find((player) => player.id === id);
}

export function getPlayerRankings(): PlayerRankingRow[] {
	return playerProfiles
		.map((player) => ({
			id: player.id,
			name: player.name,
			team: player.team,
			position: player.position,
			games: player.basicStats.games,
			points: player.basicStats.points,
			rebounds: player.basicStats.rebounds,
			assists: player.basicStats.assists,
			trueShootingPct: player.calculatedStats.trueShootingPct,
			usagePct: player.calculatedStats.usagePct,
			efficiency: player.calculatedStats.playerEfficiency,
		}))
		.sort((a, b) => b.points - a.points);
}

export function getPlayerAge(birthDate: string): number {
	return calculateAge(birthDate);
}

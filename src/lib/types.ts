import type { State } from "@/schema/nba-scoreboard";

export interface GameTeam {
	id: string;
	uid: string | undefined;
	slug: string | undefined;
	location: string | undefined;
	name: string | undefined;
	score: string;
	logo: string | undefined;
	primaryColor: string | undefined;
	darkColor: string;
	lightColor: string;
	seasonRecord: string;
}

export interface GameData {
	id: string;
	uid: string;
	state: State;
	time: {
		start: string | undefined;
		detail: string | undefined;
	};
	away: GameTeam;
	home: GameTeam;
}

export type GamesByDateResponse = GameData[];

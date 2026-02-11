import type { League } from "@/lib/shared/league";

export const leagueRoutes: Record<League, string> = {
	nba: "/nba",
	wnba: "/wnba",
	gleague: "/gleague",
};

export const leagueGameRoutes: Record<League, string> = {
	nba: "/nba/game/$gameId",
	wnba: "/wnba/game/$gameId",
	gleague: "/gleague/game/$gameId",
};

export const leagueTeamRoutes: Record<League, string> = {
	nba: "/nba/team/$teamId",
	wnba: "/wnba/team/$teamId",
	gleague: "/gleague/team/$teamId",
};

export const leaguePlayersRoutes: Record<League, string> = {
	nba: "/nba/players",
	wnba: "/wnba/players",
	gleague: "/gleague/players",
};

export const leaguePlayerRoutes: Record<League, string> = {
	nba: "/nba/player/$id",
	wnba: "/wnba/player/$id",
	gleague: "/gleague/player/$id",
};

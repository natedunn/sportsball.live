// Re-export all shared utilities
export * from "./league";
export * from "./api-types";
export * from "./team-utils";
export * from "./games.server";
export * from "./games.queries";
export * from "./standings.server";

// Game details exports (TeamStats here is for box scores)
export type {
	TeamStats as GameBoxScoreStats,
	PlayerStats,
	Player,
	GameDetailsTeam,
	MatchupGame,
	SeasonSeries,
	GameDetails,
} from "./game-details.types";
export {
	fetchGameDetails,
	fetchWnbaGameDetails,
	fetchGLeagueGameDetails,
} from "./game-details.server";

// Team page exports (TeamStats here is for season stats)
export * from "./team.types";
export {
	fetchNbaTeamOverview,
	fetchNbaTeamRoster,
	fetchNbaTeamSchedule,
	fetchNbaTeamStats,
	fetchNbaTeamLeaders,
	fetchNbaTeamInjuries,
	fetchWnbaTeamOverview,
	fetchWnbaTeamRoster,
	fetchWnbaTeamSchedule,
	fetchWnbaTeamStats,
	fetchWnbaTeamLeaders,
	fetchWnbaTeamInjuries,
	fetchGLeagueTeamOverview,
	fetchGLeagueTeamRoster,
	fetchGLeagueTeamSchedule,
	fetchGLeagueTeamStats,
	fetchGLeagueTeamLeaders,
	fetchGLeagueTeamInjuries,
} from "./team.server";
export type {
	TeamOverview,
	RosterPlayer,
	ScheduleGame,
	TeamStats,
	TeamLeader,
	InjuredPlayer,
} from "./team.server";

// News exports
export * from "./news.server";

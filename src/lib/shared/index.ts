// Re-export all shared utilities
export * from "./league";
export * from "./api-types";
export * from "./team-utils";

// Game details types (TeamStats here is for box scores)
export type {
	TeamStats as GameBoxScoreStats,
	PlayerStats,
	Player,
	GameDetailsTeam,
	MatchupGame,
	SeasonSeries,
	GameDetails,
} from "./game-details.types";

// Team page types (TeamStats here is for season stats)
export * from "./team.types";
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

// Team injury server functions (still ESPN-direct)
export {
	fetchNbaTeamInjuries,
	fetchWnbaTeamInjuries,
	fetchGLeagueTeamInjuries,
} from "./team.server";

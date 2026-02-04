// Re-export from shared module for backwards compatibility
export { fetchWnbaGameDetails } from "@/lib/shared/game-details.server";
export type {
	TeamStats,
	PlayerStats,
	Player,
	GameDetailsTeam,
	MatchupGame,
	SeasonSeries,
	GameDetails,
} from "@/lib/shared/game-details.server";

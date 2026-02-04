// Re-export from shared module for backwards compatibility
export { fetchWnbaStandings } from "@/lib/shared/standings.server";
export type {
	StandingTeam,
	ConferenceStandings,
	StandingsResponse,
} from "@/lib/shared/standings.server";

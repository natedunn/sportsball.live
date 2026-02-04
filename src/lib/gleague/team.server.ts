// Re-export from shared module for backwards compatibility
// G-League uses unprefixed names for historical reasons
export {
	fetchGLeagueTeamOverview as fetchTeamOverview,
	fetchGLeagueTeamRoster as fetchTeamRoster,
	fetchGLeagueTeamSchedule as fetchTeamSchedule,
	fetchGLeagueTeamStats as fetchTeamStats,
	fetchGLeagueTeamLeaders as fetchTeamLeaders,
	fetchGLeagueTeamInjuries as fetchTeamInjuries,
} from "@/lib/shared/team.server";

export type {
	TeamOverview,
	RosterPlayer,
	ScheduleGame,
	TeamStats,
	TeamLeader,
	InjuredPlayer,
} from "@/lib/shared/team.server";

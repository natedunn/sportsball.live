// Re-export from shared module for backwards compatibility
// WNBA uses unprefixed names for historical reasons
export {
	fetchWnbaTeamOverview as fetchTeamOverview,
	fetchWnbaTeamRoster as fetchTeamRoster,
	fetchWnbaTeamSchedule as fetchTeamSchedule,
	fetchWnbaTeamStats as fetchTeamStats,
	fetchWnbaTeamLeaders as fetchTeamLeaders,
	fetchWnbaTeamInjuries as fetchTeamInjuries,
} from "@/lib/shared/team.server";

export type {
	TeamOverview,
	RosterPlayer,
	ScheduleGame,
	TeamStats,
	TeamLeader,
	InjuredPlayer,
} from "@/lib/shared/team.server";

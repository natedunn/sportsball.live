// Re-export from shared module for backwards compatibility
// NBA uses unprefixed names for historical reasons
export {
	fetchNbaTeamOverview as fetchTeamOverview,
	fetchNbaTeamRoster as fetchTeamRoster,
	fetchNbaTeamSchedule as fetchTeamSchedule,
	fetchNbaTeamStats as fetchTeamStats,
	fetchNbaTeamLeaders as fetchTeamLeaders,
	fetchNbaTeamInjuries as fetchTeamInjuries,
} from "@/lib/shared/team.server";

export type {
	TeamOverview,
	RosterPlayer,
	ScheduleGame,
	TeamStats,
	TeamLeader,
	InjuredPlayer,
} from "@/lib/shared/team.server";

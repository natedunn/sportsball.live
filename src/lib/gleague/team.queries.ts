import { queryOptions } from "@tanstack/react-query";
import {
  fetchTeamOverview,
  fetchTeamRoster,
  fetchTeamSchedule,
  fetchTeamStats,
  fetchTeamLeaders,
  fetchTeamInjuries,
} from "@/lib/gleague/team.server";

export const teamOverviewQueryOptions = (teamSlug: string) =>
  queryOptions({
    queryKey: ["gleague", "team", teamSlug, "overview"],
    queryFn: () => fetchTeamOverview({ data: teamSlug }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

export const teamRosterQueryOptions = (teamSlug: string) =>
  queryOptions({
    queryKey: ["gleague", "team", teamSlug, "roster"],
    queryFn: () => fetchTeamRoster({ data: teamSlug }),
    staleTime: 30 * 60 * 1000, // 30 minutes - roster doesn't change often
    gcTime: 60 * 60 * 1000, // 1 hour
  });

export const teamScheduleQueryOptions = (teamSlug: string) =>
  queryOptions({
    queryKey: ["gleague", "team", teamSlug, "schedule"],
    queryFn: () => fetchTeamSchedule({ data: teamSlug }),
    staleTime: 5 * 60 * 1000, // 5 minutes - schedule updates after games
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

export const teamStatsQueryOptions = (teamSlug: string) =>
  queryOptions({
    queryKey: ["gleague", "team", teamSlug, "stats"],
    queryFn: () => fetchTeamStats({ data: teamSlug }),
    staleTime: 30 * 60 * 1000, // 30 minutes - stats update nightly
    gcTime: 60 * 60 * 1000, // 1 hour
  });

export const teamLeadersQueryOptions = (teamSlug: string) =>
  queryOptions({
    queryKey: ["gleague", "team", teamSlug, "leaders"],
    queryFn: () => fetchTeamLeaders({ data: teamSlug }),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

export const teamInjuriesQueryOptions = (teamSlug: string) =>
  queryOptions({
    queryKey: ["gleague", "team", teamSlug, "injuries"],
    queryFn: () => fetchTeamInjuries({ data: teamSlug }),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

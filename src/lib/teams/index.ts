// Team Registry - Unified static team data across all leagues
//
// Usage:
//   import { getTeamStaticData, getAllTeams } from "@/lib/teams";
//
//   // Find by any identifier
//   const team = getTeamStaticData("gleague", "1612709914");
//   const team = getTeamStaticData("nba", "LAL");
//   const team = getTeamStaticData("wnba", ["lva", "aces"]);
//
//   // Get all teams
//   const teams = getAllTeams("nba");

export { getTeamStaticData, getAllTeams, clearTeamCache } from "./registry";
export type { League, TeamStaticData, TeamDefinition } from "./types";

// Re-export team arrays for direct access if needed
export { GLEAGUE_TEAMS } from "./gleague/teams";
export { NBA_TEAMS } from "./nba/teams";
export { WNBA_TEAMS } from "./wnba/teams";

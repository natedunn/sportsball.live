import type { League, TeamStaticData } from "./types";
import { GLEAGUE_TEAMS } from "./gleague/teams";
import { NBA_TEAMS } from "./nba/teams";
import { WNBA_TEAMS } from "./wnba/teams";

// Get teams array for a league
function getTeamsForLeague(league: League): TeamStaticData[] {
	switch (league) {
		case "nba":
			return NBA_TEAMS;
		case "wnba":
			return WNBA_TEAMS;
		case "gleague":
			return GLEAGUE_TEAMS;
	}
}

// Build lookup index for a league (lazy, cached)
type LookupIndex = Map<string, TeamStaticData>;
const indexCache = new Map<League, LookupIndex>();

function buildIndex(league: League): LookupIndex {
	const cached = indexCache.get(league);
	if (cached) return cached;

	const index: LookupIndex = new Map();
	const teams = getTeamsForLeague(league);

	for (const team of teams) {
		// Index by all possible identifiers (case-insensitive)
		const keys = [
			team.abbreviation,
			team.abbreviation.toLowerCase(),
			team.name,
			team.name.toLowerCase(),
			team.fullName,
			team.fullName.toLowerCase(),
			team.city,
			team.city.toLowerCase(),
			team.logoSlug,
			team.espn.id,
			team.espn.slug,
		];

		// Add NBA Stats API identifiers if present
		if (team.nba) {
			keys.push(team.nba.id, team.nba.slug);
		}

		// Add social handles if present
		if (team.social?.twitter) {
			keys.push(team.social.twitter, team.social.twitter.toLowerCase());
		}
		if (team.social?.instagram) {
			keys.push(team.social.instagram, team.social.instagram.toLowerCase());
		}

		for (const key of keys) {
			if (key && !index.has(key)) {
				index.set(key, team);
			}
		}
	}

	indexCache.set(league, index);
	return index;
}

/**
 * Find a team by any identifier
 * @param league - The league to search in
 * @param query - A string or array of strings to search for
 * @returns The team data or undefined if not found
 */
export function getTeamStaticData(
	league: League,
	query: string | string[],
): TeamStaticData | undefined {
	const index = buildIndex(league);
	const queries = Array.isArray(query) ? query : [query];

	for (const q of queries) {
		const team = index.get(q) || index.get(q.toLowerCase());
		if (team) return team;
	}

	return undefined;
}

/**
 * Get all teams for a league
 * @param league - The league to get teams for
 * @returns Array of all team data
 */
export function getAllTeams(league: League): TeamStaticData[] {
	return getTeamsForLeague(league);
}

/**
 * Clear the lookup cache (useful for testing or hot-reloading)
 */
export function clearTeamCache(): void {
	indexCache.clear();
}

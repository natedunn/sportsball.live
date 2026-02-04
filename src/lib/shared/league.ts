// Shared league type used throughout the application
export type League = "nba" | "wnba" | "gleague";

// Environment variable names for ESPN API endpoints
// SITE_API: Main site API (scoreboard, games, teams, news, standings, leaders)
// CORE_API: Core API (detailed injuries)
// COMMON_API: Common API (roster with player stats)

export const LEAGUE_SITE_API_VARS: Record<League, string> = {
	nba: "NBA_SITE_API",
	wnba: "WNBA_SITE_API",
	gleague: "GLEAGUE_SITE_API",
};

export const LEAGUE_CORE_API_VARS: Record<League, string> = {
	nba: "NBA_CORE_API",
	wnba: "WNBA_CORE_API",
	gleague: "GLEAGUE_CORE_API",
};

export const LEAGUE_COMMON_API_VARS: Record<League, string> = {
	nba: "NBA_COMMON_API",
	wnba: "WNBA_COMMON_API",
	gleague: "GLEAGUE_COMMON_API",
};

// Get the Site API base URL for a league
export function getLeagueSiteApi(league: League): string {
	const envVar = LEAGUE_SITE_API_VARS[league];
	const baseUrl = process.env[envVar];
	if (!baseUrl) {
		throw new Error(`${envVar} not configured`);
	}
	return baseUrl;
}

// Get the Core API base URL for a league
export function getLeagueCoreApi(league: League): string {
	const envVar = LEAGUE_CORE_API_VARS[league];
	const baseUrl = process.env[envVar];
	if (!baseUrl) {
		throw new Error(`${envVar} not configured`);
	}
	return baseUrl;
}

// Get the Common API base URL for a league
export function getLeagueCommonApi(league: League): string {
	const envVar = LEAGUE_COMMON_API_VARS[league];
	const baseUrl = process.env[envVar];
	if (!baseUrl) {
		throw new Error(`${envVar} not configured`);
	}
	return baseUrl;
}

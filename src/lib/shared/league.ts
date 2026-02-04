// Shared league type used throughout the application
export type League = "nba" | "wnba" | "gleague";

// Environment variable names for ESPN API endpoints
// SITE_API: site.api.espn.com - Main site API (scoreboard, games, teams, news, standings, leaders)
// CORE_API: sports.core.api.espn.com - Core API (detailed injuries)
// COMMON_API: site.web.api.espn.com - Common API (roster with player stats)

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

// Get the Site API base URL for a league (site.api.espn.com)
export function getLeagueSiteApi(league: League): string {
	const envVar = LEAGUE_SITE_API_VARS[league];
	const baseUrl = process.env[envVar];
	if (!baseUrl) {
		throw new Error(`${envVar} not configured`);
	}
	return baseUrl;
}

// Get the Core API base URL for a league (sports.core.api.espn.com)
export function getLeagueCoreApi(league: League): string {
	const envVar = LEAGUE_CORE_API_VARS[league];
	const baseUrl = process.env[envVar];
	if (!baseUrl) {
		throw new Error(`${envVar} not configured`);
	}
	return baseUrl;
}

// Get the Common API base URL for a league (site.web.api.espn.com)
export function getLeagueCommonApi(league: League): string {
	const envVar = LEAGUE_COMMON_API_VARS[league];
	const baseUrl = process.env[envVar];
	if (!baseUrl) {
		throw new Error(`${envVar} not configured`);
	}
	return baseUrl;
}

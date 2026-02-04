import { getTeamStaticData } from "@/lib/teams";
import { NBA_TEAM_LOGOS } from "@/lib/nba/team-logos";
import { WNBA_TEAM_LOGOS } from "@/lib/wnba/team-logos";
import { GLEAGUE_TEAM_LOGOS } from "@/lib/gleague/team-logos";
import type { League } from "./league";

// Team logo registries by league
const TEAM_LOGOS: Record<League, Record<string, string>> = {
	nba: NBA_TEAM_LOGOS,
	wnba: WNBA_TEAM_LOGOS,
	gleague: GLEAGUE_TEAM_LOGOS,
};

// Extract team ID from UID (e.g., "s:40~l:46~t:14" -> "14")
function extractTeamIdFromUid(uid: string): string | null {
	const match = uid.match(/~t:(\d+)$/);
	return match ? match[1] : null;
}

// Extract team slug from logo URL
export function getTeamSlugFromLogoUrl(
	league: League,
	url: string,
): string | null {
	const match = url.match(/\/([a-z]+)\.png$/i);
	if (match) {
		const slug = match[1].toLowerCase();
		if (TEAM_LOGOS[league][slug]) {
			return slug;
		}
	}
	return null;
}

export interface TeamColors {
	darkColor: string;
	lightColor: string;
}

// Get team colors from static data registry
export function getTeamColors(
	league: League,
	teamUid: string | undefined,
	teamId?: string | undefined,
): TeamColors {
	const identifiers: string[] = [];

	// Try extracting from UID first (ESPN format)
	if (teamUid) {
		const idFromUid = extractTeamIdFromUid(teamUid);
		if (idFromUid) identifiers.push(idFromUid);
	}

	// Add team ID if provided
	if (teamId) identifiers.push(teamId);

	// Look up team in registry
	if (identifiers.length > 0) {
		const team = getTeamStaticData(league, identifiers);
		if (team) {
			return {
				darkColor: team.colors.display.dark,
				lightColor: team.colors.display.light,
			};
		}
	}

	return { darkColor: "000000", lightColor: "000000" };
}

// Get proxied logo URL for a team
export function getProxiedLogoUrl(
	league: League,
	logoUrl: string | undefined,
	teamId?: string | undefined,
): string | undefined {
	// Try extracting slug from logo URL first (ESPN logo URLs)
	if (logoUrl) {
		const slug = getTeamSlugFromLogoUrl(league, logoUrl);
		if (slug) {
			return `/api/${league}/logo/${slug}`;
		}
	}

	// Try finding team by ID and use logoSlug
	if (teamId) {
		const team = getTeamStaticData(league, teamId);
		if (team) {
			return `/api/${league}/logo/${team.logoSlug}`;
		}
	}

	return undefined;
}

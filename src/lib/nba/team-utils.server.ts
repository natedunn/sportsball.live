import { getTeamStaticData } from "@/lib/teams";
import { getTeamSlugFromLogoUrl } from "./team-logos";

// Extract team ID from UID (e.g., "s:40~l:46~t:14" -> "14")
function extractTeamIdFromUid(uid: string): string | null {
	const match = uid.match(/~t:(\d+)$/);
	return match ? match[1] : null;
}

export function getTeamColors(
	teamUid: string | undefined,
	teamId?: string | undefined,
) {
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
		const team = getTeamStaticData("nba", identifiers);
		if (team) {
			return {
				darkColor: team.colors.display.dark,
				lightColor: team.colors.display.light,
			};
		}
	}

	return { darkColor: "000000", lightColor: "000000" };
}

export function getProxiedLogoUrl(
	logoUrl: string | undefined,
	teamId?: string | undefined,
): string | undefined {
	// Try extracting slug from logo URL first (ESPN logo URLs)
	if (logoUrl) {
		const slug = getTeamSlugFromLogoUrl(logoUrl);
		if (slug) {
			return `/api/nba/logo/${slug}`;
		}
	}

	// Try finding team by ID and use logoSlug
	if (teamId) {
		const team = getTeamStaticData("nba", teamId);
		if (team) {
			return `/api/nba/logo/${team.logoSlug}`;
		}
	}

	return undefined;
}

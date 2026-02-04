import {
	getTeamColors as sharedGetTeamColors,
	getProxiedLogoUrl as sharedGetProxiedLogoUrl,
} from "@/lib/shared/team-utils";

// Re-export with league pre-filled for backwards compatibility
export function getTeamColors(
	teamUid: string | undefined,
	teamId?: string | undefined,
) {
	return sharedGetTeamColors("nba", teamUid, teamId);
}

export function getProxiedLogoUrl(
	logoUrl: string | undefined,
	teamId?: string | undefined,
): string | undefined {
	return sharedGetProxiedLogoUrl("nba", logoUrl, teamId);
}

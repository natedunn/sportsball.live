import { getTeamSlugFromLogoUrl, NBA_TEAM_LOGOS } from "./team-logos";

// NBA team color and logo configuration
const nbaTeamsConfig = [
	{ id: "1", slug: "atl", darkColor: "c8102e", lightColor: "c8102e" }, // Atlanta Hawks
	{ id: "2", slug: "bos", darkColor: "008348", lightColor: "008348" }, // Boston Celtics
	{ id: "17", slug: "bkn", darkColor: "FFFFFF", lightColor: "000000" }, // Brooklyn Nets
	{ id: "30", slug: "cha", darkColor: "008ca8", lightColor: "008ca8" }, // Charlotte Hornets
	{ id: "4", slug: "chi", darkColor: "ce1141", lightColor: "ce1141" }, // Chicago Bulls
	{ id: "5", slug: "cle", darkColor: "CB9558", lightColor: "860038" }, // Cleveland Cavaliers
	{ id: "6", slug: "dal", darkColor: "0064b1", lightColor: "0064b1" }, // Dallas Mavericks
	{ id: "7", slug: "den", darkColor: "FEC524", lightColor: "0E2240" }, // Denver Nuggets
	{ id: "8", slug: "det", darkColor: "C8102E", lightColor: "1d42ba" }, // Detroit Pistons
	{ id: "9", slug: "gs", darkColor: "fdb927", lightColor: "fdb927" }, // Golden State Warriors
	{ id: "10", slug: "hou", darkColor: "ce1141", lightColor: "ce1141" }, // Houston Rockets
	{ id: "11", slug: "ind", darkColor: "FDBB30", lightColor: "002D62" }, // Indiana Pacers
	{ id: "12", slug: "lac", darkColor: "BEC0C2", lightColor: "1d428a" }, // LA Clippers
	{ id: "13", slug: "lal", darkColor: "FDB927", lightColor: "552583" }, // LA Lakers
	{ id: "29", slug: "mem", darkColor: "5d76a9", lightColor: "5d76a9" }, // Memphis Grizzlies
	{ id: "14", slug: "mia", darkColor: "98002e", lightColor: "98002e" }, // Miami Heat
	{ id: "15", slug: "mil", darkColor: "EEE1C6", lightColor: "00471b" }, // Milwaukee Bucks
	{ id: "16", slug: "min", darkColor: "266092", lightColor: "266092" }, // Minnesota Timberwolves
	{ id: "3", slug: "no", darkColor: "85714D", lightColor: "0C2340" }, // New Orleans Pelicans
	{ id: "18", slug: "ny", darkColor: "F58426", lightColor: "006BB6" }, // New York Knicks
	{ id: "25", slug: "okc", darkColor: "007ac1", lightColor: "007ac1" }, // Oklahoma City Thunder
	{ id: "19", slug: "orl", darkColor: "0077c0", lightColor: "0077c0" }, // Orlando Magic
	{ id: "20", slug: "phi", darkColor: "006bb6", lightColor: "1d428a" }, // Philadelphia 76ers
	{ id: "21", slug: "phx", darkColor: "e56020", lightColor: "1d1160" }, // Phoenix Suns
	{ id: "22", slug: "por", darkColor: "e03a3e", lightColor: "e03a3e" }, // Portland Trail Blazers
	{ id: "23", slug: "sac", darkColor: "63727A", lightColor: "5a2d81" }, // Sacramento Kings
	{ id: "24", slug: "sa", darkColor: "c4ced4", lightColor: "000000" }, // San Antonio Spurs
	{ id: "28", slug: "tor", darkColor: "d91244", lightColor: "d91244" }, // Toronto Raptors
	{ id: "26", slug: "utah", darkColor: "FFFFFF", lightColor: "002B5C" }, // Utah Jazz
	{ id: "27", slug: "wsh", darkColor: "e31837", lightColor: "e31837" }, // Washington Wizards
];

// Extract team ID from UID (e.g., "s:40~l:46~t:14" -> "14")
function extractTeamIdFromUid(uid: string): string | null {
	const match = uid.match(/~t:(\d+)$/);
	return match ? match[1] : null;
}

export function getTeamColors(
	teamUid: string | undefined,
	teamId?: string | undefined,
) {
	// Try matching by extracting ID from UID first
	if (teamUid) {
		const idFromUid = extractTeamIdFromUid(teamUid);
		if (idFromUid) {
			const team = nbaTeamsConfig.find((t) => t.id === idFromUid);
			if (team) {
				return { darkColor: team.darkColor, lightColor: team.lightColor };
			}
		}
	}

	// Fallback to plain team ID
	if (teamId) {
		const team = nbaTeamsConfig.find((t) => t.id === teamId);
		if (team) {
			return { darkColor: team.darkColor, lightColor: team.lightColor };
		}
	}

	return { darkColor: "000000", lightColor: "000000" };
}

// Get team config by ID for logo lookup
function getTeamConfigById(
	teamId: string | undefined,
): (typeof nbaTeamsConfig)[0] | undefined {
	if (!teamId) return undefined;
	return nbaTeamsConfig.find((t) => t.id === teamId);
}

export function getProxiedLogoUrl(
	logoUrl: string | undefined,
	teamId?: string | undefined,
): string | undefined {
	// Try extracting slug from logo URL first
	if (logoUrl) {
		const slug = getTeamSlugFromLogoUrl(logoUrl);
		if (slug) {
			return `/api/nba/logo/${slug}`;
		}
	}

	// Fallback to team ID lookup
	if (teamId) {
		const teamConfig = getTeamConfigById(teamId);
		if (teamConfig && NBA_TEAM_LOGOS[teamConfig.slug]) {
			return `/api/nba/logo/${teamConfig.slug}`;
		}
	}

	return undefined;
}

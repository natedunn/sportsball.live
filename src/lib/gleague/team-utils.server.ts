import { getTeamSlugFromLogoUrl, GLEAGUE_TEAM_LOGOS } from "./team-logos";

// G-League team color and logo configuration
const gleagueTeamsConfig = [
	{ id: "2", slug: "aus", darkColor: "C4CED4", lightColor: "000000" }, // Austin Spurs
	{ id: "6", slug: "bir", darkColor: "002A5C", lightColor: "b4975a" }, // Birmingham Squadron
	{ id: "4", slug: "cap", darkColor: "002B5C", lightColor: "E31837" }, // Capital City Go-Go
	{ id: "3", slug: "clc", darkColor: "061642", lightColor: "fdbb30" }, // Cleveland Charge
	{ id: "28", slug: "cps", darkColor: "000000", lightColor: "b3042a" }, // College Park Skyhawks
	{ id: "5", slug: "del", darkColor: "003DA6", lightColor: "DD0031" }, // Delaware Blue Coats
	{ id: "123432", slug: "gli", darkColor: "1D428A", lightColor: "FDB927" }, // G League Ignite
	{ id: "129829", slug: "utd", darkColor: "1D428A", lightColor: "FDB927" }, // G League United
	{ id: "8", slug: "grd", darkColor: "C8102E", lightColor: "1D428A" }, // Grand Rapids Gold
	{ id: "9", slug: "gbo", darkColor: "007BBC", lightColor: "1D1160" }, // Greensboro Swarm
	{ id: "10", slug: "iwa", darkColor: "0C2340", lightColor: "236192" }, // Iowa Wolves
	{ id: "12", slug: "lin", darkColor: "006BB6", lightColor: "ED174C" }, // Long Island Nets
	{ id: "129830", slug: "mega", darkColor: "1D428A", lightColor: "FDB927" }, // MEGA MIS
	{ id: "13", slug: "mne", darkColor: "006532", lightColor: "f1f2f3" }, // Maine Celtics
	{ id: "14", slug: "mhu", darkColor: "E2231A", lightColor: "717271" }, // Memphis Hustle
	{ id: "124612", slug: "mxc", darkColor: "3A4C98", lightColor: "ffffff" }, // Mexico City Capitanes
	{ id: "15", slug: "mcc", darkColor: "FA002C", lightColor: "006bb6" }, // Motor City Cruise
	{ id: "7", slug: "nob", darkColor: "002D62", lightColor: "FDBB30" }, // Noblesville Boom
	{ id: "16", slug: "okl", darkColor: "007AC1", lightColor: "EF3B24" }, // Oklahoma City Blue
	{ id: "11", slug: "osc", darkColor: "0077C0", lightColor: "0077C0" }, // Osceola Magic
	{ id: "17", slug: "rap", darkColor: "CE1141", lightColor: "000000" }, // Raptors 905
	{ id: "18", slug: "rgv", darkColor: "CE1141", lightColor: "BEC0C2" }, // Rio Grande Valley Vipers
	{ id: "128019", slug: "rcity", darkColor: "E03A3E", lightColor: "000000" }, // Rip City Remix
	{ id: "19", slug: "slc", darkColor: "002B5C", lightColor: "F9A01B" }, // Salt Lake City Stars
	{ id: "1", slug: "san", darkColor: "C8102E", lightColor: "1D428A" }, // San Diego Clippers
	{ id: "20", slug: "scw", darkColor: "006BB6", lightColor: "FDB927" }, // Santa Cruz Warriors
	{ id: "21", slug: "sxf", darkColor: "98002E", lightColor: "98002E" }, // Sioux Falls Skyforce
	{ id: "22", slug: "sbl", darkColor: "552583", lightColor: "FDB927" }, // South Bay Lakers
	{ id: "23", slug: "sto", darkColor: "5A2D81", lightColor: "000000" }, // Stockton Kings
	{ id: "24", slug: "tex", darkColor: "0053BC", lightColor: "00285E" }, // Texas Legends
	{ id: "129713", slug: "valley", darkColor: "E56020", lightColor: "1D1160" }, // Valley Suns
	{ id: "25", slug: "wes", darkColor: "006BB6", lightColor: "F58426" }, // Westchester Knicks
	{ id: "26", slug: "wcb", darkColor: "CE1141", lightColor: "000000" }, // Windy City Bulls
	{ id: "27", slug: "wis", darkColor: "00471B", lightColor: "EEE1C6" }, // Wisconsin Herd
];

// Extract team ID from UID (e.g., "s:40~l:181~t:17" -> "17")
function extractTeamIdFromUid(uid: string): string | null {
	const match = uid.match(/~t:(\d+)$/);
	return match ? match[1] : null;
}

export function getTeamColors(
	teamUid: string | undefined,
	teamId?: string | undefined,
) {
	// Try matching by full UID first
	if (teamUid) {
		const idFromUid = extractTeamIdFromUid(teamUid);
		if (idFromUid) {
			const team = gleagueTeamsConfig.find((t) => t.id === idFromUid);
			if (team) {
				return { darkColor: team.darkColor, lightColor: team.lightColor };
			}
		}
	}

	// Fallback to plain team ID
	if (teamId) {
		const team = gleagueTeamsConfig.find((t) => t.id === teamId);
		if (team) {
			return { darkColor: team.darkColor, lightColor: team.lightColor };
		}
	}

	return { darkColor: "000000", lightColor: "000000" };
}

// Get team config by ID for logo lookup
function getTeamConfigById(
	teamId: string | undefined,
): (typeof gleagueTeamsConfig)[0] | undefined {
	if (!teamId) return undefined;
	return gleagueTeamsConfig.find((t) => t.id === teamId);
}

export function getProxiedLogoUrl(
	logoUrl: string | undefined,
	teamId?: string | undefined,
): string | undefined {
	// Try extracting slug from logo URL first
	if (logoUrl) {
		const slug = getTeamSlugFromLogoUrl(logoUrl);
		if (slug) {
			return `/api/gleague/logo/${slug}`;
		}
	}

	// Fallback to team ID lookup
	if (teamId) {
		const teamConfig = getTeamConfigById(teamId);
		if (teamConfig && GLEAGUE_TEAM_LOGOS[teamConfig.slug]) {
			return `/api/gleague/logo/${teamConfig.slug}`;
		}
	}

	return undefined;
}

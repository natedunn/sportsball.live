import { getTeamSlugFromLogoUrl, WNBA_TEAM_LOGOS } from "./team-logos";

// WNBA team color and logo configuration
const wnbaTeamsConfig = [
  { id: "20", slug: "atl", darkColor: "e31837", lightColor: "5091cc" }, // Atlanta Dream
  { id: "19", slug: "chi", darkColor: "5091cd", lightColor: "ffd520" }, // Chicago Sky
  { id: "18", slug: "con", darkColor: "f05023", lightColor: "0a2240" }, // Connecticut Sun
  { id: "3", slug: "dal", darkColor: "002b5c", lightColor: "c4d600" }, // Dallas Wings
  { id: "5", slug: "ind", darkColor: "002d62", lightColor: "e03a3e" }, // Indiana Fever
  { id: "17", slug: "lv", darkColor: "a7a8aa", lightColor: "000000" }, // Las Vegas Aces
  { id: "6", slug: "la", darkColor: "552583", lightColor: "fdb927" }, // Los Angeles Sparks
  { id: "8", slug: "min", darkColor: "266092", lightColor: "79bc43" }, // Minnesota Lynx
  { id: "9", slug: "ny", darkColor: "86cebc", lightColor: "000000" }, // New York Liberty
  { id: "11", slug: "phx", darkColor: "3c286e", lightColor: "fa4b0a" }, // Phoenix Mercury
  { id: "14", slug: "sea", darkColor: "2c5235", lightColor: "fee11a" }, // Seattle Storm
  { id: "16", slug: "wsh", darkColor: "e03a3e", lightColor: "002b5c" }, // Washington Mystics
  { id: "129689", slug: "gs", darkColor: "b38fcf", lightColor: "000000" }, // Golden State Valkyries
];

// Extract team ID from UID (e.g., "s:40~l:59~t:14" -> "14")
function extractTeamIdFromUid(uid: string): string | null {
  const match = uid.match(/~t:(\d+)$/);
  return match ? match[1] : null;
}

export function getTeamColors(teamUid: string | undefined, teamId?: string | undefined) {
  // Try matching by full UID first
  if (teamUid) {
    const idFromUid = extractTeamIdFromUid(teamUid);
    if (idFromUid) {
      const team = wnbaTeamsConfig.find((t) => t.id === idFromUid);
      if (team) {
        return { darkColor: team.darkColor, lightColor: team.lightColor };
      }
    }
  }

  // Fallback to plain team ID
  if (teamId) {
    const team = wnbaTeamsConfig.find((t) => t.id === teamId);
    if (team) {
      return { darkColor: team.darkColor, lightColor: team.lightColor };
    }
  }

  return { darkColor: "000000", lightColor: "000000" };
}

// Get team config by ID for logo lookup
function getTeamConfigById(teamId: string | undefined): typeof wnbaTeamsConfig[0] | undefined {
  if (!teamId) return undefined;
  return wnbaTeamsConfig.find((t) => t.id === teamId);
}

export function getProxiedLogoUrl(
  logoUrl: string | undefined,
  teamId?: string | undefined,
): string | undefined {
  // Try extracting slug from logo URL first
  if (logoUrl) {
    const slug = getTeamSlugFromLogoUrl(logoUrl);
    if (slug) {
      return `/api/wnba/logo/${slug}`;
    }
  }

  // Fallback to team ID lookup
  if (teamId) {
    const teamConfig = getTeamConfigById(teamId);
    if (teamConfig && WNBA_TEAM_LOGOS[teamConfig.slug]) {
      return `/api/wnba/logo/${teamConfig.slug}`;
    }
  }

  return undefined;
}

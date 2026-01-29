// Static mapping of NBA team slugs to logo URLs

export const NBA_TEAM_LOGOS: Record<string, string> = {
  // Using team abbreviations as IDs
  "atl": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/atl.png",
  "bos": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/bos.png",
  "bkn": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/bkn.png",
  "cha": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/cha.png",
  "chi": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/chi.png",
  "cle": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/cle.png",
  "dal": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/dal.png",
  "den": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/den.png",
  "det": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/det.png",
  "gs": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/gs.png",
  "hou": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/hou.png",
  "ind": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/ind.png",
  "lac": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/lac.png",
  "lal": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/lal.png",
  "mem": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/mem.png",
  "mia": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/mia.png",
  "mil": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/mil.png",
  "min": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/min.png",
  "no": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/no.png",
  "ny": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/ny.png",
  "okc": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/okc.png",
  "orl": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/orl.png",
  "phi": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/phi.png",
  "phx": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/phx.png",
  "por": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/por.png",
  "sac": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/sac.png",
  "sa": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/sa.png",
  "tor": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/tor.png",
  "utah": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/utah.png",
  "wsh": "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/wsh.png",
};

// Extract team slug from logo URL
export function getTeamSlugFromLogoUrl(url: string): string | null {
  // Handle multiple URL formats:
  // - /scoreboard/sac.png
  // - /nba/500/sac.png
  // - /nba/sac.png
  const match = url.match(/\/([a-z]+)\.png$/i);
  if (match) {
    const slug = match[1].toLowerCase();
    // Verify it's a known team slug
    if (NBA_TEAM_LOGOS[slug]) {
      return slug;
    }
  }
  return null;
}

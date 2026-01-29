// Static mapping of WNBA team slugs to logo URLs

export const WNBA_TEAM_LOGOS: Record<string, string> = {
  "atl": "https://a.espncdn.com/i/teamlogos/wnba/500/atl.png",
  "chi": "https://a.espncdn.com/i/teamlogos/wnba/500/chi.png",
  "con": "https://a.espncdn.com/i/teamlogos/wnba/500/con.png",
  "dal": "https://a.espncdn.com/i/teamlogos/wnba/500/dal.png",
  "ind": "https://a.espncdn.com/i/teamlogos/wnba/500/ind.png",
  "lv": "https://a.espncdn.com/i/teamlogos/wnba/500/lv.png",
  "la": "https://a.espncdn.com/i/teamlogos/wnba/500/la.png",
  "min": "https://a.espncdn.com/i/teamlogos/wnba/500/min.png",
  "ny": "https://a.espncdn.com/i/teamlogos/wnba/500/ny.png",
  "phx": "https://a.espncdn.com/i/teamlogos/wnba/500/phx.png",
  "sea": "https://a.espncdn.com/i/teamlogos/wnba/500/sea.png",
  "wsh": "https://a.espncdn.com/i/teamlogos/wnba/500/wsh.png",
  "gs": "https://a.espncdn.com/i/teamlogos/wnba/500/gs.png",
};

// Extract team slug from logo URL
export function getTeamSlugFromLogoUrl(url: string): string | null {
  const match = url.match(/\/([a-z]+)\.png$/i);
  if (match) {
    const slug = match[1].toLowerCase();
    if (WNBA_TEAM_LOGOS[slug]) {
      return slug;
    }
  }
  return null;
}

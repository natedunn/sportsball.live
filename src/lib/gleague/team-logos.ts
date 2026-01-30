// Static mapping of G-League team slugs to logo URLs

export const GLEAGUE_TEAM_LOGOS: Record<string, string> = {
  "aus": "https://a.espncdn.com/i/teamlogos/nba-development/500/aus.png",
  "bir": "https://a.espncdn.com/i/teamlogos/nba-development/500/bir.png",
  "cap": "https://a.espncdn.com/i/teamlogos/nba-development/500/cap.png",
  "clc": "https://a.espncdn.com/i/teamlogos/nba-development/500/clc.png",
  "cps": "https://a.espncdn.com/i/teamlogos/nba-development/500/cps.png",
  "del": "https://a.espncdn.com/i/teamlogos/nba-development/500/del.png",
  "gli": "https://a.espncdn.com/i/teamlogos/nba-development/500/gli.png",
  "grd": "https://a.espncdn.com/i/teamlogos/nba-development/500/grd.png",
  "gbo": "https://a.espncdn.com/i/teamlogos/nba-development/500/gbo.png",
  "iwa": "https://a.espncdn.com/i/teamlogos/nba-development/500/iwa.png",
  "lin": "https://a.espncdn.com/i/teamlogos/nba-development/500/lin.png",
  "mne": "https://a.espncdn.com/i/teamlogos/nba-development/500/mne.png",
  "mhu": "https://a.espncdn.com/i/teamlogos/nba-development/500/mhu.png",
  "mxc": "https://a.espncdn.com/i/teamlogos/nba-development/500/mxc.png",
  "mcc": "https://a.espncdn.com/i/teamlogos/nba-development/500/mcc.png",
  // "nob" - Noblesville Boom (rebranded from Mad Ants in 2025) - not yet on ESPN CDN
  "okl": "https://a.espncdn.com/i/teamlogos/nba-development/500/okl.png",
  "osc": "https://a.espncdn.com/i/teamlogos/nba-development/500/osc.png",
  "rap": "https://a.espncdn.com/i/teamlogos/nba-development/500/rap.png",
  "rgv": "https://a.espncdn.com/i/teamlogos/nba-development/500/rgv.png",
  "rcity": "https://a.espncdn.com/i/teamlogos/nba-development/500/rcity.png",
  "slc": "https://a.espncdn.com/i/teamlogos/nba-development/500/slc.png",
  "san": "https://a.espncdn.com/i/teamlogos/nba-development/500/san.png",
  "scw": "https://a.espncdn.com/i/teamlogos/nba-development/500/scw.png",
  "sxf": "https://a.espncdn.com/i/teamlogos/nba-development/500/sxf.png",
  "sbl": "https://a.espncdn.com/i/teamlogos/nba-development/500/sbl.png",
  "sto": "https://a.espncdn.com/i/teamlogos/nba-development/500/sto.png",
  "tex": "https://a.espncdn.com/i/teamlogos/nba-development/500/tex.png",
  "valley": "https://a.espncdn.com/i/teamlogos/nba-development/500/valley.png",
  "wes": "https://a.espncdn.com/i/teamlogos/nba-development/500/wes.png",
  "wcb": "https://a.espncdn.com/i/teamlogos/nba-development/500/wcb.png",
  "wis": "https://a.espncdn.com/i/teamlogos/nba-development/500/wis.png",
};

// Extract team slug from logo URL
export function getTeamSlugFromLogoUrl(url: string): string | null {
  const match = url.match(/\/([a-z]+)\.png$/i);
  if (match) {
    const slug = match[1].toLowerCase();
    if (GLEAGUE_TEAM_LOGOS[slug]) {
      return slug;
    }
  }
  return null;
}

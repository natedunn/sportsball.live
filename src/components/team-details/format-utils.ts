/**
 * Shared formatting utilities for team details components
 */

/** Format a number with specified decimal places, returns "—" for invalid values */
export function fmt(value: number | undefined | null, decimals = 1): string {
  if (value === undefined || value === null || isNaN(value)) return "—";
  return value.toFixed(decimals);
}

/** Format a percentage value, returns "—" for invalid values */
export function fmtPct(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

/** Format a plus/minus value with sign, returns "—" for invalid values */
export function fmtPlusMinus(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "—";
  return value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

/** Get ordinal suffix for a number (e.g. 1st, 2nd, 3rd, 4th) */
export function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export type RankTier = "top" | "bottom";

/**
 * Top third of the league (green) or bottom sixth (red), so every league gets the
 * same share: NBA and G League top 10 / bottom 5, WNBA top 5 / bottom 3.
 * Without a team count, falls back to top ten and no bottom tier.
 */
export function getRankTier(
  rank: number | undefined,
  teamCount: number | undefined,
): RankTier | undefined {
  if (rank === undefined || rank <= 0) return undefined;
  if (teamCount === undefined || teamCount <= 0) return rank <= 10 ? "top" : undefined;
  if (rank <= Math.round(teamCount / 3)) return "top";
  if (rank > teamCount - Math.round(teamCount / 6)) return "bottom";
  return undefined;
}

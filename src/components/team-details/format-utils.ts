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

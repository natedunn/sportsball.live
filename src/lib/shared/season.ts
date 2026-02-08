/**
 * Get the current NBA/WNBA/G-League season string (e.g., "2025-26").
 * Mirrors the logic in src/convex/shared/seasonHelpers.ts for client-side use.
 */
export function getCurrentSeason(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth(); // 0-indexed

	// NBA/G-League: season starts in October
	// If we're in Jan-June, the season started last year
	const startYear = month < 7 ? year - 1 : year;
	const endYear = startYear + 1;
	return `${startYear}-${String(endYear).slice(-2)}`;
}

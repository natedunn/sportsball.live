// Season detection, date formatting, and shared utilities for Convex functions

/**
 * Get the current NBA/WNBA/G-League season string (e.g., "2025-26").
 * NBA/G-League seasons span two calendar years (Oct-June).
 * WNBA seasons are single-year (May-Oct) but we use the same format for consistency.
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

/**
 * Get today's date in YYYYMMDD format (UTC).
 */
export function getTodayDateUTC(): string {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = String(now.getUTCMonth() + 1).padStart(2, "0");
	const day = String(now.getUTCDate()).padStart(2, "0");
	return `${year}${month}${day}`;
}

/**
 * Format a Date or timestamp to YYYYMMDD string (UTC).
 */
export function formatGameDate(date: Date | number): string {
	const d = typeof date === "number" ? new Date(date) : date;
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${year}${month}${day}`;
}

/**
 * Map API provider game status state to our eventStatus enum.
 */
export function mapApiStateToEventStatus(
	state: string | undefined,
	detail?: string,
): "scheduled" | "in_progress" | "halftime" | "end_of_period" | "overtime" | "completed" | "postponed" | "cancelled" {
	if (!state) return "scheduled";

	switch (state) {
		case "pre":
			return "scheduled";
		case "in": {
			const detailLower = detail?.toLowerCase() ?? "";
			if (detailLower.includes("halftime")) return "halftime";
			if (detailLower.includes("end of")) return "end_of_period";
			if (detailLower.includes("overtime") || detailLower.includes(" ot")) return "overtime";
			return "in_progress";
		}
		case "post":
			return "completed";
		default:
			if (state === "postponed") return "postponed";
			if (state === "cancelled") return "cancelled";
			return "scheduled";
	}
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate YYYYMMDD date strings from startDate to endDate (inclusive).
 */
export function getDateRange(startDate: string, endDate: string): string[] {
	const dates: string[] = [];
	const start = new Date(
		parseInt(startDate.slice(0, 4), 10),
		parseInt(startDate.slice(4, 6), 10) - 1,
		parseInt(startDate.slice(6, 8), 10),
	);
	const end = new Date(
		parseInt(endDate.slice(0, 4), 10),
		parseInt(endDate.slice(4, 6), 10) - 1,
		parseInt(endDate.slice(6, 8), 10),
	);

	for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const dd = String(d.getDate()).padStart(2, "0");
		dates.push(`${yyyy}${mm}${dd}`);
	}

	return dates;
}

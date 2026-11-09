import { INJURY_REPORT_MAX_AGE_MS } from "@/lib/shared/convex-adapters";

export interface PlayerInjuryReport {
	/** When the league's report was last refreshed; null if it never has been */
	updatedAt: number | null;
	injury: {
		status: string;
		description?: string;
		shortComment?: string;
	} | null;
}

export interface PlayerStatus {
	/** "Active", or ESPN's report status ("Out", "Day-To-Day", ...) */
	label: string;
	description?: string;
	comment?: string;
}

/**
 * What to say about a player's availability, or null when the league's injury
 * report is missing or out of date: not being listed on an old report doesn't
 * make them active.
 */
export function playerStatus(
	report: PlayerInjuryReport | undefined,
	now: number = Date.now(),
): PlayerStatus | null {
	if (report?.updatedAt == null || now - report.updatedAt > INJURY_REPORT_MAX_AGE_MS) {
		return null;
	}
	if (!report.injury) return { label: "Active" };
	return {
		label: report.injury.status,
		description: report.injury.description,
		comment: report.injury.shortComment,
	};
}

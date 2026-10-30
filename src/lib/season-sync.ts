import { formatDistanceToNow } from "date-fns";

export type SeasonSyncStatus = {
	lastAttemptAt: number | null;
	lastSuccessAt: number | null;
	lastError: string | null;
};

/**
 * Why a league's ESPN season sync needs attention: the last attempt failed,
 * it has never run, or its last success is older than `staleAfterMs`.
 * Null when the season dates are current.
 */
export function getSeasonSyncProblem(
	status: SeasonSyncStatus,
	staleAfterMs: number,
	now = Date.now(),
): string | null {
	const lastFailed =
		status.lastError !== null &&
		(status.lastSuccessAt === null ||
			(status.lastAttemptAt ?? 0) > status.lastSuccessAt);
	if (lastFailed) return `The last ESPN sync failed: ${status.lastError}`;

	if (status.lastSuccessAt === null) {
		return "Season dates haven't been fetched from ESPN yet.";
	}
	if (now - status.lastSuccessAt > staleAfterMs) {
		return `Season dates were last fetched from ESPN ${formatDistanceToNow(status.lastSuccessAt, { addSuffix: true })}, so the daily sync may have stopped.`;
	}
	return null;
}

import { describe, it, expect } from "vitest";
import { getSeasonSyncProblem } from "@/lib/season-sync";

const HOUR = 60 * 60 * 1000;
const STALE_AFTER = 36 * HOUR;
const now = Date.UTC(2026, 9, 30, 12, 0, 0);

describe("getSeasonSyncProblem", () => {
	it("is fine after a recent successful sync", () => {
		expect(
			getSeasonSyncProblem(
				{ lastAttemptAt: now - 3 * HOUR, lastSuccessAt: now - 3 * HOUR, lastError: null },
				STALE_AFTER,
				now,
			),
		).toBeNull();
	});

	it("warns when the sync has never run", () => {
		expect(
			getSeasonSyncProblem({ lastAttemptAt: null, lastSuccessAt: null, lastError: null }, STALE_AFTER, now),
		).toMatch(/haven't been fetched/);
	});

	it("warns when the last success is older than the threshold", () => {
		expect(
			getSeasonSyncProblem(
				{ lastAttemptAt: now - 50 * HOUR, lastSuccessAt: now - 50 * HOUR, lastError: null },
				STALE_AFTER,
				now,
			),
		).toMatch(/daily sync may have stopped/);
	});

	it("reports the error when the latest attempt failed", () => {
		expect(
			getSeasonSyncProblem(
				{ lastAttemptAt: now - HOUR, lastSuccessAt: now - 25 * HOUR, lastError: "ESPN request failed (500)" },
				STALE_AFTER,
				now,
			),
		).toBe("The last ESPN sync failed: ESPN request failed (500)");
	});
});

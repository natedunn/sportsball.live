import { describe, expect, it } from "vitest";
import { INJURY_REPORT_MAX_AGE_MS } from "@/lib/shared/convex-adapters";
import { playerStatus } from "./player-status";

const NOW = 1_800_000_000_000;

describe("playerStatus", () => {
	it("is active when a fresh report doesn't list the player", () => {
		expect(playerStatus({ updatedAt: NOW - 1000, injury: null }, NOW)).toEqual({ label: "Active" });
	});

	it("uses the report's status for a listed player", () => {
		const injury = { status: "Out", description: "Left Shoulder Surgery", shortComment: "Out for months." };
		expect(playerStatus({ updatedAt: NOW - 1000, injury }, NOW)).toEqual({
			label: "Out",
			description: "Left Shoulder Surgery",
			comment: "Out for months.",
		});
	});

	it("says nothing when the report is missing or out of date", () => {
		expect(playerStatus(undefined, NOW)).toBeNull();
		expect(playerStatus({ updatedAt: null, injury: null }, NOW)).toBeNull();
		expect(
			playerStatus({ updatedAt: NOW - INJURY_REPORT_MAX_AGE_MS - 1, injury: null }, NOW),
		).toBeNull();
	});
});

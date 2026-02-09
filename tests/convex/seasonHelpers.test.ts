import { describe, it, expect } from "vitest";
import { formatGameDate, getTodayDate, getCurrentSeason } from "@convex/shared/seasonHelpers";

describe("formatGameDate", () => {
	it("returns ET date for a late-night ET game (3 AM UTC = 10 PM ET previous day)", () => {
		// Feb 10 2025, 3:00 AM UTC = Feb 9 2025, 10:00 PM ET (EST)
		const utcTimestamp = Date.UTC(2025, 1, 10, 3, 0, 0);
		expect(formatGameDate(utcTimestamp)).toBe("20250209");
	});

	it("returns ET date for an afternoon ET game", () => {
		// Feb 9 2025, 8:00 PM UTC = Feb 9 2025, 3:00 PM ET (EST)
		const utcTimestamp = Date.UTC(2025, 1, 9, 20, 0, 0);
		expect(formatGameDate(utcTimestamp)).toBe("20250209");
	});

	it("handles EDT (summer) correctly", () => {
		// Jul 15 2025, 3:00 AM UTC = Jul 14 2025, 11:00 PM EDT
		const utcTimestamp = Date.UTC(2025, 6, 15, 3, 0, 0);
		expect(formatGameDate(utcTimestamp)).toBe("20250714");
	});

	it("handles midnight boundary in ET", () => {
		// Feb 10 2025, 5:00 AM UTC = Feb 10 2025, 12:00 AM ET (EST)
		const utcTimestamp = Date.UTC(2025, 1, 10, 5, 0, 0);
		expect(formatGameDate(utcTimestamp)).toBe("20250210");
	});

	it("accepts a Date object", () => {
		const date = new Date(Date.UTC(2025, 1, 10, 3, 0, 0));
		expect(formatGameDate(date)).toBe("20250209");
	});
});

describe("getTodayDate", () => {
	it("returns a valid YYYYMMDD string", () => {
		const result = getTodayDate();
		expect(result).toMatch(/^\d{8}$/);
	});
});

describe("getCurrentSeason", () => {
	it("returns a season string in YYYY-YY format", () => {
		const result = getCurrentSeason();
		expect(result).toMatch(/^\d{4}-\d{2}$/);
	});
});

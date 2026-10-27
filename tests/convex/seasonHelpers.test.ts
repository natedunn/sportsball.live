import { describe, it, expect } from "vitest";
import {
	compareSeasons,
	formatGameDate,
	getCurrentSeason,
	getTodayDate,
	parseEspnSeason,
	seasonFromEspnYear,
} from "@convex/shared/seasonHelpers";

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

describe("seasonFromEspnYear", () => {
	it("maps ESPN's end year to a two-year season for NBA and G-League", () => {
		expect(seasonFromEspnYear("nba", 2027)).toBe("2026-27");
		expect(seasonFromEspnYear("gleague", 2027)).toBe("2026-27");
	});

	it("handles the century rollover", () => {
		expect(seasonFromEspnYear("nba", 2100)).toBe("2099-00");
	});

	it("uses the single calendar year for WNBA", () => {
		expect(seasonFromEspnYear("wnba", 2026)).toBe("2026");
	});
});

describe("parseEspnSeason", () => {
	it("reads season and season type from ESPN metadata", () => {
		expect(parseEspnSeason("nba", { year: 2027, type: 2 })).toEqual({
			season: "2026-27",
			seasonType: 2,
		});
		expect(parseEspnSeason("wnba", { year: 2026, type: 3 })).toEqual({
			season: "2026",
			seasonType: 3,
		});
	});

	it("returns undefined fields when ESPN omits them", () => {
		expect(parseEspnSeason("nba", undefined)).toEqual({
			season: undefined,
			seasonType: undefined,
		});
		expect(parseEspnSeason("nba", {})).toEqual({
			season: undefined,
			seasonType: undefined,
		});
		expect(parseEspnSeason("nba", { type: 1 })).toEqual({
			season: undefined,
			seasonType: 1,
		});
	});

	it("ignores non-finite years", () => {
		expect(parseEspnSeason("nba", { year: Number.NaN, type: 2 }).season).toBeUndefined();
	});
});

describe("compareSeasons", () => {
	it("orders two-year seasons by start year", () => {
		expect(compareSeasons("2026-27", "2025-26")).toBeGreaterThan(0);
		expect(compareSeasons("2025-26", "2026-27")).toBeLessThan(0);
		expect(compareSeasons("2026-27", "2026-27")).toBe(0);
	});

	it("orders single-year WNBA seasons", () => {
		expect(compareSeasons("2026", "2025")).toBeGreaterThan(0);
		expect(compareSeasons("2025", "2026")).toBeLessThan(0);
	});
});

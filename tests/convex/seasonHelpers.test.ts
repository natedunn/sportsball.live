import { describe, it, expect } from "vitest";
import {
	compareSeasons,
	countsTowardGameLog,
	countsTowardSeasonAverages,
	formatGameDate,
	getNextSeason,
	getScheduleSyncRange,
	getTodayDate,
	mapApiStateToEventStatus,
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

describe("getScheduleSyncRange", () => {
	// Oct 29 2026, 9:30 AM UTC = 5:30 AM EDT, when the daily sync runs
	const now = Date.UTC(2026, 9, 29, 9, 30, 0);

	it("starts three days back (ET) and runs to the current season's last day", () => {
		expect(
			getScheduleSyncRange({ seasonEndDate: "20270625", latestScheduledEndDate: "20270625" }, now),
		).toEqual({ startDate: "20261026", endDate: "20270625" });
	});

	it("runs through the next season once the current one is over", () => {
		expect(
			getScheduleSyncRange({ seasonEndDate: "20261025", latestScheduledEndDate: "20271130" }, now),
		).toEqual({ startDate: "20261026", endDate: "20271130" });
	});

	it("still covers the next week with no season dates at all", () => {
		expect(
			getScheduleSyncRange({ seasonEndDate: null, latestScheduledEndDate: null }, now),
		).toEqual({ startDate: "20261026", endDate: "20261105" });
	});
});

describe("countsTowardSeasonAverages", () => {
	it("counts finished regular-season games", () => {
		expect(countsTowardSeasonAverages({ eventStatus: "completed", seasonType: 2 })).toBe(true);
		expect(
			countsTowardSeasonAverages({ eventStatus: "completed", seasonType: 2, competitionType: "STD" }),
		).toBe(true);
	});

	it("skips playoffs, play-in, preseason and the G League Tip-Off Tournament", () => {
		for (const seasonType of [1, 3, 5]) {
			expect(countsTowardSeasonAverages({ eventStatus: "completed", seasonType })).toBe(false);
		}
	});

	it("skips Cup championships and All-Star games ESPN files as regular season", () => {
		expect(
			countsTowardSeasonAverages({ eventStatus: "completed", seasonType: 2, competitionType: "CC" }),
		).toBe(false);
		expect(
			countsTowardSeasonAverages({ eventStatus: "completed", seasonType: 2, competitionType: "ALLSTAR" }),
		).toBe(false);
	});

	it("skips games with no season type", () => {
		expect(countsTowardSeasonAverages({ eventStatus: "completed" })).toBe(false);
	});

	it("skips games that haven't finished, or didn't happen", () => {
		for (const eventStatus of ["in_progress", "halftime", "scheduled", "postponed", "cancelled"]) {
			expect(countsTowardSeasonAverages({ eventStatus, seasonType: 2 })).toBe(false);
		}
		expect(countsTowardSeasonAverages(null)).toBe(false);
		expect(countsTowardSeasonAverages(undefined)).toBe(false);
	});
});

describe("countsTowardGameLog", () => {
	it("includes every finished game a team really played", () => {
		for (const seasonType of [2, 3, 5]) {
			expect(countsTowardGameLog({ eventStatus: "completed", seasonType })).toBe(true);
		}
		expect(countsTowardGameLog({ eventStatus: "completed", seasonType: 2, competitionType: "CC" })).toBe(true);
	});

	it("skips preseason, All-Star, untagged and unfinished games", () => {
		expect(countsTowardGameLog({ eventStatus: "completed", seasonType: 1 })).toBe(false);
		expect(countsTowardGameLog({ eventStatus: "completed", seasonType: 2, competitionType: "ALLSTAR" })).toBe(
			false,
		);
		expect(countsTowardGameLog({ eventStatus: "completed" })).toBe(false);
		expect(countsTowardGameLog({ eventStatus: "postponed", seasonType: 2 })).toBe(false);
	});
});

describe("mapApiStateToEventStatus", () => {
	it("maps finished games to completed", () => {
		expect(mapApiStateToEventStatus("post", "Final")).toBe("completed");
		expect(mapApiStateToEventStatus("post", "Final/OT")).toBe("completed");
	});

	it("keeps postponed and canceled games, which ESPN also reports as post, out of completed", () => {
		expect(mapApiStateToEventStatus("post", "Postponed")).toBe("postponed");
		expect(mapApiStateToEventStatus("post", "Canceled")).toBe("cancelled");
		expect(mapApiStateToEventStatus("post", "Cancelled")).toBe("cancelled");
	});
});

describe("getNextSeason", () => {
	it("steps two-year seasons forward", () => {
		expect(getNextSeason("nba", "2026-27")).toBe("2027-28");
		expect(getNextSeason("gleague", "2025-26")).toBe("2026-27");
		expect(getNextSeason("nba", "1999-00")).toBe("2000-01");
	});

	it("steps WNBA seasons a calendar year forward", () => {
		expect(getNextSeason("wnba", "2026")).toBe("2027");
	});
});

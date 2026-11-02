import { describe, expect, it } from "vitest";
import { formatGameDate, getGameDay, moveDate } from "./date";

describe("getGameDay", () => {
	const timeZone = "America/Chicago";
	// 2026-11-02 in Chicago (CST, UTC-6)
	const chicago = (hour: number, minute = 0) =>
		new Date(Date.UTC(2026, 10, 2, hour + 6, minute));

	it("keeps the previous day before 3am in the visitor's time zone", () => {
		expect(getGameDay("YYYYMMDD", { now: chicago(0, 30), timeZone })).toBe("20261101");
		expect(getGameDay("YYYY-MM-DD", { now: chicago(2, 59), timeZone })).toBe("2026-11-01");
	});

	it("rolls over at 3am in the visitor's time zone", () => {
		expect(getGameDay("YYYYMMDD", { now: chicago(3), timeZone })).toBe("20261102");
		expect(getGameDay("YYYYMMDD", { now: chicago(23, 59), timeZone })).toBe("20261102");
	});

	it("uses the given time zone, not the machine's", () => {
		// 03:30 UTC on Nov 2 is still Nov 1 evening in Chicago
		const now = new Date(Date.UTC(2026, 10, 2, 3, 30));
		expect(getGameDay("YYYYMMDD", { now, timeZone })).toBe("20261101");
		expect(getGameDay("YYYYMMDD", { now, timeZone: "Asia/Tokyo" })).toBe("20261102");
	});
});

describe("formatGameDate", () => {
	it("formats in the visitor's time zone", () => {
		const start = new Date(Date.UTC(2026, 10, 2, 0, 30));
		expect(formatGameDate(start, { format: "time-only" })).toMatch(/^\d{1,2}:30 [AP]M \S+$/);
	});
});

describe("moveDate", () => {
	it("steps a day either way", () => {
		expect(moveDate("2026-11-01", "next")).toBe("2026-11-02");
		expect(moveDate("2026-11-01", "prev")).toBe("2026-10-31");
	});
});

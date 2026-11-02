import { describe, it, expect } from "vitest";
import {
	injuryRefreshTimes,
	parseInjuryReport,
	type ApiInjuriesResponse,
} from "@convex/shared/injuries";

const MINUTE = 60 * 1000;

// Trimmed from ESPN's NBA injuries endpoint
const report: ApiInjuriesResponse = {
	status: "success",
	injuries: [
		{
			id: "21",
			displayName: "Phoenix Suns",
			injuries: [
				{
					id: "532554",
					status: "Out",
					date: "2026-09-11T16:03Z",
					shortComment: "Williams underwent surgery Thursday to repair a torn labrum in his left shoulder.",
					athlete: {
						displayName: "Mark Williams",
						headshot: { href: "https://a.espncdn.com/i/headshots/nba/players/full/4701232.png" },
						position: { abbreviation: "C" },
						links: [{ href: "https://www.espn.com/nba/player/_/id/4701232/mark-williams" }],
					},
					details: { type: "Shoulder", detail: "Surgery", side: "Left", returnDate: "2027-02-03" },
				},
			],
		},
		{
			id: "1",
			displayName: "Atlanta Hawks",
			injuries: [
				{
					id: "537146",
					status: "Day-To-Day",
					athlete: { displayName: "Kingston Flemings" },
					details: { type: "Ankle", side: "Not Specified" },
				},
			],
		},
	],
};

describe("parseInjuryReport", () => {
	it("reads every team's injured players", () => {
		const injuries = parseInjuryReport(report);
		expect(injuries).toHaveLength(2);
		expect(injuries?.[0]).toEqual({
			espnTeamId: "21",
			espnInjuryId: "532554",
			espnPlayerId: "4701232",
			name: "Mark Williams",
			position: "C",
			headshot: "https://a.espncdn.com/i/headshots/nba/players/full/4701232.png",
			status: "Out",
			description: "Left Shoulder Surgery",
			shortComment: "Williams underwent surgery Thursday to repair a torn labrum in his left shoulder.",
			returnDate: "2027-02-03",
			reportedAt: "2026-09-11T16:03Z",
		});
	});

	it("leaves out unspecified details", () => {
		expect(parseInjuryReport(report)?.[1]).toMatchObject({ espnTeamId: "1", description: "Ankle" });
	});

	it("accepts an empty report", () => {
		expect(parseInjuryReport({ status: "success", injuries: [] })).toEqual([]);
	});

	it("rejects a failed report rather than clearing the league", () => {
		expect(parseInjuryReport({ status: "error" })).toBeNull();
		expect(parseInjuryReport({ status: "success" })).toBeNull();
	});
});

describe("injuryRefreshTimes", () => {
	const sevenPm = Date.UTC(2026, 10, 2, 23, 0);

	it("refreshes 50 and 25 minutes before tip-off and at tip", () => {
		expect(injuryRefreshTimes([sevenPm], 0)).toEqual([
			sevenPm - 50 * MINUTE,
			sevenPm - 25 * MINUTE,
			sevenPm,
		]);
	});

	it("shares refreshes between tip-offs within 15 minutes of the first", () => {
		const times = injuryRefreshTimes([sevenPm + 10 * MINUTE, sevenPm, sevenPm, sevenPm + 15 * MINUTE], 0);
		expect(times).toEqual([sevenPm - 50 * MINUTE, sevenPm - 25 * MINUTE, sevenPm]);
	});

	it("gives later tip-offs their own refreshes", () => {
		const times = injuryRefreshTimes([sevenPm, sevenPm + 30 * MINUTE, sevenPm + 3 * 60 * MINUTE], 0);
		expect(times).toHaveLength(9);
		expect(times).toContain(sevenPm + 30 * MINUTE - 50 * MINUTE);
		expect(times).toContain(sevenPm + 3 * 60 * MINUTE);
	});

	it("skips times already past", () => {
		expect(injuryRefreshTimes([sevenPm], sevenPm - 30 * MINUTE)).toEqual([sevenPm - 25 * MINUTE, sevenPm]);
		expect(injuryRefreshTimes([sevenPm], sevenPm)).toEqual([]);
	});

	it("schedules nothing without games", () => {
		expect(injuryRefreshTimes([], 0)).toEqual([]);
	});
});

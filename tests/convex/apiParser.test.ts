import { describe, it, expect } from "vitest";
import {
	getRecordsFromTeamSchedule,
	getTotalRecord,
	type ApiTeamScheduleEvent,
} from "@convex/shared/apiParser";

describe("getTotalRecord", () => {
	it("reads the total record from a scoreboard competitor", () => {
		expect(
			getTotalRecord({
				records: [
					{ type: "total", summary: "2-0" },
					{ type: "road", summary: "2-0" },
				],
			}),
		).toBe("2-0");
	});

	it("reads the total record from a summary header competitor", () => {
		expect(
			getTotalRecord({
				record: [
					{ type: "home", summary: "0-1" },
					{ type: "total", summary: "0-2" },
				],
			}),
		).toBe("0-2");
	});

	it("returns undefined when ESPN sends no total record", () => {
		expect(getTotalRecord({ records: [{ type: "home", summary: "1-0" }] })).toBeUndefined();
		expect(getTotalRecord({ records: [{ type: "total", summary: "" }] })).toBeUndefined();
		expect(getTotalRecord(undefined)).toBeUndefined();
	});
});

describe("getRecordsFromTeamSchedule", () => {
	function game(
		id: string,
		date: string,
		seasonType: number,
		us: { homeAway: "home" | "away"; score: number },
		themScore: number,
		completed = true,
	): ApiTeamScheduleEvent {
		return {
			id,
			date,
			seasonType: { type: seasonType },
			competitions: [
				{
					status: { type: { completed } },
					competitors: [
						{
							homeAway: us.homeAway,
							team: { id: "21" },
							score: { value: us.score },
							winner: completed ? us.score > themScore : undefined,
						},
						{
							homeAway: us.homeAway === "home" ? "away" : "home",
							team: { id: "22" },
							score: { value: themScore },
						},
					],
				},
			],
		};
	}

	it("counts the record as of each game, in date order", () => {
		const events = [
			game("3", "2025-12-22T00:00Z", 2, { homeAway: "away", score: 90 }, 100),
			game("1", "2025-12-20T00:00Z", 2, { homeAway: "home", score: 106 }, 130),
			game("2", "2025-12-21T00:00Z", 2, { homeAway: "home", score: 110 }, 101),
		];
		expect(getRecordsFromTeamSchedule("21", events)).toEqual([
			{ espnGameId: "1", homeAway: "home", record: "0-1", seasonType: 2 },
			{ espnGameId: "2", homeAway: "home", record: "1-1", seasonType: 2 },
			{ espnGameId: "3", homeAway: "away", record: "1-2", seasonType: 2 },
		]);
	});

	it("keeps the Tip-Off Tournament and regular season records apart", () => {
		const events = [
			game("1", "2025-11-08T00:00Z", 5, { homeAway: "home", score: 100 }, 90),
			game("2", "2025-11-09T00:00Z", 5, { homeAway: "home", score: 100 }, 90),
			game("3", "2025-12-20T00:00Z", 2, { homeAway: "home", score: 80 }, 90),
		];
		expect(getRecordsFromTeamSchedule("21", events).map((r) => r.record)).toEqual([
			"1-0",
			"2-0",
			"0-1",
		]);
	});

	it("skips games that haven't finished", () => {
		const events = [
			game("1", "2025-12-20T00:00Z", 2, { homeAway: "home", score: 100 }, 90),
			game("2", "2025-12-21T00:00Z", 2, { homeAway: "home", score: 0 }, 0, false),
		];
		expect(getRecordsFromTeamSchedule("21", events)).toEqual([
			{ espnGameId: "1", homeAway: "home", record: "1-0", seasonType: 2 },
		]);
	});
});


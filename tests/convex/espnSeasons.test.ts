import { describe, it, expect } from "vitest";
import { buildSeasonPhases, espnBoundaryDate } from "@convex/shared/espnSeasons";

// ESPN's real season types and game days for 2026-27 (fetched Oct 30 2026)
const NBA_2027_TYPES = [
	{ type: 1, name: "Preseason", startDate: "2026-09-30T07:00Z", endDate: "2026-10-20T06:59Z" },
	{ type: 2, name: "Regular Season", startDate: "2026-10-20T07:00Z", endDate: "2027-04-12T06:59Z" },
	{ type: 3, name: "Postseason", startDate: "2027-04-17T07:00Z", endDate: "2027-06-26T06:59Z" },
	{ type: 5, name: "Play-In Season", startDate: "2027-04-12T07:00Z", endDate: "2027-04-17T06:59Z" },
];
const GLEAGUE_2027_TYPES = [
	{ type: 1, name: "Preseason", startDate: "2026-09-01T07:00Z", endDate: "2026-11-06T07:59Z" },
	{ type: 2, name: "Regular Season", startDate: "2026-12-19T08:00Z", endDate: "2027-03-29T06:59Z" },
	{ type: 3, name: "Postseason", startDate: "2027-03-29T07:00Z", endDate: "2027-05-01T06:59Z" },
	{ type: 5, name: "Tip-Off Tournament", startDate: "2026-11-06T08:00Z", endDate: "2026-12-23T07:59Z" },
];

describe("espnBoundaryDate", () => {
	it("reads ESPN's midnight-Pacific boundaries as dates", () => {
		expect(espnBoundaryDate("2026-10-20T07:00Z")).toBe("2026-10-20");
		expect(espnBoundaryDate("2026-10-20T06:59Z")).toBe("2026-10-19");
		// Winter boundaries are an hour later in UTC
		expect(espnBoundaryDate("2026-11-06T08:00Z")).toBe("2026-11-06");
		expect(espnBoundaryDate("2026-11-06T07:59Z")).toBe("2026-11-05");
	});
});

describe("buildSeasonPhases", () => {
	it("maps the NBA season, starting preseason on its first game", () => {
		const gameDays = ["2026-10-03T07:00Z", "2026-10-16T07:00Z", "2026-10-20T07:00Z", "2027-04-11T07:00Z"];
		expect(buildSeasonPhases("nba", 2027, NBA_2027_TYPES, gameDays)).toEqual([
			{
				league: "nba",
				startYear: 2026,
				endYear: 2027,
				name: "Preseason",
				type: "pre-season",
				startDate: "2026-10-03",
				endDate: "2026-10-19",
				status: "confirmed",
			},
			{
				league: "nba",
				startYear: 2026,
				endYear: 2027,
				name: "Regular season",
				type: "regular-season",
				startDate: "2026-10-20",
				endDate: "2027-04-11",
				status: "confirmed",
			},
			{
				league: "nba",
				startYear: 2026,
				endYear: 2027,
				name: "Playoffs",
				type: "playoffs",
				startDate: "2027-04-17",
				endDate: "2027-06-25",
				status: "estimated",
			},
			{
				league: "nba",
				startYear: 2026,
				endYear: 2027,
				name: "Play-In Tournament",
				type: "play-in",
				startDate: "2027-04-12",
				endDate: "2027-04-16",
				status: "estimated",
			},
		]);
	});

	it("leaves out a G-League preseason with no games and keeps the Tip-Off Tournament", () => {
		const phases = buildSeasonPhases("gleague", 2027, GLEAGUE_2027_TYPES, ["2026-11-06T08:00Z"]);
		expect(phases.map((p) => [p.type, p.name, p.startDate, p.endDate, p.status])).toEqual([
			["regular-season", "Regular season", "2026-12-19", "2027-03-28", "estimated"],
			["playoffs", "Playoffs", "2027-03-29", "2027-04-30", "estimated"],
			["tournament", "Tip-Off Tournament", "2026-11-06", "2026-12-22", "confirmed"],
		]);
	});

	it("uses WNBA single-year seasons", () => {
		const [phase] = buildSeasonPhases(
			"wnba",
			2026,
			[{ type: 3, name: "Postseason", startDate: "2026-09-25T07:00Z", endDate: "2026-11-05T07:59Z" }],
			["2026-10-31T07:00Z"],
		);
		expect(phase).toMatchObject({
			startYear: 2026,
			endYear: 2026,
			type: "playoffs",
			startDate: "2026-09-25",
			endDate: "2026-11-04",
			status: "confirmed",
		});
	});

	it("skips the offseason", () => {
		const phases = buildSeasonPhases(
			"nba",
			2027,
			[{ type: 4, name: "Off Season", startDate: "2027-06-26T07:00Z", endDate: "2027-09-30T06:59Z" }],
			[],
		);
		expect(phases).toEqual([]);
	});
});

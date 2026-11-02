import { describe, expect, it } from "vitest";
import { parsePlayoffSeeds } from "@/lib/gleague/playoff-seeds";

const headers = ["LeagueID", "TeamID", "TeamCity", "Conference", "PlayoffRank"];

describe("parsePlayoffSeeds", () => {
	it("maps stats API teams to ESPN IDs with their side and rank", () => {
		const seeds = parsePlayoffSeeds({
			resultSets: [
				{
					headers,
					rowSet: [
						["20", 1612709925, "Osceola", "East", 1],
						["20", 1612709914, "Stockton", "West", 3],
					],
				},
			],
		});
		expect(seeds).toEqual([
			{ espnTeamId: "11", conference: "East", rank: 1 },
			{ espnTeamId: "23", conference: "West", rank: 3 },
		]);
	});

	it("skips unknown teams and rows without a rank or side", () => {
		const seeds = parsePlayoffSeeds({
			resultSets: [
				{
					headers,
					rowSet: [
						["20", 1612700000, "Nowhere", "East", 2],
						["20", 1612709925, "Osceola", "East", null],
						["20", 1612709914, "Stockton", null, 3],
					],
				},
			],
		});
		expect(seeds).toEqual([]);
	});

	it("returns nothing for an unexpected payload", () => {
		expect(parsePlayoffSeeds({})).toEqual([]);
		expect(parsePlayoffSeeds({ resultSets: [{ headers: ["TeamID"], rowSet: [] }] })).toEqual([]);
	});
});

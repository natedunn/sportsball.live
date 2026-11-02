import { describe, expect, it } from "vitest";
import {
	getActiveSection,
	getLeagueFromPathname,
	switchLeagueHref,
} from "./league-nav";

describe("getLeagueFromPathname", () => {
	it("reads the league from league paths", () => {
		expect(getLeagueFromPathname("/nba")).toBe("nba");
		expect(getLeagueFromPathname("/wnba/standings")).toBe("wnba");
		expect(getLeagueFromPathname("/gleague/team/12/roster")).toBe("gleague");
	});

	it("returns null elsewhere", () => {
		expect(getLeagueFromPathname("/")).toBeNull();
		expect(getLeagueFromPathname("/settings")).toBeNull();
		expect(getLeagueFromPathname("/nbax")).toBeNull();
	});
});

describe("getActiveSection", () => {
	it("matches sections, including the overview", () => {
		expect(getActiveSection("/nba")?.label).toBe("Overview");
		expect(getActiveSection("/nba/")?.label).toBe("Overview");
		expect(getActiveSection("/wnba/scores")?.label).toBe("Scores");
	});

	it("matches a section's sub-pages", () => {
		expect(getActiveSection("/nba/standings/west")?.label).toBe("Standings");
		expect(getActiveSection("/gleague/standings/league/")?.label).toBe("Standings");
	});

	it("is null on entity pages and unknown sections", () => {
		expect(getActiveSection("/nba/team/1")).toBeNull();
		expect(getActiveSection("/gleague/brackets")).toBeNull();
	});
});

describe("switchLeagueHref", () => {
	it("keeps the section when the target league has it", () => {
		expect(switchLeagueHref("/nba/standings", "wnba")).toBe("/wnba/standings");
		expect(switchLeagueHref("/gleague/players", "nba")).toBe("/nba/players");
		expect(switchLeagueHref("/wnba", "gleague")).toBe("/gleague");
		expect(switchLeagueHref("/nba/standings/west", "wnba")).toBe("/wnba/standings");
		expect(switchLeagueHref("/nba/playoffs", "wnba")).toBe("/wnba/playoffs");
		expect(switchLeagueHref("/wnba/playoffs", "gleague")).toBe("/gleague/playoffs");
	});

	it("goes to the overview from team, game and player pages", () => {
		expect(switchLeagueHref("/nba/team/1/roster", "wnba")).toBe("/wnba");
		expect(switchLeagueHref("/wnba/game/401", "nba")).toBe("/nba");
		expect(switchLeagueHref("/nba/player/5/splits", "gleague")).toBe("/gleague");
	});

	it("goes to the overview from non-league pages", () => {
		expect(switchLeagueHref("/settings", "nba")).toBe("/nba");
	});
});

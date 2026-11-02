import { describe, expect, it } from "vitest";
import type { StandingTeam } from "@/lib/types/standings";
import { combineStandings, pctRanks } from "./combined-standings";

function team(id: string, wins: number, losses: number): StandingTeam {
	return {
		id,
		name: id,
		abbreviation: id,
		logo: undefined,
		darkColor: "",
		lightColor: "",
		wins,
		losses,
		winPct: wins + losses === 0 ? 0 : wins / (wins + losses),
		gamesBack: 99,
		streak: "",
		homeRecord: "",
		awayRecord: "",
		divisionRecord: "",
		conferenceRecord: "",
		last10: "",
		pointsFor: 0,
		pointsAgainst: 0,
		differential: 0,
	};
}

describe("combineStandings", () => {
	it("ranks both conferences by record with league-wide games back", () => {
		const combined = combineStandings({
			eastern: { name: "East", teams: [team("a", 5, 1), team("b", 2, 4)] },
			western: { name: "West", teams: [team("c", 6, 0), team("d", 4, 1)] },
		});
		expect(combined.map((t) => t.id)).toEqual(["c", "a", "d", "b"]);
		expect(combined.map((t) => t.gamesBack)).toEqual([0, 1, 1.5, 4]);
	});

	it("follows the league-wide seed when every team has one", () => {
		const seeded = (t: StandingTeam, leagueRank: number) => ({ ...t, leagueRank });
		const combined = combineStandings({
			eastern: { name: "East", teams: [seeded(team("a", 4, 2), 2), seeded(team("b", 1, 5), 4)] },
			western: { name: "West", teams: [seeded(team("c", 4, 2), 1), seeded(team("d", 3, 3), 3)] },
		});
		expect(combined.map((t) => t.id)).toEqual(["c", "a", "d", "b"]);
		expect(combined.map((t) => t.gamesBack)).toEqual([0, 0, 1, 3]);
	});

	it("prefers win percentage over raw wins", () => {
		const combined = combineStandings({
			eastern: { name: "East", teams: [team("a", 5, 3)] },
			western: { name: "West", teams: [team("b", 4, 1)] },
		});
		expect(combined.map((t) => t.id)).toEqual(["b", "a"]);
	});
});

describe("pctRanks", () => {
	it("shares a rank between equal percentages and continues from it", () => {
		const teams = combineStandings({
			eastern: { name: "East", teams: [team("a", 4, 2), team("b", 1, 2)] },
			western: { name: "West", teams: [team("c", 2, 1), team("d", 6, 0)] },
		});
		expect(teams.map((t) => t.id)).toEqual(["d", "a", "c", "b"]);
		expect(pctRanks(teams)).toEqual([1, 2, 2, 3]);
	});
});

import { describe, expect, it } from "vitest";
import {
	advancedStats,
	filterGameLog,
	gameScore,
	phasesIn,
	summarizeGameLog,
	type PlayerGameLogRow,
} from "./game-log-stats";

const box = {
	minutes: 240,
	fgm: 40,
	fga: 88,
	tpa: 35,
	fta: 22,
	tov: 14,
	oreb: 10,
	dreb: 34,
	reb: 44,
};

function row(overrides: Partial<PlayerGameLogRow> = {}): PlayerGameLogRow {
	return {
		espnGameId: "1",
		gameDate: "2026-10-22",
		scheduledStart: 0,
		phase: "regular",
		isHome: true,
		teamAbbreviation: "PHX",
		opponent: "POR",
		teamScore: 110,
		oppScore: 100,
		starter: true,
		min: 36,
		pts: 24,
		reb: 6,
		oreb: 1,
		dreb: 5,
		ast: 6,
		stl: 1,
		blk: 1,
		tov: 3,
		pf: 2,
		fgm: 9,
		fga: 18,
		tpm: 2,
		tpa: 6,
		ftm: 4,
		fta: 5,
		plusMinus: 8,
		team: box,
		opp: box,
		...overrides,
	};
}

describe("filterGameLog", () => {
	const rows = [
		row({ espnGameId: "4", isHome: false, teamScore: 90 }),
		row({ espnGameId: "3" }),
		row({ espnGameId: "2", phase: "playoffs" }),
		row({ espnGameId: "1", isHome: false }),
	];

	it("keeps one phase and applies the split", () => {
		expect(filterGameLog(rows, "regular", "all").map((r) => r.espnGameId)).toEqual(["4", "3", "1"]);
		expect(filterGameLog(rows, "regular", "road").map((r) => r.espnGameId)).toEqual(["4", "1"]);
		expect(filterGameLog(rows, "regular", "losses").map((r) => r.espnGameId)).toEqual(["4"]);
		expect(filterGameLog(rows, "regular", "last5")).toHaveLength(3);
		expect(filterGameLog(rows, "playoffs", "all").map((r) => r.espnGameId)).toEqual(["2"]);
	});

	it("lists phases in season order", () => {
		expect(phasesIn(rows)).toEqual(["regular", "playoffs"]);
	});
});

describe("summarizeGameLog", () => {
	const rows = [row(), row({ pts: 30, min: 24, plusMinus: undefined })];

	it("averages per game and weights percentages by attempts", () => {
		const summary = summarizeGameLog(rows, "perGame");
		expect(summary.games).toBe(2);
		expect(summary.stats.pts).toBe(27);
		expect(summary.fgPct).toBe(50);
		// Only games that report plus-minus count toward its average
		expect(summary.plusMinus).toBe(8);
	});

	it("scales to 36 minutes but keeps minutes per game", () => {
		const summary = summarizeGameLog(rows, "per36");
		expect(summary.stats.pts).toBeCloseTo((54 / 60) * 36);
		expect(summary.stats.min).toBe(30);
	});

	it("sums totals", () => {
		expect(summarizeGameLog(rows, "totals").stats.pts).toBe(54);
	});
});

describe("advancedStats", () => {
	it("matches Basketball-Reference's formulas for one game", () => {
		const stats = advancedStats([row()]);
		// TS% = 24 / (2 × (18 + 0.44 × 5))
		expect(stats.tsPct).toBeCloseTo((24 / (2 * (18 + 2.2))) * 100);
		// USG% = (18 + 2.2 + 3) × 48 / (36 × (88 + 9.68 + 14))
		expect(stats.usgPct).toBeCloseTo(((23.2 * 48) / (36 * 111.68)) * 100);
		// AST% = 6 / ((36 / 48) × 40 − 9)
		expect(stats.astPct).toBeCloseTo((6 / (0.75 * 40 - 9)) * 100);
		// REB% = 6 × 48 / (36 × (44 + 44))
		expect(stats.rebPct).toBeCloseTo(((6 * 48) / (36 * 88)) * 100);
		expect(stats.threePointRate).toBeCloseTo((6 / 18) * 100);
	});

	it("returns null instead of dividing by zero", () => {
		const stats = advancedStats([row({ fga: 0, fgm: 0, fta: 0, tov: 0, tpa: 0 })]);
		expect(stats.efgPct).toBeNull();
		expect(stats.tovPct).toBeNull();
		expect(advancedStats([]).usgPct).toBeNull();
	});
});

describe("gameScore", () => {
	it("follows Hollinger's formula", () => {
		// 24 + 3.6 − 12.6 − 0.4 + 0.7 + 1.5 + 1 + 4.2 + 0.7 − 0.8 − 3
		expect(gameScore(row())).toBeCloseTo(18.9);
	});
});

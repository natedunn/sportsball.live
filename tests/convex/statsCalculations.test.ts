import { describe, it, expect } from "vitest";
import { computePlayerSeasonRatings, playedInGame } from "@convex/shared/statsCalculations";

const didNotPlay = {
	minutes: 0,
	points: 0,
	fieldGoalsAttempted: 0,
	freeThrowsAttempted: 0,
	totalRebounds: 0,
	assists: 0,
	steals: 0,
	blocks: 0,
	turnovers: 0,
	fouls: 0,
};

describe("playedInGame", () => {
	it("skips did-not-play rows", () => {
		expect(playedInGame(didNotPlay)).toBe(false);
	});

	it("counts any minutes played", () => {
		expect(playedInGame({ ...didNotPlay, minutes: 3 })).toBe(true);
	});

	it("counts a sub-minute appearance that recorded a stat", () => {
		expect(playedInGame({ ...didNotPlay, fouls: 1 })).toBe(true);
		expect(playedInGame({ ...didNotPlay, freeThrowsAttempted: 2 })).toBe(true);
	});
});

describe("computePlayerSeasonRatings", () => {
	// Devin Booker through 3 games of 2026-27: 69 PTS, 13 REB, 16 AST, 1 STL,
	// 2 BLK, 6 TOV, 25-45 FG, 17-18 FT
	const booker = {
		gamesPlayed: 3,
		pointsPerGame: 23,
		reboundsPerGame: 13 / 3,
		assistsPerGame: 16 / 3,
		stealsPerGame: 1 / 3,
		blocksPerGame: 2 / 3,
		turnoversPerGame: 2,
		totalFgMade: 25,
		totalFgAttempted: 45,
		totalFtMade: 17,
		totalFtAttempted: 18,
	};

	it("computes TS% from season shooting totals", () => {
		// 69 / (2 × (45 + 0.44 × 18))
		expect(computePlayerSeasonRatings(booker).trueShootingPct).toBeCloseTo(65.19, 2);
	});

	it("computes EFF per game, docking missed shots and turnovers", () => {
		// (69 + 13 + 16 + 1 + 2 − 20 missed FG − 1 missed FT − 6 TOV) / 3
		expect(computePlayerSeasonRatings(booker).efficiency).toBeCloseTo(74 / 3, 5);
	});

	it("computes assists per turnover", () => {
		expect(computePlayerSeasonRatings(booker).assistToTurnover).toBeCloseTo(16 / 6, 5);
	});

	it("returns zeros for a player with no games", () => {
		expect(computePlayerSeasonRatings({ gamesPlayed: 0 })).toEqual({
			trueShootingPct: 0,
			efficiency: 0,
			assistToTurnover: 0,
		});
	});
});

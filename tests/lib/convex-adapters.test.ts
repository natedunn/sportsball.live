import { describe, it, expect } from "vitest";
import {
	convexGameDetailsToGameDetails,
	convexScoreboardToGameData,
} from "@/lib/shared/convex-adapters";

const homeTeam = {
	espnTeamId: "10",
	name: "Houston Rockets",
	location: "Houston",
	abbreviation: "HOU",
	wins: 5,
	losses: 0,
};
const awayTeam = {
	espnTeamId: "24",
	name: "San Antonio Spurs",
	location: "San Antonio",
	abbreviation: "SA",
	wins: 3,
	losses: 2,
};

function scoreboardGame(overrides: Record<string, unknown>) {
	return {
		espnGameId: "401",
		eventStatus: "completed",
		scheduledStart: Date.UTC(2026, 9, 24, 0, 0, 0),
		homeScore: 114,
		awayScore: 110,
		homeTeam,
		awayTeam,
		homeTeamRecord: "2-0",
		awayTeamRecord: "1-1",
		...overrides,
	};
}

describe("convexScoreboardToGameData records", () => {
	it("shows a finished game's records as of that game", () => {
		const [game] = convexScoreboardToGameData([scoreboardGame({})], "nba");
		expect(game.home.seasonRecord).toBe("2-0");
		expect(game.away.seasonRecord).toBe("1-1");
	});

	it("shows current records for upcoming games", () => {
		const [game] = convexScoreboardToGameData(
			[scoreboardGame({ eventStatus: "scheduled" })],
			"nba",
		);
		expect(game.home.seasonRecord).toBe("5-0");
		expect(game.away.seasonRecord).toBe("3-2");
	});

	it("falls back to current records for finished games stored without them", () => {
		const [game] = convexScoreboardToGameData(
			[scoreboardGame({ homeTeamRecord: undefined, awayTeamRecord: undefined })],
			"nba",
		);
		expect(game.home.seasonRecord).toBe("5-0");
		expect(game.away.seasonRecord).toBe("3-2");
	});

	it("keeps the playoff series record ahead of the season record", () => {
		const [game] = convexScoreboardToGameData(
			[scoreboardGame({ seriesRecord: { home: "3-1", away: "1-3" } })],
			"nba",
		);
		expect(game.home.seasonRecord).toBe("3-1");
		expect(game.away.seasonRecord).toBe("1-3");
	});
});

describe("convexGameDetailsToGameDetails records", () => {
	it("shows a finished game's records as of that game", () => {
		const details = convexGameDetailsToGameDetails(
			{ game: scoreboardGame({}), homeTeam, awayTeam },
			"nba",
		);
		expect(details?.home.record).toBe("2-0");
		expect(details?.away.record).toBe("1-1");
	});
});

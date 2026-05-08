import { describe, expect, it } from "vitest";
import {
	buildBracket,
	type PlayoffBracketData,
} from "@/components/playoffs/playoff-bracket";

type TestTeam = PlayoffBracketData["teams"][number];
type TestGame = PlayoffBracketData["games"][number];

function team(espnTeamId: string, rank: number): TestTeam {
	return {
		espnTeamId,
		name: espnTeamId,
		abbreviation: espnTeamId,
		location: espnTeamId,
		conference: "Western",
		conferenceRank: rank,
		wins: 50 - rank,
		losses: 30 + rank,
	};
}

function game(
	espnGameId: string,
	homeTeam: TestTeam,
	awayTeam: TestTeam,
	homeScore: number | undefined,
	awayScore: number | undefined,
	eventStatus = "completed",
): TestGame {
	return {
		espnGameId,
		gameDate: "2026-04-20",
		scheduledStart: Number(espnGameId.replace(/\D/g, "")) || 1,
		eventStatus,
		homeScore,
		awayScore,
		homeTeam,
		awayTeam,
	};
}

describe("buildBracket", () => {
	it("ignores completed games with missing or tied scores when counting wins", () => {
		const topSeed = team("ONE", 1);
		const bottomSeed = team("EIGHT", 8);
		const bracket = buildBracket(
			{
				teams: [topSeed, bottomSeed],
				games: [
					game("game-1", topSeed, bottomSeed, undefined, undefined),
					game("game-2", topSeed, bottomSeed, 0, 0),
					game("game-3", topSeed, bottomSeed, 101, 99),
				],
			},
			"nba",
		);

		const series = bracket.west[0][0];
		expect(series.topWins).toBe(1);
		expect(series.bottomWins).toBe(0);
		expect(series.status).toBe("active");
		expect(series.winner).toBeNull();
	});

	it("advances completed series winners into the next round", () => {
		const seed1 = team("ONE", 1);
		const seed8 = team("EIGHT", 8);
		const seed4 = team("FOUR", 4);
		const seed5 = team("FIVE", 5);

		const bracket = buildBracket(
			{
				teams: [seed1, seed8, seed4, seed5],
				games: [
					...Array.from({ length: 4 }, (_, index) =>
						game(`one-${index}`, seed1, seed8, 110, 100),
					),
					...Array.from({ length: 4 }, (_, index) =>
						game(`four-${index}`, seed4, seed5, 108, 98),
					),
					...Array.from({ length: 4 }, (_, index) =>
						game(`semi-${index}`, seed1, seed4, 99, 105),
					),
				],
			},
			"nba",
		);

		expect(bracket.west[0][0].winner).toBe("top");
		expect(bracket.west[0][1].winner).toBe("top");
		expect(bracket.west[1][0].topTeam?.espnTeamId).toBe("ONE");
		expect(bracket.west[1][0].bottomTeam?.espnTeamId).toBe("FOUR");
		expect(bracket.west[1][0].bottomWins).toBe(4);
		expect(bracket.west[1][0].winner).toBe("bottom");
	});
});

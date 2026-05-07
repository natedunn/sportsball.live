import { describe, expect, it } from "vitest";
import {
	getSeriesRecordForGame,
	isPlayoffScoreboardDate,
} from "@convex/shared/scoreboardSeries";

describe("isPlayoffScoreboardDate", () => {
	it("maps WNBA cross-year season strings to the correct playoff year", () => {
		expect(isPlayoffScoreboardDate("wnba", "2025-26", "2026-09-26")).toBe(false);
		expect(isPlayoffScoreboardDate("wnba", "2025-26", "2026-09-27")).toBe(true);
	});
});

describe("getSeriesRecordForGame", () => {
	it("counts prior completed series games even when home and away are reversed", () => {
		const currentGame = {
			_id: "game-3",
			season: "2025-26",
			homeTeamId: "knicks",
			awayTeamId: "pacers",
			gameDate: "2026-04-20",
			scheduledStart: 3_000,
			eventStatus: "scheduled" as const,
		};

		const candidateGames = [
			{
				_id: "game-1",
				season: "2025-26",
				homeTeamId: "knicks",
				awayTeamId: "pacers",
				gameDate: "2026-04-14",
				scheduledStart: 1_000,
				eventStatus: "completed" as const,
				homeScore: 110,
				awayScore: 100,
			},
			{
				_id: "game-2",
				season: "2025-26",
				homeTeamId: "pacers",
				awayTeamId: "knicks",
				gameDate: "2026-04-17",
				scheduledStart: 2_000,
				eventStatus: "completed" as const,
				homeScore: 99,
				awayScore: 104,
			},
		];

		expect(getSeriesRecordForGame("nba", currentGame, candidateGames)).toEqual({
			home: "2-0",
			away: "0-2",
		});
	});

	it("excludes the current game until it is completed", () => {
		const inProgressGame = {
			_id: "game-2",
			season: "2025-26",
			homeTeamId: "lynx",
			awayTeamId: "liberty",
			gameDate: "2026-09-28",
			scheduledStart: 2_000,
			eventStatus: "in_progress" as const,
			homeScore: 80,
			awayScore: 75,
		};

		const completedSeriesGame = {
			_id: "game-1",
			season: "2025-26",
			homeTeamId: "liberty",
			awayTeamId: "lynx",
			gameDate: "2026-09-27",
			scheduledStart: 1_000,
			eventStatus: "completed" as const,
			homeScore: 90,
			awayScore: 95,
		};

		expect(
			getSeriesRecordForGame("wnba", inProgressGame, [
				completedSeriesGame,
				inProgressGame,
			]),
		).toEqual({
			home: "1-0",
			away: "0-1",
		});

		expect(
			getSeriesRecordForGame("wnba", {
				...inProgressGame,
				eventStatus: "completed",
			}, [completedSeriesGame, { ...inProgressGame, eventStatus: "completed" }]),
		).toEqual({
			home: "2-0",
			away: "0-2",
		});
	});
});

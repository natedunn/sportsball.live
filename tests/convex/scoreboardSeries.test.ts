import { describe, expect, it } from "vitest";
import {
	getSeriesRecordForGame,
	isPlayoffGame,
	isPlayoffScoreboardDate,
} from "@convex/shared/scoreboardSeries";

describe("isPlayoffScoreboardDate", () => {
	it("maps WNBA cross-year season strings to the correct playoff year", () => {
		expect(isPlayoffScoreboardDate("wnba", "2025-26", "2026-09-26")).toBe(false);
		expect(isPlayoffScoreboardDate("wnba", "2025-26", "2026-09-27")).toBe(true);
	});

	it("rejects next-season games still tagged with the old season", () => {
		expect(isPlayoffScoreboardDate("nba", "2025-26", "2026-10-26")).toBe(false);
		expect(isPlayoffScoreboardDate("nba", "2025-26", "20261026")).toBe(false);
	});

	it("accepts games inside the default NBA playoff window", () => {
		expect(isPlayoffScoreboardDate("nba", "2025-26", "2026-04-13")).toBe(false);
		expect(isPlayoffScoreboardDate("nba", "2025-26", "2026-04-14")).toBe(true);
		expect(isPlayoffScoreboardDate("nba", "2025-26", "20260520")).toBe(true);
		expect(isPlayoffScoreboardDate("nba", "2025-26", "2026-06-30")).toBe(true);
		expect(isPlayoffScoreboardDate("nba", "2025-26", "2026-07-01")).toBe(false);
	});

	it("uses a configured playoff window over the defaults", () => {
		const window = { startDate: "2026-04-18", endDate: "2026-06-19" };
		expect(isPlayoffScoreboardDate("nba", "2025-26", "2026-04-15", window)).toBe(false);
		expect(isPlayoffScoreboardDate("nba", "2025-26", "2026-04-18", window)).toBe(true);
		expect(isPlayoffScoreboardDate("nba", "2025-26", "2026-06-20", window)).toBe(false);
	});
});

describe("isPlayoffGame", () => {
	const base = { season: "2025-26", gameDate: "2026-05-01" };

	it("trusts ESPN's postseason season type", () => {
		expect(isPlayoffGame("nba", { ...base, seasonType: 3 })).toBe(true);
		// Season type wins even outside the date window
		expect(isPlayoffGame("nba", { ...base, gameDate: "2026-03-01", seasonType: 3 })).toBe(true);
	});

	it("treats regular season and play-in games as non-playoff", () => {
		expect(isPlayoffGame("nba", { ...base, seasonType: 2 })).toBe(false);
		expect(isPlayoffGame("nba", { ...base, seasonType: 5 })).toBe(false);
	});

	it("falls back to the bounded date window for legacy games without a season type", () => {
		expect(isPlayoffGame("nba", { ...base, seasonType: undefined })).toBe(true);
		expect(isPlayoffGame("nba", { season: "2025-26", gameDate: "2026-03-01" })).toBe(false);
		expect(isPlayoffGame("nba", { season: "2025-26", gameDate: "2026-10-26" })).toBe(false);
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

	it("returns undefined for a regular-season game dated after playoff start", () => {
		// PHX "0-5" bug: a 2026-27 regular-season game stored under "2025-26"
		// fell inside the old unbounded playoff window and showed a series record.
		const phxGame = {
			_id: "phx-game",
			season: "2025-26",
			seasonType: 2,
			homeTeamId: "suns",
			awayTeamId: "lakers",
			gameDate: "2026-10-26",
			scheduledStart: 10_000,
			eventStatus: "scheduled" as const,
		};
		const priorMeetings = [1, 2, 3, 4, 5].map((n) => ({
			_id: `prior-${n}`,
			season: "2025-26",
			homeTeamId: "lakers",
			awayTeamId: "suns",
			gameDate: `2026-05-0${n}`,
			scheduledStart: n * 1_000,
			eventStatus: "completed" as const,
			homeScore: 110,
			awayScore: 100,
		}));

		expect(getSeriesRecordForGame("nba", phxGame, priorMeetings)).toBeUndefined();
		// Legacy row without a season type is rejected by the bounded date window
		expect(
			getSeriesRecordForGame("nba", { ...phxGame, seasonType: undefined }, priorMeetings),
		).toBeUndefined();
	});

	it("ignores play-in games when counting a series", () => {
		const currentGame = {
			_id: "game-2",
			season: "2025-26",
			seasonType: 3,
			homeTeamId: "knicks",
			awayTeamId: "pacers",
			gameDate: "2026-04-22",
			scheduledStart: 2_000,
			eventStatus: "scheduled" as const,
		};
		const playIn = {
			_id: "play-in",
			season: "2025-26",
			seasonType: 5,
			homeTeamId: "knicks",
			awayTeamId: "pacers",
			gameDate: "2026-04-15",
			scheduledStart: 1_000,
			eventStatus: "completed" as const,
			homeScore: 100,
			awayScore: 90,
		};

		expect(getSeriesRecordForGame("nba", currentGame, [playIn])).toEqual({
			home: "0-0",
			away: "0-0",
		});
	});
});

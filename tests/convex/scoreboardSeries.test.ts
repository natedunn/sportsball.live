import { describe, it, expect } from "vitest";
import { getSeriesRecordForGame, isPlayoffGame } from "@convex/shared/scoreboardSeries";

describe("isPlayoffGame", () => {
	it("trusts ESPN's postseason season type", () => {
		expect(isPlayoffGame({ seasonType: 3 })).toBe(true);
	});

	it("treats regular season, play-in and untyped games as non-playoff", () => {
		expect(isPlayoffGame({ seasonType: 2 })).toBe(false);
		expect(isPlayoffGame({ seasonType: 5 })).toBe(false);
		expect(isPlayoffGame({})).toBe(false);
	});
});

describe("getSeriesRecordForGame", () => {
	it("counts prior completed series games even when home and away are reversed", () => {
		const currentGame = {
			_id: "game-3",
			season: "2025-26",
			seasonType: 3,
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
				seasonType: 3,
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
				seasonType: 3,
				homeTeamId: "pacers",
				awayTeamId: "knicks",
				gameDate: "2026-04-17",
				scheduledStart: 2_000,
				eventStatus: "completed" as const,
				homeScore: 99,
				awayScore: 104,
			},
		];

		expect(getSeriesRecordForGame(currentGame, candidateGames)).toEqual({
			home: "2-0",
			away: "0-2",
		});
	});

	it("excludes the current game until it is completed", () => {
		const inProgressGame = {
			_id: "game-2",
			season: "2025-26",
			seasonType: 3,
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
			seasonType: 3,
			homeTeamId: "liberty",
			awayTeamId: "lynx",
			gameDate: "2026-09-27",
			scheduledStart: 1_000,
			eventStatus: "completed" as const,
			homeScore: 90,
			awayScore: 95,
		};

		expect(
			getSeriesRecordForGame(inProgressGame, [
				completedSeriesGame,
				inProgressGame,
			]),
		).toEqual({
			home: "1-0",
			away: "0-1",
		});

		expect(
			getSeriesRecordForGame({
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
			seasonType: 3,
			homeTeamId: "lakers",
			awayTeamId: "suns",
			gameDate: `2026-05-0${n}`,
			scheduledStart: n * 1_000,
			eventStatus: "completed" as const,
			homeScore: 110,
			awayScore: 100,
		}));

		expect(getSeriesRecordForGame(phxGame, priorMeetings)).toBeUndefined();
		// A row without a season type is never treated as a playoff game
		expect(
			getSeriesRecordForGame({ ...phxGame, seasonType: undefined }, priorMeetings),
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

		expect(getSeriesRecordForGame(currentGame, [playIn])).toEqual({
			home: "0-0",
			away: "0-0",
		});
	});
});

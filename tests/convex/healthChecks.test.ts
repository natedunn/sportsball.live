import { describe, it, expect } from "vitest";
import {
	diffBoxScore,
	diffRoster,
	findStaleJobs,
	resultFor,
	type TeamBoxLine,
} from "@convex/shared/healthChecks";

const box: TeamBoxLine = {
	score: 114,
	fieldGoalsMade: 39,
	fieldGoalsAttempted: 91,
	threePointMade: 18,
	threePointAttempted: 50,
	freeThrowsMade: 18,
	freeThrowsAttempted: 25,
	totalRebounds: 38,
	offensiveRebounds: 14,
	defensiveRebounds: 24,
	assists: 29,
	steals: 7,
	blocks: 5,
	turnovers: 12,
};

describe("diffBoxScore", () => {
	it("finds nothing when the box scores match", () => {
		expect(diffBoxScore(box, { ...box })).toEqual([]);
	});

	it("lists each field ESPN revised", () => {
		expect(diffBoxScore({ ...box, fieldGoalsAttempted: 92 }, box)).toEqual(["fieldGoalsAttempted 92→91"]);
	});
});

describe("diffRoster", () => {
	it("splits players into missing from ours and no longer on ESPN's", () => {
		expect(diffRoster(["1", "2", "3"], ["2", "3", "4"])).toEqual({ missing: ["4"], extra: ["1"] });
	});
});

describe("findStaleJobs", () => {
	const now = Date.UTC(2026, 9, 30, 19, 30);
	const hour = 60 * 60 * 1000;
	const maxAge = 50 * hour;
	const run = (job: string, league: "nba" | "wnba" | undefined, okHoursAgo: number | undefined, lastOk = true, summary?: string) => ({
		job,
		league,
		lastRanAt: now - hour,
		lastOk,
		lastOkAt: okHoursAgo === undefined ? undefined : now - okHoursAgo * hour,
		summary,
	});

	it("passes jobs that succeeded recently", () => {
		expect(findStaleJobs([run("refreshPlayers", "nba", 2)], [{ job: "refreshPlayers", league: "nba" }], now, maxAge)).toEqual([]);
	});

	it("tolerates one failed run after a recent success", () => {
		expect(
			findStaleJobs([run("refreshPlayers", "nba", 25, false, "ESPN down")], [{ job: "refreshPlayers", league: "nba" }], now, maxAge),
		).toEqual([]);
	});

	it("flags jobs that never ran, never succeeded, or haven't succeeded in too long", () => {
		expect(
			findStaleJobs(
				[
					run("refreshStandings", "nba", 60),
					run("refreshPlayers", "nba", undefined, false, "3 of 600 player stat lookups failed"),
					run("syncSchedule", "nba", 55, false),
				],
				[
					{ job: "discoverGames", league: "nba" },
					{ job: "refreshStandings", league: "nba" },
					{ job: "refreshPlayers", league: "nba" },
					{ job: "syncSchedule", league: "nba" },
				],
				now,
				maxAge,
			),
		).toEqual([
			"nba discoverGames: no run recorded",
			"nba refreshStandings: last succeeded 60h ago",
			"nba refreshPlayers: never succeeded; last run failed (3 of 600 player stat lookups failed)",
			"nba syncSchedule: last succeeded 55h ago; last run failed",
		]);
	});

	it("keeps leagues apart and handles cross-league jobs", () => {
		expect(
			findStaleJobs(
				[run("refreshPlayers", "nba", 1), run("syncSeasons", undefined, 1)],
				[{ job: "refreshPlayers", league: "wnba" }, { job: "syncSeasons" }],
				now,
				maxAge,
			),
		).toEqual(["wnba refreshPlayers: no run recorded"]);
	});
});

describe("resultFor", () => {
	const describe_ = { ok: "fine", repaired: "fixed", failing: "broken" };

	it("is ok when nothing was found", () => {
		expect(resultFor("nba", "games", [], [], describe_)).toMatchObject({ status: "ok", message: "fine" });
	});

	it("is repaired when everything found was fixed", () => {
		expect(resultFor("nba", "games", ["game 1"], [], describe_)).toMatchObject({
			status: "repaired",
			details: ["game 1"],
		});
	});

	it("is failing with what's still wrong", () => {
		expect(resultFor("nba", "games", ["game 1", "game 2"], ["game 2"], describe_)).toMatchObject({
			status: "failing",
			message: "broken",
			details: ["game 2"],
		});
	});
});

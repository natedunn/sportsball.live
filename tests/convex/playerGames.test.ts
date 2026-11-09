import { describe, expect, it } from "vitest";
import { assemblePlayerGames } from "@convex/shared/playerGames";

const REGULAR_SEASON = 2;
const line = (teamId: string, points: number) => ({
	teamId,
	starter: true,
	minutes: 30,
	points,
	totalRebounds: 5,
	offensiveRebounds: 1,
	defensiveRebounds: 4,
	assists: 3,
	steals: 1,
	blocks: 0,
	turnovers: 2,
	fouls: 1,
	fieldGoalsMade: 6,
	fieldGoalsAttempted: 12,
	threePointMade: 2,
	threePointAttempted: 5,
	freeThrowsMade: 2,
	freeThrowsAttempted: 2,
});

function game(day: number, home: string, away: string, status = "completed") {
	return {
		espnGameId: String(day),
		gameDate: `202611${String(day).padStart(2, "0")}`,
		scheduledStart: Date.UTC(2026, 10, day),
		seasonType: REGULAR_SEASON,
		eventStatus: status,
		homeScore: day % 2 ? 110 : 90,
		awayScore: 100,
		homeTeamId: home,
		awayTeamId: away,
	};
}

/** Days 1 to `days` at home to OPP, played on all but those in `missedDays` */
function season(days: number, missedDays: number[] = []) {
	const schedule = Array.from({ length: days }, (_, index) => game(index + 1, "T", "OPP"));
	return {
		currentTeamId: "T",
		schedule,
		played: schedule
			.filter((entry) => !missedDays.includes(Number(entry.espnGameId)))
			.map((entry) => ({ game: entry, line: line("T", Number(entry.espnGameId)) })),
		formerGames: [],
		absences: [],
		reports: [],
		options: { show: "all" as const },
		abbreviationFor: async (teamId: string) => teamId,
	};
}

describe("assemblePlayerGames", () => {
	it("returns the newest games first, up to the page size", async () => {
		const result = await assemblePlayerGames({ ...season(30), options: { pageSize: 20 } });
		expect(result.rows).toHaveLength(20);
		expect(result.rows[0].espnGameId).toBe("30");
		expect(result).toMatchObject({ total: 30, page: 1, pageCount: 2, played: 30 });
	});

	it("returns later pages and holds a page number past the end", async () => {
		const result = await assemblePlayerGames({ ...season(30), options: { pageSize: 20, page: 9 } });
		expect(result.page).toBe(2);
		expect(result.rows.map((row) => row.espnGameId).at(-1)).toBe("1");
		expect(result.rows).toHaveLength(10);
	});

	it("caps the page size", async () => {
		const result = await assemblePlayerGames({ ...season(30), options: { pageSize: 1000 } });
		expect(result.rows).toHaveLength(30);
		const many = await assemblePlayerGames({
			...season(30),
			schedule: season(60).schedule,
			played: season(60).played,
			options: { pageSize: 1000 },
		});
		expect(many.rows).toHaveLength(50);
	});

	it("shows a missed game as zeros with its reason", async () => {
		const result = await assemblePlayerGames({ ...season(3, [2]), options: { show: "all" } });
		expect(result.rows.find((row) => row.espnGameId === "2")).toMatchObject({
			missedReason: "Reason unknown",
			pts: 0,
			fga: 0,
			starter: false,
			opponent: "OPP",
			teamAbbreviation: "T",
		});
		expect(result).toMatchObject({ played: 2, missed: 1 });
	});

	it("leaves out games that haven't finished", async () => {
		const input = season(3);
		const result = await assemblePlayerGames({
			...input,
			schedule: [...input.schedule, game(4, "T", "OPP", "scheduled")],
		});
		expect(result.total).toBe(3);
	});

	it("links a game missed to injury to its entry", async () => {
		const result = await assemblePlayerGames({
			...season(3, [2]),
			absences: [{ espnGameId: "2", gameDate: "20261102", phase: "regular", reason: "SORE LEFT KNEE" }],
		});
		expect(result.injuries[0].label).toBe("Sore Left Knee");
		expect(result.rows.find((row) => row.espnGameId === "2")?.injuryIndex).toBe(0);
		expect(result.missedToInjury).toBe(1);
	});

	it("lists only played games by default and keeps the season's numbers", async () => {
		const result = await assemblePlayerGames({ ...season(5, [2, 4]), options: {} });
		expect(result.rows.map((row) => row.espnGameId)).toEqual(["5", "3", "1"]);
		expect(result).toMatchObject({ total: 3, played: 3, missed: 2 });
	});

	it("still knows a player who hasn't played has games", async () => {
		const result = await assemblePlayerGames({ ...season(3, [1, 2, 3]), options: {} });
		expect(result.rows).toEqual([]);
		expect(result.phases).toEqual(["regular"]);
	});

	it("filters by venue and result", async () => {
		expect((await assemblePlayerGames({ ...season(4), options: { split: "road" } })).total).toBe(0);
		expect((await assemblePlayerGames({ ...season(4), options: { split: "wins" } })).total).toBe(2);
	});

	it("sorts by a stat across every page", async () => {
		const result = await assemblePlayerGames({
			...season(30),
			options: { sort: "pts", dir: "asc", pageSize: 5 },
		});
		expect(result.rows.map((row) => row.pts)).toEqual([1, 2, 3, 4, 5]);
	});

	it("only looks up the teams on the page", async () => {
		const looked: string[] = [];
		await assemblePlayerGames({
			...season(30),
			abbreviationFor: async (teamId) => {
				looked.push(teamId);
				return teamId;
			},
		});
		expect(looked.sort()).toEqual(["OPP", "T"]);
	});

	it("doesn't count a traded player as missing their new team's earlier games", async () => {
		const early = game(1, "T", "OPP");
		const oldTeam = game(2, "OLD", "OPP");
		const late = game(3, "T", "OPP");
		const result = await assemblePlayerGames({
			currentTeamId: "T",
			schedule: [early, late],
			played: [
				{ game: oldTeam, line: line("OLD", 10) },
				{ game: late, line: line("T", 12) },
			],
			formerGames: [],
			absences: [],
			reports: [],
			options: { show: "all" as const },
			abbreviationFor: async (teamId) => teamId,
		});
		expect(result).toMatchObject({ total: 2, missed: 0 });
		expect(result.rows.find((row) => row.espnGameId === "2")?.teamAbbreviation).toBe("OLD");
	});

	it("shows a game sat out for a former team with its opponent", async () => {
		const sat = game(1, "OPP", "OLD");
		const late = game(3, "T", "OPP");
		const result = await assemblePlayerGames({
			currentTeamId: "T",
			schedule: [late],
			played: [{ game: late, line: line("T", 12) }],
			formerGames: [{ game: sat, teamId: "OLD" }],
			absences: [{ espnGameId: "1", gameDate: "20261101", phase: "regular", reason: "PERSONAL" }],
			reports: [],
			options: { show: "all" as const },
			abbreviationFor: async (teamId) => teamId,
		});
		expect(result.rows.find((row) => row.espnGameId === "1")).toMatchObject({
			opponent: "OPP",
			teamAbbreviation: "OLD",
			isHome: false,
			missedReason: "Personal",
		});
	});
});

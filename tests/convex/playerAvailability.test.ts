import { describe, expect, it } from "vitest";
import {
	summarizeAvailability,
	type GameAbsence,
	type InjuryReportEntry,
} from "@convex/shared/playerAvailability";

function absence(gameDate: string, reason: string, phase: GameAbsence["phase"] = "regular"): GameAbsence {
	return { espnGameId: gameDate, gameDate, phase, reason };
}

const started = (gameDate: string) => ({ gameDate, phase: "regular" as const, starter: true });
const bench = (gameDate: string) => ({ gameDate, phase: "regular" as const, starter: false });
const team = (...dates: string[]) => dates.map((gameDate) => ({ gameDate, phase: "regular" as const }));

const summarize = (args: Partial<Parameters<typeof summarizeAvailability>[0]>) =>
	summarizeAvailability({
		played: [],
		teamGames: [],
		absences: [],
		reports: [],
		now: Date.parse("2026-11-05"),
		...args,
	});

function report(fields: Partial<InjuryReportEntry>): InjuryReportEntry {
	return { status: "Out", firstSeenAt: Date.parse("2026-11-04"), ...fields };
}

describe("summarizeAvailability", () => {
	it("counts games played, started and missed", () => {
		const summary = summarize({
			played: [started("20261101"), bench("20261102"), started("20261103")],
			teamGames: team("20261101", "20261102", "20261103", "20261104"),
		});
		expect(summary).toMatchObject({ played: 3, started: 2, missed: 1, availability: 75 });
		expect(summary.games.map((game) => game.outcome)).toEqual(["started", "bench", "started", "missed"]);
	});

	it("has no availability before any games", () => {
		expect(summarize({}).availability).toBeNull();
	});

	it("uses the box score's reason first", () => {
		const { games } = summarize({
			teamGames: team("20261101"),
			absences: [absence("20261101", "RIGHT ACL SURGERY")],
			reports: [report({ description: "Knee", reportedAt: "2026-10-30T12:00Z" })],
		});
		expect(games[0].reason).toBe("Right ACL Surgery");
	});

	it("uses the injury report for a player off the box score", () => {
		const { injuries, missed } = summarize({
			teamGames: team("20261101", "20261103"),
			reports: [report({ description: "Left Shoulder Surgery", reportedAt: "2026-09-11T12:00Z" })],
		});
		expect(missed).toBe(2);
		expect(injuries).toEqual([
			expect.objectContaining({
				label: "Left Shoulder Surgery",
				games: 2,
				ongoing: true,
				startDate: "20260911",
			}),
		]);
	});

	it("prefers a report over a box score that only says inactive", () => {
		const { games } = summarize({
			teamGames: team("20261101"),
			absences: [absence("20261101", "INACTIVE")],
			reports: [report({ description: "Ankle Sprain", reportedAt: "2026-10-30T12:00Z" })],
		});
		expect(games[0].reason).toBe("Ankle Sprain");
	});

	it("puts games just before a report down to it", () => {
		const { injuries } = summarize({
			played: [bench("20261030")],
			teamGames: team("20261030", "20261101"),
			reports: [report({ description: "Sore Knee", reportedAt: "2026-11-02T12:00Z" })],
		});
		expect(injuries[0]).toMatchObject({ label: "Sore Knee", games: 1 });
	});

	it("ignores a report closed before the game", () => {
		const { games } = summarize({
			teamGames: team("20261103"),
			reports: [
				report({
					description: "Sore Knee",
					reportedAt: "2026-10-20T12:00Z",
					clearedAt: Date.parse("2026-10-25"),
				}),
			],
		});
		expect(games[0].reason).toBe("Reason unknown");
	});

	it("reads an unexplained game as a likely injury for a usual starter", () => {
		const played = [started("20261101"), started("20261102"), started("20261103")];
		const { games, injuries } = summarize({ played, teamGames: team("20261104") });
		expect(games.at(-1)?.reason).toBe("Likely injury, unconfirmed");
		expect(injuries).toEqual([]);
	});

	it("doesn't guess for a bench player", () => {
		const played = [bench("20261101"), bench("20261102"), bench("20261103")];
		const { games } = summarize({ played, teamGames: team("20261104") });
		expect(games.at(-1)?.reason).toBe("Reason unknown");
	});

	it("doesn't guess from too few games", () => {
		const { games } = summarize({ played: [started("20261101")], teamGames: team("20261102") });
		expect(games.at(-1)?.reason).toBe("Reason unknown");
	});

	it("leaves coach's decisions out of the injury list", () => {
		const { injuries, games } = summarize({
			played: [bench("20261102")],
			absences: [absence("20261101", "COACH'S DECISION")],
		});
		expect(injuries).toEqual([]);
		expect(games[0].reason).toBe("Coach's Decision");
	});

	it("lists a new injury after the player returns", () => {
		const { injuries } = summarize({
			played: [bench("20261103")],
			absences: [absence("20261101", "SORE LEFT KNEE"), absence("20261105", "HEAD CONCUSSION")],
		});
		expect(injuries.map((injury) => injury.label)).toEqual(["Head Concussion", "Sore Left Knee"]);
	});

	it("splits the same injury once the player has returned", () => {
		const { injuries } = summarize({
			played: [bench("20261103")],
			absences: [absence("20261101", "SORE LEFT KNEE"), absence("20261105", "SORE LEFT KNEE")],
		});
		expect(injuries).toHaveLength(2);
	});

	it("joins an injury whose wording changes, using the latest", () => {
		const { injuries } = summarize({
			absences: [absence("20261101", "SORE LEFT KNEE"), absence("20261103", "LEFT MENISCUS SURGERY")],
		});
		expect(injuries).toEqual([expect.objectContaining({ label: "Left Meniscus Surgery", games: 2 })]);
	});

	it("records which games an injury cost", () => {
		const { injuries } = summarize({
			played: [bench("20261103")],
			absences: [absence("20261101", "SORE LEFT KNEE"), absence("20261102", "SORE LEFT KNEE")],
		});
		expect(injuries[0].gameDates).toEqual(["20261101", "20261102"]);
	});

	it("keeps different sides and body parts apart", () => {
		const { injuries } = summarize({
			absences: [
				absence("20261101", "SORE LEFT KNEE"),
				absence("20261103", "SORE RIGHT KNEE"),
				absence("20261105", "RIGHT ANKLE SPRAIN"),
			],
		});
		expect(injuries).toHaveLength(3);
	});

	it("keeps every update along the way, not only the latest", () => {
		const { injuries } = summarize({
			teamGames: team("20261101", "20261103"),
			reports: [
				report({
					description: "Left Ankle Sprain",
					reportedAt: "2026-10-30T12:00Z",
					shortComment: "Hurt in practice",
					clearedAt: Date.parse("2026-11-02"),
				}),
				report({
					description: "Left Ankle Sprain",
					reportedAt: "2026-11-02T12:00Z",
					status: "Questionable",
					shortComment: "Back at practice",
				}),
			],
		});
		expect(injuries).toHaveLength(1);
		expect(injuries[0].updates).toEqual([
			{ date: "20261030", status: "Out", comment: "Hurt in practice" },
			{ date: "20261102", status: "Questionable", comment: "Back at practice" },
		]);
	});

	it("lists an off-season injury that cost no games if they were ruled out", () => {
		const { injuries } = summarize({
			played: [bench("20261101")],
			reports: [
				report({
					description: "Right Wrist Surgery",
					reportedAt: "2026-08-01T12:00Z",
					clearedAt: Date.parse("2026-10-01"),
				}),
			],
		});
		expect(injuries[0]).toMatchObject({ label: "Right Wrist Surgery", games: 0, ongoing: false });
	});

	it("leaves out a knock they played through", () => {
		const { injuries } = summarize({
			played: [bench("20261101")],
			reports: [report({ status: "Day-To-Day", description: "Sore Ankle", reportedAt: "2026-10-30T12:00Z" })],
		});
		expect(injuries).toEqual([]);
	});

	it("leaves out an injury from a past season", () => {
		const { injuries } = summarize({
			played: [bench("20261101")],
			reports: [
				report({
					description: "Right Wrist Surgery",
					reportedAt: "2025-01-01T12:00Z",
					clearedAt: Date.parse("2025-03-01"),
				}),
			],
		});
		expect(injuries).toEqual([]);
	});

	it("keeps a game with a former team that isn't in the current team's schedule", () => {
		const { missed, games } = summarize({
			played: [bench("20261103")],
			teamGames: team("20261103"),
			absences: [absence("20261101", "PERSONAL")],
		});
		expect(missed).toBe(1);
		expect(games[0]).toMatchObject({ outcome: "missed", reason: "Personal" });
	});

	it("reports playoffs apart from the regular season", () => {
		const summary = summarize({
			played: [
				started("20261101"),
				{ gameDate: "20270420", phase: "playoffs", starter: true },
			],
			absences: [absence("20270422", "SORE LEFT KNEE", "playoffs")],
		});
		expect(summary).toMatchObject({ played: 1, missed: 0, availability: 100 });
		expect(summary.playoffs).toEqual({ played: 1, games: 2 });
	});
});

import { describe, expect, it } from "vitest";
import {
	buildBracket,
	buildLeagueBracket,
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

describe("buildLeagueBracket", () => {
	// The 2026 WNBA playoffs: seeds from the league table, best of three, five
	// and seven
	const seeded = (id: string, leagueRank: number, conference: string) => ({
		...team(id, 0),
		conference,
		conferenceRank: undefined,
		leagueRank,
	});
	const MIN = seeded("MIN", 1, "Western");
	const GS = seeded("GS", 2, "Western");
	const LV = seeded("LV", 3, "Western");
	const ATL = seeded("ATL", 4, "Eastern");
	const WSH = seeded("WSH", 5, "Eastern");
	const IND = seeded("IND", 6, "Eastern");
	const DAL = seeded("DAL", 7, "Western");
	const NY = seeded("NY", 8, "Eastern");
	const POR = seeded("POR", 9, "Western");

	let id = 0;
	// Home team listed first, as on the scoreboard
	const g = (home: TestTeam, away: TestTeam, homeScore: number, awayScore: number) =>
		game(`g${++id}`, home, away, homeScore, awayScore);

	const data: PlayoffBracketData = {
		teams: [MIN, GS, LV, ATL, WSH, IND, DAL, NY, POR],
		games: [
			g(MIN, NY, 75, 91),
			g(LV, IND, 102, 85),
			g(ATL, WSH, 92, 77),
			g(GS, DAL, 104, 80),
			g(IND, LV, 99, 89),
			g(NY, MIN, 87, 71),
			g(WSH, ATL, 75, 93),
			g(DAL, GS, 108, 100),
			g(LV, IND, 94, 83),
			g(GS, DAL, 77, 73),
			g(ATL, NY, 92, 82),
			g(GS, LV, 71, 60),
			g(ATL, NY, 101, 98),
			g(GS, LV, 83, 81),
			g(NY, ATL, 83, 85),
			g(LV, GS, 77, 87),
			g(GS, ATL, 68, 64),
			g(GS, ATL, 65, 79),
			g(ATL, GS, 97, 71),
			g(ATL, GS, 62, 67),
			g(GS, ATL, 64, 55),
			g(ATL, GS, 80, 69),
			g(GS, ATL, 68, 63),
		],
	};

	it("seeds 1 to 8 across conferences and plays three rounds to a champion", () => {
		const rounds = buildLeagueBracket(data, "wnba");
		expect(rounds.map((r) => r.length)).toEqual([4, 2, 1]);

		const [first, semis, [finals]] = rounds;
		expect(
			first.map((s) => [s.topTeam?.seed, s.bottomTeam?.seed, s.topWins, s.bottomWins]),
		).toEqual([
			[1, 8, 0, 2],
			[4, 5, 2, 0],
			[3, 6, 2, 1],
			[2, 7, 2, 1],
		]);
		expect(first.every((s) => s.status === "completed")).toBe(true);

		expect(semis[0].topTeam?.espnTeamId).toBe("NY");
		expect(semis[0].bottomTeam?.espnTeamId).toBe("ATL");
		expect(semis[0].winner).toBe("bottom");
		expect(semis[1].winner).toBe("bottom");
		expect(semis[1].bottomTeam?.espnTeamId).toBe("GS");

		expect(finals.topTeam?.espnTeamId).toBe("ATL");
		expect(finals.bottomTeam?.espnTeamId).toBe("GS");
		expect([finals.topWins, finals.bottomWins]).toEqual([3, 4]);
		expect(finals.winner).toBe("bottom");
	});

	it("keeps a series open until a team reaches that round's wins", () => {
		const rounds = buildLeagueBracket(
			{ ...data, games: data.games.slice(0, 16) },
			"wnba",
		);
		// Semifinals at 3-0 are done; the Finals have not started
		expect(rounds[1][1].status).toBe("completed");
		expect(rounds[2][0].status).toBe("upcoming");

		const midFinals = buildLeagueBracket(
			{ ...data, games: data.games.slice(0, 19) },
			"wnba",
		);
		expect(midFinals[2][0].status).toBe("active");
		expect(midFinals[2][0].winner).toBeNull();
	});
});

describe("buildBracket for the G League", () => {
	// The 2025-26 G League playoffs: single-game rounds, best-of-three Finals
	const side = (id: string, conference: string, rank: number) => ({
		...team(id, rank),
		conference,
	});
	const [OSC, GBO, CLC, RAP, MCC, CAP, MNE, LIN] = [
		"OSC", "GBO", "CLC", "RAP", "MCC", "CAP", "MNE", "LIN",
	].map((id, i) => side(id, "East", i + 1));
	const [SBL, MXC, STO, RGV, AUS, IWA, RCY, SAN] = [
		"SBL", "MXC", "STO", "RGV", "AUS", "IWA", "RCY", "SAN",
	].map((id, i) => side(id, "West", i + 1));

	let id = 0;
	const g = (home: TestTeam, away: TestTeam, homeScore: number, awayScore: number) =>
		game(`g${++id}`, home, away, homeScore, awayScore);

	const data: PlayoffBracketData = {
		teams: [OSC, GBO, CLC, RAP, MCC, CAP, MNE, LIN, SBL, MXC, STO, RGV, AUS, IWA, RCY, SAN],
		games: [
			g(GBO, MNE, 112, 90),
			g(RAP, MCC, 105, 120),
			g(RGV, AUS, 117, 106),
			g(CLC, CAP, 123, 126),
			g(OSC, LIN, 119, 117),
			g(STO, IWA, 116, 104),
			g(MXC, RCY, 108, 113),
			g(SBL, SAN, 122, 119),
			g(OSC, MCC, 123, 116),
			g(GBO, CAP, 118, 108),
			g(SBL, RGV, 112, 97),
			g(STO, RCY, 107, 95),
			g(OSC, GBO, 121, 134),
			g(SBL, STO, 97, 101),
			g(GBO, STO, 111, 107),
			g(STO, GBO, 104, 119),
		],
	};

	it("settles each conference round in one game, showing its score", () => {
		const bracket = buildBracket(data, "gleague");
		const [first, second, [final]] = bracket.east;

		expect(first.every((s) => s.status === "completed")).toBe(true);
		expect(first[0].winner).toBe("top");
		expect(first[0].score).toEqual({ top: 119, bottom: 117 });
		expect(first[1].topTeam?.espnTeamId).toBe("RAP");
		expect(first[1].score).toEqual({ top: 105, bottom: 120 });
		expect(first[1].winner).toBe("bottom");

		expect(second.map((s) => s.winner)).toEqual(["top", "bottom"]);
		expect(final.topTeam?.espnTeamId).toBe("OSC");
		expect(final.bottomTeam?.espnTeamId).toBe("GBO");
		expect(final.winner).toBe("bottom");
		expect(bracket.west[2][0].winner).toBe("bottom");
	});

	it("plays the Finals to two wins", () => {
		const { finals } = buildBracket(data, "gleague");
		expect(finals.topTeam?.espnTeamId).toBe("STO");
		expect(finals.bottomTeam?.espnTeamId).toBe("GBO");
		expect([finals.topWins, finals.bottomWins]).toEqual([0, 2]);
		expect(finals.winner).toBe("bottom");
		expect(finals.score).toBeUndefined();

		const afterOne = buildBracket({ ...data, games: data.games.slice(0, 15) }, "gleague");
		expect(afterOne.finals.status).toBe("active");
	});
});

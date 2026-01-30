import { createServerFn } from "@tanstack/react-start";
import type {
	LeagueLeadersResponse,
	CategoryLeaders,
	LeaderEntry,
	LeaderPlayer,
} from "./types";

type League = "nba" | "wnba" | "gleague";

interface EspnAthlete {
	id: string;
	displayName: string;
	firstName: string;
	lastName: string;
	jersey?: string;
	headshot?: {
		href: string;
	};
}

interface EspnTeam {
	id: string;
	displayName: string;
	abbreviation: string;
	logos?: Array<{ href: string }>;
}

interface EspnLeaderEntry {
	value: number;
	displayValue: string;
	athlete: EspnAthlete;
	team?: EspnTeam;
}

interface EspnCategory {
	name: string;
	displayName: string;
	abbreviation: string;
	leaders: EspnLeaderEntry[];
}

interface EspnLeadersResponse {
	leaders?: {
		categories?: EspnCategory[];
	};
}

function getLeagueEndpoint(league: League): string {
	switch (league) {
		case "nba":
			return "https://site.api.espn.com/apis/site/v3/sports/basketball/nba/leaders";
		case "wnba":
			return "https://site.api.espn.com/apis/site/v3/sports/basketball/wnba/leaders";
		case "gleague":
			return "https://site.api.espn.com/apis/site/v3/sports/basketball/nba-g-league/leaders";
	}
}

function mapPlayer(entry: EspnLeaderEntry): LeaderPlayer {
	return {
		id: entry.athlete.id,
		name: entry.athlete.displayName,
		firstName: entry.athlete.firstName,
		lastName: entry.athlete.lastName,
		headshot: entry.athlete.headshot?.href,
		jersey: entry.athlete.jersey,
		team: {
			id: entry.team?.id ?? "",
			name: entry.team?.displayName ?? "",
			abbreviation: entry.team?.abbreviation ?? "",
			logo: entry.team?.logos?.[0]?.href,
		},
	};
}

function mapCategory(
	category: EspnCategory,
	categoryKey: "pts" | "ast" | "reb",
	limit: number = 5,
): CategoryLeaders {
	const abbrevMap = { pts: "PTS", ast: "AST", reb: "REB" };
	const nameMap = { pts: "Points", ast: "Assists", reb: "Rebounds" };

	return {
		category: categoryKey,
		displayName: nameMap[categoryKey],
		abbreviation: abbrevMap[categoryKey],
		leaders: category.leaders.slice(0, limit).map((entry) => ({
			player: mapPlayer(entry),
			value: entry.value,
			displayValue: entry.displayValue,
		})),
	};
}

function calculateStocks(
	stealsCategory: EspnCategory | undefined,
	blocksCategory: EspnCategory | undefined,
	limit: number = 5,
): CategoryLeaders {
	// Build a map of player stats
	const playerStats = new Map<
		string,
		{
			entry: EspnLeaderEntry;
			steals: number;
			blocks: number;
		}
	>();

	// Add steals data
	if (stealsCategory) {
		for (const entry of stealsCategory.leaders) {
			playerStats.set(entry.athlete.id, {
				entry,
				steals: entry.value,
				blocks: 0,
			});
		}
	}

	// Add/merge blocks data
	if (blocksCategory) {
		for (const entry of blocksCategory.leaders) {
			const existing = playerStats.get(entry.athlete.id);
			if (existing) {
				existing.blocks = entry.value;
			} else {
				playerStats.set(entry.athlete.id, {
					entry,
					steals: 0,
					blocks: entry.value,
				});
			}
		}
	}

	// Calculate combined stock and sort
	const stockLeaders = Array.from(playerStats.values())
		.map(({ entry, steals, blocks }) => ({
			player: mapPlayer(entry),
			value: steals + blocks,
			displayValue: (steals + blocks).toFixed(1),
			breakdown: { steals, blocks },
		}))
		.sort((a, b) => b.value - a.value)
		.slice(0, limit);

	return {
		category: "stock",
		displayName: "Stocks",
		abbreviation: "STK",
		leaders: stockLeaders,
	};
}

function emptyLeadersResponse(): LeagueLeadersResponse {
	return {
		points: { category: "pts", displayName: "Points", abbreviation: "PTS", leaders: [] },
		assists: { category: "ast", displayName: "Assists", abbreviation: "AST", leaders: [] },
		rebounds: { category: "reb", displayName: "Rebounds", abbreviation: "REB", leaders: [] },
		stocks: { category: "stock", displayName: "Stocks", abbreviation: "STK", leaders: [] },
	};
}

async function fetchLeaders(league: League): Promise<LeagueLeadersResponse> {
	const endpoint = getLeagueEndpoint(league);

	const response = await fetch(endpoint, {
		headers: {
			"User-Agent": "Mozilla/5.0",
			Accept: "application/json",
		},
	});

	// ESPN doesn't support leaders for all leagues (e.g., G-League returns 400)
	if (!response.ok) {
		return emptyLeadersResponse();
	}

	const data = (await response.json()) as EspnLeadersResponse;
	const categories = data.leaders?.categories ?? [];

	// Find the categories we need
	const pointsCategory = categories.find((c) => c.name === "pointsPerGame");
	const assistsCategory = categories.find((c) => c.name === "assistsPerGame");
	const reboundsCategory = categories.find((c) => c.name === "reboundsPerGame");
	const stealsCategory = categories.find((c) => c.name === "stealsPerGame");
	const blocksCategory = categories.find((c) => c.name === "blocksPerGame");

	// Map to our format
	const emptyCategory = (
		cat: "pts" | "ast" | "reb",
	): CategoryLeaders => ({
		category: cat,
		displayName: cat === "pts" ? "Points" : cat === "ast" ? "Assists" : "Rebounds",
		abbreviation: cat.toUpperCase(),
		leaders: [],
	});

	return {
		points: pointsCategory
			? mapCategory(pointsCategory, "pts")
			: emptyCategory("pts"),
		assists: assistsCategory
			? mapCategory(assistsCategory, "ast")
			: emptyCategory("ast"),
		rebounds: reboundsCategory
			? mapCategory(reboundsCategory, "reb")
			: emptyCategory("reb"),
		stocks: calculateStocks(stealsCategory, blocksCategory),
	};
}

export const fetchNbaLeaders = createServerFn({ method: "GET" }).handler(
	async (): Promise<LeagueLeadersResponse> => {
		return fetchLeaders("nba");
	},
);

export const fetchWnbaLeaders = createServerFn({ method: "GET" }).handler(
	async (): Promise<LeagueLeadersResponse> => {
		return fetchLeaders("wnba");
	},
);

// G-League uses a different API (stats.gleague.nba.com)
interface GLeagueLeaderRow {
	playerId: string;
	rank: number;
	playerName: string;
	teamId: string;
	teamAbbr: string;
	pts: number;
	ast: number;
	reb: number;
	stl: number;
	blk: number;
}

function getCurrentGLeagueSeason(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth();
	const startYear = month < 8 ? year - 1 : year;
	return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

async function fetchGLeagueLeadersByCategory(
	category: "PTS" | "AST" | "REB" | "STL" | "BLK",
): Promise<GLeagueLeaderRow[]> {
	const baseUrl =
		process.env.GLEAGUE_STATS_API_BASE ?? "https://stats.gleague.nba.com/stats";
	const season = getCurrentGLeagueSeason();

	const response = await fetch(
		`${baseUrl}/leagueleaders?LeagueID=20&Season=${season}&SeasonType=Regular%20Season&PerMode=PerGame&Scope=S&StatCategory=${category}`,
		{
			headers: {
				"User-Agent": "Mozilla/5.0",
				Referer: "https://stats.gleague.nba.com/",
			},
		},
	);

	if (!response.ok) {
		return [];
	}

	const data = (await response.json()) as {
		resultSet: { headers: string[]; rowSet: (string | number)[][] };
	};

	const headers = data.resultSet.headers;
	const rows = data.resultSet.rowSet;

	// Map header indices
	const idx = {
		playerId: headers.indexOf("PLAYER_ID"),
		rank: headers.indexOf("RANK"),
		player: headers.indexOf("PLAYER"),
		teamId: headers.indexOf("TEAM_ID"),
		team: headers.indexOf("TEAM"),
		pts: headers.indexOf("PTS"),
		ast: headers.indexOf("AST"),
		reb: headers.indexOf("REB"),
		stl: headers.indexOf("STL"),
		blk: headers.indexOf("BLK"),
	};

	return rows.slice(0, 10).map((row) => ({
		playerId: String(row[idx.playerId]),
		rank: Number(row[idx.rank]),
		playerName: String(row[idx.player]),
		teamId: String(row[idx.teamId]),
		teamAbbr: String(row[idx.team]),
		pts: Number(row[idx.pts]),
		ast: Number(row[idx.ast]),
		reb: Number(row[idx.reb]),
		stl: Number(row[idx.stl]),
		blk: Number(row[idx.blk]),
	}));
}

function mapGLeagueLeader(
	row: GLeagueLeaderRow,
	statKey: "pts" | "ast" | "reb",
): LeaderEntry {
	const statValue = row[statKey];
	return {
		player: {
			id: row.playerId,
			name: row.playerName,
			firstName: row.playerName.split(" ")[0] ?? "",
			lastName: row.playerName.split(" ").slice(1).join(" ") ?? "",
			headshot: `/api/headshot/${row.playerId}`,
			team: {
				id: row.teamId,
				name: row.teamAbbr,
				abbreviation: row.teamAbbr,
			},
		},
		value: statValue,
		displayValue: statValue.toFixed(1),
	};
}

async function fetchGLeagueLeadersData(): Promise<LeagueLeadersResponse> {
	try {
		const [ptsLeaders, astLeaders, rebLeaders, stlLeaders, blkLeaders] =
			await Promise.all([
				fetchGLeagueLeadersByCategory("PTS"),
				fetchGLeagueLeadersByCategory("AST"),
				fetchGLeagueLeadersByCategory("REB"),
				fetchGLeagueLeadersByCategory("STL"),
				fetchGLeagueLeadersByCategory("BLK"),
			]);

		// Calculate stocks by combining steals and blocks
		const playerStocks = new Map<
			string,
			{ row: GLeagueLeaderRow; stl: number; blk: number }
		>();

		for (const row of stlLeaders) {
			playerStocks.set(row.playerId, { row, stl: row.stl, blk: 0 });
		}
		for (const row of blkLeaders) {
			const existing = playerStocks.get(row.playerId);
			if (existing) {
				existing.blk = row.blk;
			} else {
				playerStocks.set(row.playerId, { row, stl: 0, blk: row.blk });
			}
		}

		const stockLeaders = Array.from(playerStocks.values())
			.map(({ row, stl, blk }) => ({
				player: {
					id: row.playerId,
					name: row.playerName,
					firstName: row.playerName.split(" ")[0] ?? "",
					lastName: row.playerName.split(" ").slice(1).join(" ") ?? "",
					headshot: `/api/headshot/${row.playerId}`,
					team: {
						id: row.teamId,
						name: row.teamAbbr,
						abbreviation: row.teamAbbr,
					},
				},
				value: stl + blk,
				displayValue: (stl + blk).toFixed(1),
				breakdown: { steals: stl, blocks: blk },
			}))
			.sort((a, b) => b.value - a.value)
			.slice(0, 5);

		return {
			points: {
				category: "pts",
				displayName: "Points",
				abbreviation: "PTS",
				leaders: ptsLeaders.slice(0, 5).map((r) => mapGLeagueLeader(r, "pts")),
			},
			assists: {
				category: "ast",
				displayName: "Assists",
				abbreviation: "AST",
				leaders: astLeaders.slice(0, 5).map((r) => mapGLeagueLeader(r, "ast")),
			},
			rebounds: {
				category: "reb",
				displayName: "Rebounds",
				abbreviation: "REB",
				leaders: rebLeaders.slice(0, 5).map((r) => mapGLeagueLeader(r, "reb")),
			},
			stocks: {
				category: "stock",
				displayName: "Stocks",
				abbreviation: "STK",
				leaders: stockLeaders,
			},
		};
	} catch {
		return emptyLeadersResponse();
	}
}

export const fetchGLeagueLeaders = createServerFn({ method: "GET" }).handler(
	async (): Promise<LeagueLeadersResponse> => {
		return fetchGLeagueLeadersData();
	},
);

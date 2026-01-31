import { v } from "convex/values";
import { query, action, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Types for ESPN API responses
interface EspnTeamStats {
	name: string;
	value: number;
}

interface EspnTeamStatsResponse {
	results?: {
		stats?: {
			categories?: Array<{
				name: string;
				stats: EspnTeamStats[];
			}>;
		};
	};
}

interface StandingsTeamEntry {
	team: {
		id: string;
		displayName: string;
		abbreviation: string;
	};
	stats: Array<{
		name: string;
		value: number;
	}>;
}

interface StandingsResponse {
	children?: Array<{
		standings?: {
			entries?: StandingsTeamEntry[];
		};
	}>;
}

type League = "nba" | "wnba" | "gleague";

// Helper to get stat value
function getStat(stats: Array<{ name: string; value: number }>, name: string): number {
	return stats.find((s) => s.name === name)?.value ?? 0;
}

// Calculate possessions using the standard formula
function calculatePossessions(
	fga: number,
	fta: number,
	oreb: number,
	tov: number,
): number {
	// Possessions ≈ FGA + 0.44 × FTA - OREB + TOV
	return fga + 0.44 * fta - oreb + tov;
}

// Query to get all team stats for a league
export const getByLeague = query({
	args: { league: v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague")) },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("teamStats")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.collect();
	},
});

// Query to get top teams by a specific stat
export const getTopTeams = query({
	args: {
		league: v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague")),
		stat: v.union(
			v.literal("offensiveRating"),
			v.literal("defensiveRating"),
			v.literal("netRating"),
			v.literal("pace"),
		),
		limit: v.optional(v.number()),
		ascending: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const teams = await ctx.db
			.query("teamStats")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.collect();

		const limit = args.limit ?? 5;
		const ascending = args.ascending ?? false;

		// Sort by the requested stat
		teams.sort((a, b) => {
			const aVal = a[args.stat];
			const bVal = b[args.stat];
			return ascending ? aVal - bVal : bVal - aVal;
		});

		return teams.slice(0, limit);
	},
});

// Internal mutation to upsert team stats
// NOTE: Only stores dynamic stats - static data (logos, colors) comes from client-side registry
export const upsertTeamStats = internalMutation({
	args: {
		league: v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague")),
		teamId: v.string(),
		teamName: v.string(),
		abbreviation: v.string(),
		wins: v.number(),
		losses: v.number(),
		pointsFor: v.number(),
		pointsAgainst: v.number(),
		pace: v.number(),
		offensiveRating: v.number(),
		defensiveRating: v.number(),
		netRating: v.number(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("teamStats")
			.withIndex("by_league_team", (q) =>
				q.eq("league", args.league).eq("teamId", args.teamId),
			)
			.unique();

		const data = {
			...args,
			updatedAt: Date.now(),
		};

		if (existing) {
			await ctx.db.patch(existing._id, data);
		} else {
			await ctx.db.insert("teamStats", data);
		}
	},
});

// Fetch standings data for a league (has wins, losses, PPG, OPP PPG)
async function fetchStandings(league: League): Promise<StandingsTeamEntry[]> {
	// G-League uses NBA Stats API, not ESPN
	if (league === "gleague") {
		return fetchGLeagueStandings();
	}

	const url = `https://site.api.espn.com/apis/v2/sports/basketball/${league}/standings`;

	try {
		const response = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0" },
		});

		if (!response.ok) {
			console.error(`Failed to fetch standings for ${league}: ${response.status}`);
			return [];
		}

		const data = (await response.json()) as StandingsResponse;
		const entries: StandingsTeamEntry[] = [];

		// Extract team entries from all conferences
		for (const child of data.children ?? []) {
			for (const entry of child.standings?.entries ?? []) {
				if (entry.team?.id) {
					entries.push(entry);
				}
			}
		}

		return entries;
	} catch (error) {
		console.error(`Error fetching standings for ${league}:`, error);
		return [];
	}
}

// G-League uses NBA Stats API
interface GLeagueStandingsResponse {
	resultSets: Array<{
		name: string;
		headers: string[];
		rowSet: (string | number | null)[][];
	}>;
}

function getCurrentGLeagueSeason(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth();
	// G-League season runs roughly Nov-March
	const startYear = month < 8 ? year - 1 : year;
	return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

async function fetchGLeagueStandings(): Promise<StandingsTeamEntry[]> {
	const season = getCurrentGLeagueSeason();
	const url = `https://stats.gleague.nba.com/stats/leaguestandingsv3?LeagueID=20&Season=${season}&SeasonType=Regular%20Season`;

	try {
		const response = await fetch(url, {
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "Mozilla/5.0",
				Referer: "https://stats.gleague.nba.com/",
			},
		});

		if (!response.ok) {
			console.error(`Failed to fetch G-League standings: ${response.status}`);
			return [];
		}

		const data = (await response.json()) as GLeagueStandingsResponse;
		const standingsResult = data.resultSets?.find((rs) => rs.name === "Standings");

		if (!standingsResult) {
			console.error("No standings data in G-League API response");
			return [];
		}

		const { headers, rowSet } = standingsResult;
		const entries: StandingsTeamEntry[] = [];

		const getIndex = (name: string) => headers.indexOf(name);

		for (const row of rowSet) {
			const teamId = String(row[getIndex("TeamID")] ?? "");
			const teamCity = String(row[getIndex("TeamCity")] ?? "");
			const teamName = String(row[getIndex("TeamName")] ?? "");
			const teamSlug = String(row[getIndex("TeamSlug")] ?? "").toUpperCase().slice(0, 3);

			// Map G-League stats format to our standard format
			entries.push({
				team: {
					id: teamId,
					displayName: `${teamCity} ${teamName}`.trim(),
					abbreviation: teamSlug,
				},
				stats: [
					{ name: "wins", value: Number(row[getIndex("WINS")] ?? 0) },
					{ name: "losses", value: Number(row[getIndex("LOSSES")] ?? 0) },
					{ name: "avgPointsFor", value: Number(row[getIndex("PointsPG")] ?? 0) },
					{ name: "avgPointsAgainst", value: Number(row[getIndex("OppPointsPG")] ?? 0) },
				],
			});
		}

		return entries;
	} catch (error) {
		console.error("Error fetching G-League standings:", error);
		return [];
	}
}

// Fetch pace-related stats for a single team
async function fetchTeamPaceStats(
	league: League,
	teamId: string,
): Promise<{ fga: number; fta: number; oreb: number; tov: number } | null> {
	const leagueSlug = league === "gleague" ? "nba-g-league" : league;
	const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/${leagueSlug}/teams/${teamId}/statistics`;

	try {
		const response = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0" },
		});

		if (!response.ok) {
			// Don't log 404s for G-League teams - many don't have stats
			if (response.status !== 404) {
				console.error(`Failed to fetch pace stats for team ${teamId}: ${response.status}`);
			}
			return null;
		}

		const data = (await response.json()) as EspnTeamStatsResponse;
		const categories = data.results?.stats?.categories ?? [];
		const allStats: EspnTeamStats[] = categories.flatMap((c) => c.stats);

		return {
			fga: allStats.find((s) => s.name === "avgFieldGoalsAttempted")?.value ?? 0,
			fta: allStats.find((s) => s.name === "avgFreeThrowsAttempted")?.value ?? 0,
			oreb: allStats.find((s) => s.name === "avgOffensiveRebounds")?.value ?? 0,
			tov: allStats.find((s) => s.name === "avgTurnovers")?.value ?? 0,
		};
	} catch (error) {
		console.error(`Error fetching pace stats for team ${teamId}:`, error);
		return null;
	}
}

// Action to update all team stats for a league
export const updateLeagueStats = internalAction({
	args: { league: v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague")) },
	handler: async (ctx, args) => {
		const { league } = args;
		console.log(`Starting stats update for ${league.toUpperCase()}...`);

		// Get standings data (wins, losses, PPG, OPP PPG, etc.)
		const standingsEntries = await fetchStandings(league);
		console.log(`Found ${standingsEntries.length} teams in standings for ${league}`);

		if (standingsEntries.length === 0) {
			console.error(`No teams found in standings for ${league}`);
			return { success: false, error: "No teams found" };
		}

		let successCount = 0;
		let errorCount = 0;

		for (const entry of standingsEntries) {
			const teamId = entry.team.id;
			const teamName = entry.team.displayName;
			const abbreviation = entry.team.abbreviation;

			// Get stats from standings
			const wins = getStat(entry.stats, "wins");
			const losses = getStat(entry.stats, "losses");
			const pointsFor = getStat(entry.stats, "avgPointsFor");
			const pointsAgainst = getStat(entry.stats, "avgPointsAgainst");

			// Fetch pace stats for this team
			const paceStats = await fetchTeamPaceStats(league, teamId);

			// Calculate pace and ratings
			let pace = 0;
			let offensiveRating = 0;
			let defensiveRating = 0;
			let netRating = 0;

			if (paceStats && (paceStats.fga > 0 || paceStats.tov > 0)) {
				// We have real pace data
				pace = calculatePossessions(paceStats.fga, paceStats.fta, paceStats.oreb, paceStats.tov);
			} else if (pointsFor > 0 && pointsAgainst > 0) {
				// Use league average pace estimate when individual stats unavailable
				// NBA/WNBA ~100, G-League ~105 (faster pace)
				pace = league === "gleague" ? 105 : 100;
			}

			if (pace > 0) {
				offensiveRating = (pointsFor / pace) * 100;
				defensiveRating = (pointsAgainst / pace) * 100;
				netRating = offensiveRating - defensiveRating;
			}

			try {
				await ctx.runMutation(internal.teamStats.upsertTeamStats, {
					league,
					teamId,
					teamName,
					abbreviation,
					wins,
					losses,
					pointsFor,
					pointsAgainst,
					pace,
					offensiveRating,
					defensiveRating,
					netRating,
				});
				successCount++;
			} catch (error) {
				console.error(`Failed to upsert stats for ${teamName}:`, error);
				errorCount++;
			}

			// Small delay between requests to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		console.log(
			`Finished ${league.toUpperCase()} update: ${successCount} success, ${errorCount} errors`,
		);

		return { success: true, updated: successCount, errors: errorCount };
	},
});

// Action to update all leagues
export const updateAllLeagues = internalAction({
	args: {},
	handler: async (ctx) => {
		console.log("Starting full stats update for all leagues...");

		const results: Record<string, { success: boolean; updated?: number; errors?: number }> = {};

		for (const league of ["nba", "wnba", "gleague"] as League[]) {
			try {
				const result = await ctx.runAction(internal.teamStats.updateLeagueStats, { league });
				results[league] = result;
			} catch (error) {
				console.error(`Failed to update ${league}:`, error);
				results[league] = { success: false };
			}
		}

		console.log("Full stats update complete:", results);
		return results;
	},
});

// Public action to manually trigger an update (for admin/testing)
export const triggerUpdate = action({
	args: { league: v.optional(v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague"))) },
	handler: async (ctx, args): Promise<{ success: boolean; updated?: number; errors?: number } | Record<string, { success: boolean; updated?: number; errors?: number }>> => {
		if (args.league) {
			return await ctx.runAction(internal.teamStats.updateLeagueStats, {
				league: args.league,
			});
		}
		return await ctx.runAction(internal.teamStats.updateAllLeagues, {});
	},
});

import { v } from "convex/values";
import { query, action, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { League } from "../lib/shared/league";
import { leagueValidator } from "./validators";

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

// Site API env var names by league
const SITE_API_VARS: Record<League, string> = {
	nba: "NBA_SITE_API",
	wnba: "WNBA_SITE_API",
	gleague: "GLEAGUE_SITE_API",
};

function getSiteApi(league: League): string | undefined {
	return process.env[SITE_API_VARS[league]];
}

function getGLeagueStatsApi(): string | undefined {
	return process.env.GLEAGUE_STATS_API;
}

// Get league slug for ESPN API paths
function getLeagueSlug(league: League): string {
	return league === "gleague" ? "nba-g-league" : league;
}

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
	args: { league: leagueValidator },
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
		league: leagueValidator,
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
		league: leagueValidator,
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
		// Derived scoring
		margin: v.optional(v.number()),
		// Shooting stats
		fgPct: v.optional(v.number()),
		threePct: v.optional(v.number()),
		ftPct: v.optional(v.number()),
		efgPct: v.optional(v.number()),
		tsPct: v.optional(v.number()),
		// Rebounding stats
		rpg: v.optional(v.number()),
		orpg: v.optional(v.number()),
		drpg: v.optional(v.number()),
		// Playmaking stats
		apg: v.optional(v.number()),
		tovPg: v.optional(v.number()),
		// Defense stats
		spg: v.optional(v.number()),
		bpg: v.optional(v.number()),
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

// Internal mutation to update ranks for all teams in a league
export const updateLeagueRanks = internalMutation({
	args: { league: leagueValidator },
	handler: async (ctx, args) => {
		const teams = await ctx.db
			.query("teamStats")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.collect();

		// Filter to teams with valid data
		const validTeams = teams.filter((t) => t.offensiveRating > 0);

		if (validTeams.length === 0) return;

		// Helper to get rank (1-indexed)
		const getRank = (sorted: typeof validTeams, team: typeof validTeams[0]) =>
			sorted.findIndex((t) => t._id === team._id) + 1;

		// Helper to get rank for optional stats (only rank teams that have the stat)
		const getRankOptional = (
			sorted: typeof validTeams,
			team: typeof validTeams[0],
			hasValue: (t: typeof team) => boolean
		) => {
			if (!hasValue(team)) return undefined;
			const teamsWithStat = sorted.filter(hasValue);
			const idx = teamsWithStat.findIndex((t) => t._id === team._id);
			return idx >= 0 ? idx + 1 : undefined;
		};

		// Sort arrays for each stat
		// Scoring: PPG higher is better, OPP PPG lower is better
		const byPpg = [...validTeams].sort((a, b) => b.pointsFor - a.pointsFor);
		const byOppPpg = [...validTeams].sort((a, b) => a.pointsAgainst - b.pointsAgainst);
		const byMargin = [...validTeams].sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));
		const byPace = [...validTeams].sort((a, b) => b.pace - a.pace);
		const byOrtg = [...validTeams].sort((a, b) => b.offensiveRating - a.offensiveRating);
		const byDrtg = [...validTeams].sort((a, b) => a.defensiveRating - b.defensiveRating);
		const byNetRtg = [...validTeams].sort((a, b) => b.netRating - a.netRating);

		// Shooting: higher is better
		const byFgPct = [...validTeams].sort((a, b) => (b.fgPct ?? 0) - (a.fgPct ?? 0));
		const byThreePct = [...validTeams].sort((a, b) => (b.threePct ?? 0) - (a.threePct ?? 0));
		const byFtPct = [...validTeams].sort((a, b) => (b.ftPct ?? 0) - (a.ftPct ?? 0));
		const byEfgPct = [...validTeams].sort((a, b) => (b.efgPct ?? 0) - (a.efgPct ?? 0));
		const byTsPct = [...validTeams].sort((a, b) => (b.tsPct ?? 0) - (a.tsPct ?? 0));

		// Rebounding: higher is better
		const byRpg = [...validTeams].sort((a, b) => (b.rpg ?? 0) - (a.rpg ?? 0));
		const byOrpg = [...validTeams].sort((a, b) => (b.orpg ?? 0) - (a.orpg ?? 0));
		const byDrpg = [...validTeams].sort((a, b) => (b.drpg ?? 0) - (a.drpg ?? 0));

		// Playmaking: APG higher is better, TOV lower is better, AST/TO higher is better
		const byApg = [...validTeams].sort((a, b) => (b.apg ?? 0) - (a.apg ?? 0));
		const byTov = [...validTeams].sort((a, b) => (a.tovPg ?? 999) - (b.tovPg ?? 999));
		// Calculate AST/TO ratio on the fly for ranking
		const getAstToRatio = (t: typeof validTeams[0]) => {
			if (!t.apg || !t.tovPg || t.tovPg === 0) return 0;
			return t.apg / t.tovPg;
		};
		const byAstToRatio = [...validTeams].sort((a, b) => getAstToRatio(b) - getAstToRatio(a));

		// Defense: higher is better
		const bySpg = [...validTeams].sort((a, b) => (b.spg ?? 0) - (a.spg ?? 0));
		const byBpg = [...validTeams].sort((a, b) => (b.bpg ?? 0) - (a.bpg ?? 0));

		// Update each team with their ranks
		for (const team of validTeams) {
			const hasStat = (stat: number | undefined) => stat !== undefined && stat > 0;

			await ctx.db.patch(team._id, {
				// Scoring ranks
				rankPpg: getRank(byPpg, team),
				rankOppPpg: getRank(byOppPpg, team),
				rankMargin: getRankOptional(byMargin, team, (t) => t.margin !== undefined),
				rankPace: getRank(byPace, team),
				rankOrtg: getRank(byOrtg, team),
				rankDrtg: getRank(byDrtg, team),
				rankNetRtg: getRank(byNetRtg, team),
				// Shooting ranks
				rankFgPct: getRankOptional(byFgPct, team, (t) => hasStat(t.fgPct)),
				rankThreePct: getRankOptional(byThreePct, team, (t) => hasStat(t.threePct)),
				rankFtPct: getRankOptional(byFtPct, team, (t) => hasStat(t.ftPct)),
				rankEfgPct: getRankOptional(byEfgPct, team, (t) => hasStat(t.efgPct)),
				rankTsPct: getRankOptional(byTsPct, team, (t) => hasStat(t.tsPct)),
				// Rebounding ranks
				rankRpg: getRankOptional(byRpg, team, (t) => hasStat(t.rpg)),
				rankOrpg: getRankOptional(byOrpg, team, (t) => hasStat(t.orpg)),
				rankDrpg: getRankOptional(byDrpg, team, (t) => hasStat(t.drpg)),
				// Playmaking ranks
				rankApg: getRankOptional(byApg, team, (t) => hasStat(t.apg)),
				rankTov: getRankOptional(byTov, team, (t) => hasStat(t.tovPg)),
				rankAstToRatio: getRankOptional(byAstToRatio, team, (t) => hasStat(t.apg) && hasStat(t.tovPg)),
				// Defense ranks
				rankSpg: getRankOptional(bySpg, team, (t) => hasStat(t.spg)),
				rankBpg: getRankOptional(byBpg, team, (t) => hasStat(t.bpg)),
			});
		}
	},
});

// Fetch standings data for a league (has wins, losses, PPG, OPP PPG)
async function fetchStandings(league: League): Promise<StandingsTeamEntry[]> {
	// G-League uses NBA Stats API, not ESPN
	if (league === "gleague") {
		return fetchGLeagueStandings();
	}

	// Standings uses /apis/v2/ path (different from SITE_API which uses /apis/site/v2/)
	// Derive from SITE_API by replacing the path segment
	const siteApi = getSiteApi(league);
	if (!siteApi) {
		console.error(`${SITE_API_VARS[league]} not configured`);
		return [];
	}
	const url = siteApi.replace("/apis/site/v2/", "/apis/v2/") + "/standings";

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
	const baseUrl = getGLeagueStatsApi();
	if (!baseUrl) {
		console.error("GLEAGUE_STATS_API not configured");
		return [];
	}
	const season = getCurrentGLeagueSeason();
	const url = `${baseUrl}/leaguestandingsv3?LeagueID=20&Season=${season}&SeasonType=Regular%20Season`;

	try {
		const response = await fetch(url, {
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "Mozilla/5.0",
				Referer: baseUrl,
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

// Extended team stats from ESPN API
interface ExtendedTeamStats {
	// For pace calculation
	fga: number;
	fta: number;
	oreb: number;
	tov: number;
	// Shooting (percentages)
	fgPct: number;
	threePct: number;
	ftPct: number;
	// Shooting (made/attempted for eFG% and TS% calculation)
	fgMade: number;
	threeMade: number;
	ppg: number; // For TS% calculation
	// Rebounding
	rpg: number;
	orpg: number;
	drpg: number;
	// Playmaking
	apg: number;
	tovPg: number;
	// Defense
	spg: number;
	bpg: number;
}

// Fetch all team stats from ESPN API
async function fetchTeamStats(
	league: League,
	teamId: string,
): Promise<ExtendedTeamStats | null> {
	const baseUrl = getSiteApi(league);
	if (!baseUrl) {
		console.error(`${SITE_API_VARS[league]} not configured`);
		return null;
	}
	const url = `${baseUrl}/teams/${teamId}/statistics`;

	try {
		const response = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0" },
		});

		if (!response.ok) {
			// Don't log 404s for G-League teams - many don't have stats
			if (response.status !== 404) {
				console.error(`Failed to fetch stats for team ${teamId}: ${response.status}`);
			}
			return null;
		}

		const data = (await response.json()) as EspnTeamStatsResponse;
		const categories = data.results?.stats?.categories ?? [];
		const allStats: EspnTeamStats[] = categories.flatMap((c) => c.stats);

		const getStat = (name: string) => allStats.find((s) => s.name === name)?.value ?? 0;

		return {
			// Pace calculation stats
			fga: getStat("avgFieldGoalsAttempted"),
			fta: getStat("avgFreeThrowsAttempted"),
			oreb: getStat("avgOffensiveRebounds"),
			tov: getStat("avgTurnovers"),
			// Shooting (percentages)
			fgPct: getStat("fieldGoalPct"),
			threePct: getStat("threePointFieldGoalPct"),
			ftPct: getStat("freeThrowPct"),
			// Shooting (made/attempted for eFG% and TS%)
			fgMade: getStat("avgFieldGoalsMade"),
			threeMade: getStat("avgThreePointFieldGoalsMade"),
			ppg: getStat("avgPoints"),
			// Rebounding
			rpg: getStat("avgRebounds"),
			orpg: getStat("avgOffensiveRebounds"),
			drpg: getStat("avgDefensiveRebounds"),
			// Playmaking
			apg: getStat("avgAssists"),
			tovPg: getStat("avgTurnovers"),
			// Defense
			spg: getStat("avgSteals"),
			bpg: getStat("avgBlocks"),
		};
	} catch (error) {
		console.error(`Error fetching stats for team ${teamId}:`, error);
		return null;
	}
}

// Action to update all team stats for a league
export const updateLeagueStats = internalAction({
	args: { league: leagueValidator },
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

			// Fetch full team stats from ESPN
			const teamStats = await fetchTeamStats(league, teamId);

			// Calculate pace and ratings
			let pace = 0;
			let offensiveRating = 0;
			let defensiveRating = 0;
			let netRating = 0;

			if (teamStats && (teamStats.fga > 0 || teamStats.tov > 0)) {
				// We have real pace data
				pace = calculatePossessions(teamStats.fga, teamStats.fta, teamStats.oreb, teamStats.tov);
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

			// Calculate derived stats
			const margin = pointsFor - pointsAgainst;

			// eFG% = (FGM + 0.5 * 3PM) / FGA
			let efgPct: number | undefined;
			if (teamStats && teamStats.fga > 0) {
				efgPct = ((teamStats.fgMade + 0.5 * teamStats.threeMade) / teamStats.fga) * 100;
			}

			// TS% = PTS / (2 * (FGA + 0.44 * FTA))
			let tsPct: number | undefined;
			if (teamStats && (teamStats.fga > 0 || teamStats.fta > 0)) {
				const trueShotAttempts = 2 * (teamStats.fga + 0.44 * teamStats.fta);
				if (trueShotAttempts > 0) {
					tsPct = (teamStats.ppg / trueShotAttempts) * 100;
				}
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
					// Derived scoring
					margin,
					// Shooting stats
					fgPct: teamStats?.fgPct,
					threePct: teamStats?.threePct,
					ftPct: teamStats?.ftPct,
					efgPct,
					tsPct,
					// Rebounding stats
					rpg: teamStats?.rpg,
					orpg: teamStats?.orpg,
					drpg: teamStats?.drpg,
					// Playmaking stats
					apg: teamStats?.apg,
					tovPg: teamStats?.tovPg,
					// Defense stats
					spg: teamStats?.spg,
					bpg: teamStats?.bpg,
				});
				successCount++;
			} catch (error) {
				console.error(`Failed to upsert stats for ${teamName}:`, error);
				errorCount++;
			}

			// Small delay between requests to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		// Calculate and update ranks for all teams in the league
		console.log(`Calculating ranks for ${league.toUpperCase()}...`);
		await ctx.runMutation(internal.teamStats.updateLeagueRanks, { league });

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
	args: { league: v.optional(leagueValidator) },
	handler: async (ctx, args): Promise<{ success: boolean; updated?: number; errors?: number } | Record<string, { success: boolean; updated?: number; errors?: number }>> => {
		if (args.league) {
			return await ctx.runAction(internal.teamStats.updateLeagueStats, {
				league: args.league,
			});
		}
		return await ctx.runAction(internal.teamStats.updateAllLeagues, {});
	},
});

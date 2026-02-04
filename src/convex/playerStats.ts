import { v } from "convex/values";
import { query, action, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

type League = "nba" | "wnba" | "gleague";

// ESPN API response types
interface PlayerOverviewResponse {
	statistics?: {
		labels: string[];
		names: string[];
		splits: Array<{
			displayName: string;
			stats: string[];
		}>;
	};
}

interface RosterResponse {
	positionGroups?: Array<{
		type: string;
		athletes: Array<{
			id: string;
			displayName: string;
		}>;
	}>;
}

// League to ESPN slug mapping
function getLeagueSlug(league: League): string {
	switch (league) {
		case "nba":
			return "nba";
		case "wnba":
			return "wnba";
		case "gleague":
			return "nba-g-league";
	}
}

// Common API env var names by league (site.web.api.espn.com)
const COMMON_API_VARS: Record<League, string> = {
	nba: "NBA_COMMON_API",
	wnba: "WNBA_COMMON_API",
	gleague: "GLEAGUE_COMMON_API",
};

function getCommonApi(league: League): string | undefined {
	return process.env[COMMON_API_VARS[league]];
}

// Query to get player stats for a team
export const getByTeam = query({
	args: {
		league: v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague")),
		teamId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("playerStats")
			.withIndex("by_league_team", (q) =>
				q.eq("league", args.league).eq("teamId", args.teamId)
			)
			.collect();
	},
});

// Query to get all player stats for a league (for bulk loading)
export const getByLeague = query({
	args: {
		league: v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague")),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("playerStats")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.collect();
	},
});

// Query to get a single player's stats
export const getByPlayer = query({
	args: {
		league: v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague")),
		playerId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("playerStats")
			.withIndex("by_league_player", (q) =>
				q.eq("league", args.league).eq("playerId", args.playerId)
			)
			.unique();
	},
});

// Internal mutation to upsert a player's stats
export const upsertPlayerStats = internalMutation({
	args: {
		league: v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague")),
		playerId: v.string(),
		teamId: v.string(),
		name: v.string(),
		gamesPlayed: v.number(),
		gamesStarted: v.number(),
		minutesPerGame: v.number(),
		pointsPerGame: v.number(),
		reboundsPerGame: v.number(),
		assistsPerGame: v.number(),
		stealsPerGame: v.number(),
		blocksPerGame: v.number(),
		turnoversPerGame: v.number(),
		fieldGoalPct: v.number(),
		threePointPct: v.number(),
		freeThrowPct: v.number(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("playerStats")
			.withIndex("by_league_player", (q) =>
				q.eq("league", args.league).eq("playerId", args.playerId)
			)
			.unique();

		const data = {
			...args,
			updatedAt: Date.now(),
		};

		if (existing) {
			await ctx.db.patch(existing._id, data);
		} else {
			await ctx.db.insert("playerStats", data);
		}
	},
});

// Fetch individual player stats from ESPN
async function fetchPlayerStats(
	league: League,
	playerId: string
): Promise<{
	gamesPlayed: number;
	gamesStarted: number;
	minutesPerGame: number;
	pointsPerGame: number;
	reboundsPerGame: number;
	assistsPerGame: number;
	stealsPerGame: number;
	blocksPerGame: number;
	turnoversPerGame: number;
	fieldGoalPct: number;
	threePointPct: number;
	freeThrowPct: number;
} | null> {
	const baseUrl = getCommonApi(league);
	if (!baseUrl) {
		console.error(`${COMMON_API_VARS[league]} not configured`);
		return null;
	}
	const url = `${baseUrl}/athletes/${playerId}/overview`;

	try {
		const response = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0" },
		});

		if (!response.ok) {
			if (response.status !== 404) {
				console.error(`Failed to fetch player ${playerId}: ${response.status}`);
			}
			return null;
		}

		const data = (await response.json()) as PlayerOverviewResponse;
		const stats = data.statistics;

		if (!stats?.splits?.[0]?.stats) {
			return null;
		}

		// Find the "Regular Season" split (first one)
		const seasonStats = stats.splits[0].stats;
		const names = stats.names;

		const getStatValue = (statName: string): number => {
			const idx = names.indexOf(statName);
			if (idx === -1) return 0;
			const val = parseFloat(seasonStats[idx]);
			return isNaN(val) ? 0 : val;
		};

		return {
			gamesPlayed: getStatValue("gamesPlayed"),
			gamesStarted: getStatValue("gamesStarted") || getStatValue("gamesPlayed"), // Fallback
			minutesPerGame: getStatValue("avgMinutes"),
			pointsPerGame: getStatValue("avgPoints"),
			reboundsPerGame: getStatValue("avgRebounds"),
			assistsPerGame: getStatValue("avgAssists"),
			stealsPerGame: getStatValue("avgSteals"),
			blocksPerGame: getStatValue("avgBlocks"),
			turnoversPerGame: getStatValue("avgTurnovers"),
			fieldGoalPct: getStatValue("fieldGoalPct"),
			threePointPct: getStatValue("threePointPct"),
			freeThrowPct: getStatValue("freeThrowPct"),
		};
	} catch (error) {
		console.error(`Error fetching player ${playerId}:`, error);
		return null;
	}
}

// Fetch roster for a team to get player IDs
async function fetchTeamRoster(
	league: League,
	teamId: string
): Promise<Array<{ id: string; name: string }>> {
	const baseUrl = getCommonApi(league);
	if (!baseUrl) {
		console.error(`${COMMON_API_VARS[league]} not configured`);
		return [];
	}
	const url = `${baseUrl}/teams/${teamId}/roster`;

	try {
		const response = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0" },
		});

		if (!response.ok) {
			if (response.status !== 404) {
				console.error(`Failed to fetch roster for team ${teamId}: ${response.status}`);
			}
			return [];
		}

		const data = (await response.json()) as RosterResponse;

		// Get athletes from "all" position group or first available
		const allGroup = data.positionGroups?.find((g) => g.type === "all");
		const athletes = allGroup?.athletes ?? data.positionGroups?.[0]?.athletes ?? [];

		return athletes.map((a) => ({ id: a.id, name: a.displayName }));
	} catch (error) {
		console.error(`Error fetching roster for team ${teamId}:`, error);
		return [];
	}
}

// Internal action to update player stats for a single team
export const updateTeamPlayerStats = internalAction({
	args: {
		league: v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague")),
		teamId: v.string(),
		delayMs: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { league, teamId, delayMs = 500 } = args;

		// Fetch roster to get player IDs
		const roster = await fetchTeamRoster(league, teamId);

		if (roster.length === 0) {
			console.log(`No roster found for team ${teamId} in ${league}`);
			return { success: true, updated: 0, skipped: 0 };
		}

		let updated = 0;
		let skipped = 0;

		for (const player of roster) {
			// Fetch individual player stats
			const stats = await fetchPlayerStats(league, player.id);

			if (stats && stats.gamesPlayed > 0) {
				try {
					await ctx.runMutation(internal.playerStats.upsertPlayerStats, {
						league,
						playerId: player.id,
						teamId,
						name: player.name,
						...stats,
					});
					updated++;
				} catch (error) {
					console.error(`Failed to save stats for ${player.name}:`, error);
					skipped++;
				}
			} else {
				skipped++;
			}

			// Delay between player requests to avoid rate limiting
			if (delayMs > 0) {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		return { success: true, updated, skipped };
	},
});

// Internal action to update all player stats for a league
export const updateLeaguePlayerStats = internalAction({
	args: {
		league: v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague")),
	},
	handler: async (ctx, args) => {
		const { league } = args;
		console.log(`Starting player stats update for ${league.toUpperCase()}...`);

		// Get all teams from our teamStats table
		const teams = await ctx.runQuery(internal.playerStats.getTeamIds, { league });

		if (teams.length === 0) {
			console.log(`No teams found for ${league}, skipping player stats update`);
			return { success: false, error: "No teams found" };
		}

		console.log(`Processing ${teams.length} teams for ${league}...`);

		let totalUpdated = 0;
		let totalSkipped = 0;
		let teamsProcessed = 0;

		for (const team of teams) {
			const result = await ctx.runAction(internal.playerStats.updateTeamPlayerStats, {
				league,
				teamId: team.teamId,
				delayMs: 500, // 500ms between players
			});

			totalUpdated += result.updated;
			totalSkipped += result.skipped;
			teamsProcessed++;

			console.log(
				`[${league}] Team ${teamsProcessed}/${teams.length}: ${result.updated} updated, ${result.skipped} skipped`
			);

			// 2 second delay between teams
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		console.log(
			`Finished ${league.toUpperCase()} player stats: ${totalUpdated} updated, ${totalSkipped} skipped`
		);

		return { success: true, updated: totalUpdated, skipped: totalSkipped };
	},
});

// Internal query to get team IDs from teamStats table
export const getTeamIds = internalQuery({
	args: {
		league: v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague")),
	},
	handler: async (ctx, args) => {
		const teams = await ctx.db
			.query("teamStats")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.collect();
		return teams.map((t) => ({ teamId: t.teamId, teamName: t.teamName }));
	},
});

// Action to update all leagues' player stats (staggered)
export const updateAllLeaguesPlayerStats = internalAction({
	args: {},
	handler: async (ctx) => {
		console.log("Starting player stats update for all leagues...");

		const results: Record<string, { success: boolean; updated?: number; skipped?: number }> = {};

		// Process leagues sequentially with delays between them
		for (const league of ["nba", "wnba", "gleague"] as League[]) {
			try {
				console.log(`\n=== Processing ${league.toUpperCase()} ===`);
				const result = await ctx.runAction(internal.playerStats.updateLeaguePlayerStats, {
					league,
				});
				results[league] = result;

				// 5 minute delay between leagues
				if (league !== "gleague") {
					console.log(`Waiting 5 minutes before next league...`);
					await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
				}
			} catch (error) {
				console.error(`Failed to update ${league}:`, error);
				results[league] = { success: false };
			}
		}

		console.log("\nPlayer stats update complete:", results);
		return results;
	},
});

// Result types for trigger actions
type TeamResult = { success: boolean; updated: number; skipped: number };
type LeagueResult = { success: boolean; updated?: number; skipped?: number; error?: string };
type AllLeaguesResult = Record<string, LeagueResult>;

// Public action to manually trigger an update (for admin/testing)
export const triggerUpdate = action({
	args: {
		league: v.optional(v.union(v.literal("nba"), v.literal("wnba"), v.literal("gleague"))),
		teamId: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<TeamResult | LeagueResult | AllLeaguesResult> => {
		// Update single team
		if (args.league && args.teamId) {
			return await ctx.runAction(internal.playerStats.updateTeamPlayerStats, {
				league: args.league,
				teamId: args.teamId,
				delayMs: 500,
			});
		}

		// Update single league
		if (args.league) {
			return await ctx.runAction(internal.playerStats.updateLeaguePlayerStats, {
				league: args.league,
			});
		}

		// Update all leagues
		return await ctx.runAction(internal.playerStats.updateAllLeaguesPlayerStats, {});
	},
});

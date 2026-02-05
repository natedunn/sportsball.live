import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { League } from "../lib/shared/league";
import { leagueValidator } from "./validators";

// ESPN API response types for scoreboard
interface ApiCompetitor {
	homeAway: "home" | "away";
	team: {
		id: string;
	};
	score: string;
}

interface ApiEvent {
	id: string;
	status?: {
		type: {
			state: "pre" | "in" | "post";
		};
	};
	competitions: Array<{
		startDate?: string;
		competitors: ApiCompetitor[];
	}>;
}

interface ApiResponse {
	events?: ApiEvent[];
}

// League to ESPN Site API base URL mapping
function getSiteApi(league: League): string | undefined {
	switch (league) {
		case "nba":
			return process.env.NBA_SITE_API;
		case "wnba":
			return process.env.WNBA_SITE_API;
		case "gleague":
			return process.env.GLEAGUE_SITE_API;
	}
}

// Get today's date in YYYYMMDD format
function getTodayDate(): string {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = String(now.getUTCMonth() + 1).padStart(2, "0");
	const day = String(now.getUTCDate()).padStart(2, "0");
	return `${year}${month}${day}`;
}

// Fetch games for a specific league and date
async function fetchLeagueGames(league: League, date: string): Promise<ApiEvent[]> {
	const baseUrl = getSiteApi(league);
	if (!baseUrl) {
		console.log(`API base URL not configured for ${league}`);
		return [];
	}

	try {
		const response = await fetch(`${baseUrl}/scoreboard?dates=${date}`, {
			headers: { "Content-Type": "application/json" },
		});

		if (!response.ok) {
			console.error(`Failed to fetch ${league} games: ${response.status}`);
			return [];
		}

		const data = (await response.json()) as ApiResponse;
		return data.events ?? [];
	} catch (error) {
		console.error(`Error fetching ${league} games:`, error);
		return [];
	}
}

// Internal query to check if a game already exists in the queue
export const getGameByLeagueAndId = internalQuery({
	args: {
		league: leagueValidator,
		gameId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("gameQueue")
			.withIndex("by_league_game", (q) =>
				q.eq("league", args.league).eq("gameId", args.gameId)
			)
			.unique();
	},
});

// Internal mutation to insert a game into the queue
export const insertGame = internalMutation({
	args: {
		league: leagueValidator,
		gameId: v.string(),
		homeTeamId: v.string(),
		awayTeamId: v.string(),
		scheduledStart: v.number(),
		firstCheckTime: v.number(),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("gameQueue", {
			...args,
			status: "pending",
			checkCount: 0,
		});
	},
});

// Internal mutation to update a game's status
export const updateGameStatus = internalMutation({
	args: {
		gameId: v.id("gameQueue"),
		status: v.union(
			v.literal("pending"),
			v.literal("checking"),
			v.literal("processed"),
			v.literal("abandoned")
		),
		checkCount: v.optional(v.number()),
		processedAt: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { gameId, ...updates } = args;
		const filtered = Object.fromEntries(
			Object.entries(updates).filter(([, v]) => v !== undefined)
		);
		await ctx.db.patch(gameId, filtered);
	},
});

// Internal query to get games ready for processing
export const getGamesReadyForProcessing = internalQuery({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		// Get games that are actively being checked
		const checkingGames = await ctx.db
			.query("gameQueue")
			.withIndex("by_status", (q) => q.eq("status", "checking"))
			.collect();

		// Get pending games whose first check time has passed
		const pendingGames = await ctx.db
			.query("gameQueue")
			.withIndex("by_status", (q) => q.eq("status", "pending"))
			.collect();

		const readyPendingGames = pendingGames.filter(
			(game) => game.firstCheckTime <= now
		);

		return [...checkingGames, ...readyPendingGames];
	},
});

// Populate today's games for all leagues
export const populateTodaysGames = internalAction({
	args: {},
	handler: async (ctx) => {
		const date = getTodayDate();
		const leagues: League[] = ["nba", "wnba", "gleague"];
		const results: Record<string, { added: number; skipped: number }> = {};

		console.log(`Populating games for ${date}...`);

		for (const league of leagues) {
			const games = await fetchLeagueGames(league, date);
			let added = 0;
			let skipped = 0;

			for (const game of games) {
				// Check if game already exists
				const existing = await ctx.runQuery(internal.gameQueue.getGameByLeagueAndId, {
					league,
					gameId: game.id,
				});

				if (existing) {
					skipped++;
					continue;
				}

				const homeTeam = game.competitions[0]?.competitors.find(
					(c) => c.homeAway === "home"
				);
				const awayTeam = game.competitions[0]?.competitors.find(
					(c) => c.homeAway === "away"
				);

				if (!homeTeam || !awayTeam || !game.competitions[0]?.startDate) {
					console.log(`Skipping game ${game.id}: missing team or start date data`);
					skipped++;
					continue;
				}

				const scheduledStart = new Date(game.competitions[0].startDate).getTime();
				// First check time = scheduled start + 2 hours 15 minutes
				const firstCheckTime = scheduledStart + 2 * 60 * 60 * 1000 + 15 * 60 * 1000;

				await ctx.runMutation(internal.gameQueue.insertGame, {
					league,
					gameId: game.id,
					homeTeamId: homeTeam.team.id,
					awayTeamId: awayTeam.team.id,
					scheduledStart,
					firstCheckTime,
				});
				added++;
			}

			results[league] = { added, skipped };
			console.log(`[${league}] Added ${added} games, skipped ${skipped}`);
		}

		console.log("Game queue population complete:", results);
		return results;
	},
});

// Fetch current game state from ESPN
async function fetchGameState(
	league: League,
	gameId: string
): Promise<"pre" | "in" | "post" | null> {
	const baseUrl = getSiteApi(league);
	if (!baseUrl) return null;

	try {
		const response = await fetch(`${baseUrl}/summary?event=${gameId}`, {
			headers: { "Content-Type": "application/json" },
		});

		if (!response.ok) {
			console.error(`Failed to fetch game ${gameId}: ${response.status}`);
			return null;
		}

		const data = (await response.json()) as {
			header?: {
				competitions?: Array<{
					status?: {
						type?: {
							state?: "pre" | "in" | "post";
						};
					};
				}>;
			};
		};

		return data.header?.competitions?.[0]?.status?.type?.state ?? null;
	} catch (error) {
		console.error(`Error fetching game ${gameId}:`, error);
		return null;
	}
}

// Process games that are ready to be checked
export const processReadyGames = internalAction({
	args: {},
	handler: async (ctx) => {
		const games = await ctx.runQuery(internal.gameQueue.getGamesReadyForProcessing, {});

		if (games.length === 0) {
			console.log("No games ready for processing");
			return { processed: 0, checking: 0, abandoned: 0 };
		}

		console.log(`Processing ${games.length} games...`);

		let processed = 0;
		let stillChecking = 0;
		let abandoned = 0;

		for (const game of games) {
			const state = await fetchGameState(game.league, game.gameId);

			if (state === "post") {
				// Game is finished - update player stats for both teams
				console.log(`Game ${game.gameId} (${game.league}) finished, updating player stats...`);

				try {
					// Update stats for both teams
					await ctx.runAction(internal.playerStats.updateTeamPlayerStats, {
						league: game.league,
						teamId: game.homeTeamId,
						delayMs: 500,
					});

					await ctx.runAction(internal.playerStats.updateTeamPlayerStats, {
						league: game.league,
						teamId: game.awayTeamId,
						delayMs: 500,
					});

					// Mark as processed
					await ctx.runMutation(internal.gameQueue.updateGameStatus, {
						gameId: game._id,
						status: "processed",
						processedAt: Date.now(),
					});

					processed++;
					console.log(`Game ${game.gameId} processed successfully`);
				} catch (error) {
					console.error(`Failed to process game ${game.gameId}:`, error);
					// Keep it in checking state for retry
					await ctx.runMutation(internal.gameQueue.updateGameStatus, {
						gameId: game._id,
						status: "checking",
						checkCount: game.checkCount + 1,
					});
					stillChecking++;
				}
			} else if (state === "in" || state === "pre") {
				// Game is still in progress or hasn't started
				const newCheckCount = game.checkCount + 1;

				// After 12 checks (3 hours of 15-min intervals), give up
				if (newCheckCount >= 12) {
					console.log(`Game ${game.gameId} abandoned after ${newCheckCount} checks`);
					await ctx.runMutation(internal.gameQueue.updateGameStatus, {
						gameId: game._id,
						status: "abandoned",
					});
					abandoned++;
				} else {
					await ctx.runMutation(internal.gameQueue.updateGameStatus, {
						gameId: game._id,
						status: "checking",
						checkCount: newCheckCount,
					});
					stillChecking++;
				}
			} else {
				// Unable to get game state - increment check count and retry
				const newCheckCount = game.checkCount + 1;

				if (newCheckCount >= 12) {
					console.log(`Game ${game.gameId} abandoned (unable to fetch state)`);
					await ctx.runMutation(internal.gameQueue.updateGameStatus, {
						gameId: game._id,
						status: "abandoned",
					});
					abandoned++;
				} else {
					await ctx.runMutation(internal.gameQueue.updateGameStatus, {
						gameId: game._id,
						status: "checking",
						checkCount: newCheckCount,
					});
					stillChecking++;
				}
			}

			// Small delay between games to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		console.log(
			`Processing complete: ${processed} processed, ${stillChecking} still checking, ${abandoned} abandoned`
		);

		return { processed, checking: stillChecking, abandoned };
	},
});

// Clean up old games from the queue (older than 7 days)
export const cleanupOldGames = internalMutation({
	args: {},
	handler: async (ctx) => {
		const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
		let deleted = 0;

		// Get all processed and abandoned games
		const processedGames = await ctx.db
			.query("gameQueue")
			.withIndex("by_status", (q) => q.eq("status", "processed"))
			.collect();

		const abandonedGames = await ctx.db
			.query("gameQueue")
			.withIndex("by_status", (q) => q.eq("status", "abandoned"))
			.collect();

		for (const game of [...processedGames, ...abandonedGames]) {
			if (game.scheduledStart < sevenDaysAgo) {
				await ctx.db.delete(game._id);
				deleted++;
			}
		}

		console.log(`Cleaned up ${deleted} old games from queue`);
		return { deleted };
	},
});

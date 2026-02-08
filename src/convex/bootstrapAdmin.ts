import { v } from "convex/values";
import { query, mutation, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { leagueValidator } from "./validators";
import { authComponent } from "./auth";
import { getCurrentSeason } from "./shared/seasonHelpers";

type League = "nba" | "wnba" | "gleague";
type Step = "teams" | "players" | "backfill" | "recalculate";

const STEP_ORDER: Step[] = ["teams", "players", "backfill", "recalculate"];

// Static dispatch map — avoids dynamic `internal[league]` access
const DISPATCH = {
	nba: {
		teams: internal.nba.actions.bootstrapTeams,
		players: internal.nba.actions.bootstrapPlayers,
		backfill: internal.nba.actions.backfillGames,
		recalculate: internal.nba.actions.recalculateAll,
	},
	wnba: {
		teams: internal.wnba.actions.bootstrapTeams,
		players: internal.wnba.actions.bootstrapPlayers,
		backfill: internal.wnba.actions.backfillGames,
		recalculate: internal.wnba.actions.recalculateAll,
	},
	gleague: {
		teams: internal.gleague.actions.bootstrapTeams,
		players: internal.gleague.actions.bootstrapPlayers,
		backfill: internal.gleague.actions.backfillGames,
		recalculate: internal.gleague.actions.recalculateAll,
	},
} as const;

// Table name mapping for data counts
const TABLE_NAMES = {
	nba: { team: "nbaTeam", player: "nbaPlayer", game: "nbaGameEvent" },
	wnba: { team: "wnbaTeam", player: "wnbaPlayer", game: "wnbaGameEvent" },
	gleague: { team: "gleagueTeam", player: "gleaguePlayer", game: "gleagueGameEvent" },
} as const;

// ============================================================================
// QUERIES (public, for UI subscriptions)
// ============================================================================

export const getBootstrapStatus = query({
	args: { league: leagueValidator },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("bootstrapStatus")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.first();
	},
});

export const getAllBootstrapStatuses = query({
	args: {},
	handler: async (ctx) => {
		const statuses = await ctx.db.query("bootstrapStatus").collect();
		const result: Record<string, typeof statuses[number] | null> = {
			nba: null,
			wnba: null,
			gleague: null,
		};
		for (const s of statuses) {
			result[s.league] = s;
		}
		return result;
	},
});

export const getDataCounts = query({
	args: { league: leagueValidator },
	handler: async (ctx, args) => {
		const season = getCurrentSeason();
		const tables = TABLE_NAMES[args.league];

		const teams = await ctx.db
			.query(tables.team)
			.withIndex("by_season", (q) => q.eq("season", season))
			.collect();

		const players = await ctx.db
			.query(tables.player)
			.withIndex("by_season", (q) => q.eq("season", season))
			.collect();

		const games = await ctx.db
			.query(tables.game)
			.withIndex("by_season", (q) => q.eq("season", season))
			.collect();

		return {
			teams: teams.length,
			players: players.length,
			games: games.length,
			season,
		};
	},
});

// ============================================================================
// MUTATIONS (public, called from admin UI)
// ============================================================================

export const startBootstrap = mutation({
	args: { league: leagueValidator },
	handler: async (ctx, args) => {
		// Auth check
		const user = await authComponent.safeGetAuthUser(ctx);
		if (!user?.email) throw new Error("Not authenticated");
		const superAdminEmail = process.env.SUPER_ADMIN;
		if (!superAdminEmail || user.email.toLowerCase() !== superAdminEmail.toLowerCase()) {
			throw new Error("Not authorized");
		}

		// Check no bootstrap already running for this league
		const existing = await ctx.db
			.query("bootstrapStatus")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.first();

		if (existing && (existing.status === "running" || existing.status === "cancelling")) {
			throw new Error(`Bootstrap already ${existing.status} for ${args.league}`);
		}

		const now = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				status: "running",
				currentStep: "teams",
				progress: "Starting...",
				startedAt: now,
				completedAt: undefined,
				error: undefined,
				updatedAt: now,
			});
		} else {
			await ctx.db.insert("bootstrapStatus", {
				league: args.league,
				status: "running",
				currentStep: "teams",
				progress: "Starting...",
				startedAt: now,
				updatedAt: now,
			});
		}

		// Schedule the bootstrap pipeline
		await ctx.scheduler.runAfter(0, internal.bootstrapAdmin.runBootstrapStep, {
			league: args.league,
			step: "teams",
		});
	},
});

export const cancelBootstrap = mutation({
	args: { league: leagueValidator },
	handler: async (ctx, args) => {
		// Auth check
		const user = await authComponent.safeGetAuthUser(ctx);
		if (!user?.email) throw new Error("Not authenticated");
		const superAdminEmail = process.env.SUPER_ADMIN;
		if (!superAdminEmail || user.email.toLowerCase() !== superAdminEmail.toLowerCase()) {
			throw new Error("Not authorized");
		}

		const existing = await ctx.db
			.query("bootstrapStatus")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.first();

		if (!existing || existing.status !== "running") {
			throw new Error(`No running bootstrap to cancel for ${args.league}`);
		}

		await ctx.db.patch(existing._id, {
			status: "cancelling",
			progress: "Cancelling...",
			updatedAt: Date.now(),
		});
	},
});

// ============================================================================
// INTERNAL MUTATIONS (for actions to update status)
// ============================================================================

export const updateProgress = internalMutation({
	args: {
		league: leagueValidator,
		progress: v.string(),
	},
	handler: async (ctx, args) => {
		const status = await ctx.db
			.query("bootstrapStatus")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.first();

		if (status) {
			await ctx.db.patch(status._id, {
				progress: args.progress,
				updatedAt: Date.now(),
			});
		}
	},
});

export const checkCancelled = internalMutation({
	args: { league: leagueValidator },
	handler: async (ctx, args) => {
		const status = await ctx.db
			.query("bootstrapStatus")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.first();

		if (!status) return false;

		if (status.status === "cancelling") {
			await ctx.db.patch(status._id, {
				status: "idle",
				currentStep: undefined,
				progress: undefined,
				updatedAt: Date.now(),
			});
			return true;
		}

		return false;
	},
});

export const markStepStarted = internalMutation({
	args: {
		league: leagueValidator,
		step: v.union(
			v.literal("teams"),
			v.literal("players"),
			v.literal("backfill"),
			v.literal("recalculate"),
		),
	},
	handler: async (ctx, args) => {
		const status = await ctx.db
			.query("bootstrapStatus")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.first();

		if (status) {
			await ctx.db.patch(status._id, {
				currentStep: args.step,
				progress: `Starting ${args.step}...`,
				updatedAt: Date.now(),
			});
		}
	},
});

export const markCompleted = internalMutation({
	args: { league: leagueValidator },
	handler: async (ctx, args) => {
		const status = await ctx.db
			.query("bootstrapStatus")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.first();

		if (status) {
			await ctx.db.patch(status._id, {
				status: "completed",
				currentStep: undefined,
				progress: undefined,
				completedAt: Date.now(),
				updatedAt: Date.now(),
			});
		}
	},
});

export const markFailed = internalMutation({
	args: {
		league: leagueValidator,
		error: v.string(),
	},
	handler: async (ctx, args) => {
		const status = await ctx.db
			.query("bootstrapStatus")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.first();

		if (status) {
			await ctx.db.patch(status._id, {
				status: "failed",
				error: args.error,
				updatedAt: Date.now(),
			});
		}
	},
});

// ============================================================================
// INTERNAL ACTIONS (pipeline orchestration)
// ============================================================================

export const runBootstrapStep = internalAction({
	args: {
		league: leagueValidator,
		step: v.union(
			v.literal("teams"),
			v.literal("players"),
			v.literal("backfill"),
			v.literal("recalculate"),
		),
	},
	handler: async (ctx, args) => {
		const league = args.league as League;
		const step = args.step as Step;

		// Check for cancellation before starting
		const cancelled = await ctx.runMutation(internal.bootstrapAdmin.checkCancelled, {
			league,
		});
		if (cancelled) {
			console.log(`[Bootstrap ${league}] Cancelled before step: ${step}`);
			return;
		}

		// Update status to show current step
		await ctx.runMutation(internal.bootstrapAdmin.markStepStarted, {
			league,
			step,
		});

		const actionRef = DISPATCH[league][step];

		try {
			// Run the step's action with bootstrapRunId to enable progress tracking.
			// Each action is responsible for calling onStepComplete when it finishes
			// (either directly for non-chunked steps, or via the terminal chunk).
			await ctx.runAction(actionRef, { bootstrapRunId: league } as any);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error(`[Bootstrap ${league}] Step ${step} failed:`, errorMsg);
			await ctx.runMutation(internal.bootstrapAdmin.markFailed, {
				league,
				error: `Step "${step}" failed: ${errorMsg}`,
			});
		}
	},
});

export const onStepComplete = internalAction({
	args: {
		league: leagueValidator,
		completedStep: v.union(
			v.literal("teams"),
			v.literal("players"),
			v.literal("backfill"),
			v.literal("recalculate"),
		),
	},
	handler: async (ctx, args) => {
		const league = args.league as League;
		const completedStep = args.completedStep as Step;

		const currentIndex = STEP_ORDER.indexOf(completedStep);
		const nextStep = STEP_ORDER[currentIndex + 1];

		if (!nextStep) {
			// All steps done
			console.log(`[Bootstrap ${league}] All steps completed!`);
			await ctx.runMutation(internal.bootstrapAdmin.markCompleted, { league });
			return;
		}

		// Check cancellation before advancing
		const cancelled = await ctx.runMutation(internal.bootstrapAdmin.checkCancelled, {
			league,
		});
		if (cancelled) {
			console.log(`[Bootstrap ${league}] Cancelled after step: ${completedStep}`);
			return;
		}

		console.log(`[Bootstrap ${league}] Step "${completedStep}" done, advancing to "${nextStep}"`);

		// Schedule next step
		await ctx.scheduler.runAfter(0, internal.bootstrapAdmin.runBootstrapStep, {
			league,
			step: nextStep,
		});
	},
});

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

const leagueValidator = v.union(
	v.literal("nba"),
	v.literal("wnba"),
	v.literal("gleague"),
);

// Get all favorites for authenticated user
export const getUserFavorites = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.safeGetAuthUser(ctx);
		if (!user) {
			return [];
		}

		// Store user ID as string for compatibility with Better Auth component
		const userId = String(user._id);

		return ctx.db
			.query("favoriteTeams")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
	},
});

// Get favorites filtered by league
export const getUserFavoritesByLeague = query({
	args: {
		league: leagueValidator,
	},
	handler: async (ctx, args) => {
		const user = await authComponent.safeGetAuthUser(ctx);
		if (!user) {
			return [];
		}

		const userId = String(user._id);

		return ctx.db
			.query("favoriteTeams")
			.withIndex("by_user_league", (q) =>
				q.eq("userId", userId).eq("league", args.league),
			)
			.collect();
	},
});

// Get favorites for a specific user (public profile)
export const getFavoritesByUserId = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		return ctx.db
			.query("favoriteTeams")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
	},
});

// Toggle favorite - add if not exists, remove if exists
export const toggleFavorite = mutation({
	args: {
		league: leagueValidator,
		teamId: v.string(),
		teamSlug: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.safeGetAuthUser(ctx);
		if (!user) {
			throw new Error("Unauthorized");
		}

		const userId = String(user._id);

		// Check if already favorited
		const existing = await ctx.db
			.query("favoriteTeams")
			.withIndex("by_user_team", (q) =>
				q
					.eq("userId", userId)
					.eq("league", args.league)
					.eq("teamId", args.teamId),
			)
			.first();

		if (existing) {
			// Remove favorite
			await ctx.db.delete(existing._id);
			return { action: "removed" as const };
		}

		// Add favorite
		await ctx.db.insert("favoriteTeams", {
			userId: userId,
			league: args.league,
			teamId: args.teamId,
			teamSlug: args.teamSlug,
			addedAt: Date.now(),
		});

		return { action: "added" as const };
	},
});

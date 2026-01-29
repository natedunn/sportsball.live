import { v } from "convex/values";
import {
	query,
	mutation,
	type QueryCtx,
	type MutationCtx,
} from "./_generated/server";
import { authComponent } from "./auth";

const leagueValidator = v.union(
	v.literal("nba"),
	v.literal("wnba"),
	v.literal("gleague"),
);

// Helper to check if current user is a super admin
async function isSuperAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
	const user = await authComponent.safeGetAuthUser(ctx);
	if (!user?.email) return false;

	const superAdminEmail = process.env.SUPER_ADMIN;

	console.log(superAdminEmail);
	if (!superAdminEmail) return false;

	return user.email.toLowerCase() === superAdminEmail.toLowerCase();
}

// Check if current user is admin (for UI)
export const checkIsAdmin = query({
	args: {},
	handler: async (ctx) => {
		return await isSuperAdmin(ctx);
	},
});

// Get all seasons
export const getSeasons = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("seasons").order("desc").collect();
	},
});

// Get seasons by league
export const getSeasonsByLeague = query({
	args: { league: leagueValidator },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("seasons")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.order("desc")
			.collect();
	},
});

// Get active season for a league
export const getActiveSeason = query({
	args: { league: leagueValidator },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("seasons")
			.withIndex("by_league_active", (q) =>
				q.eq("league", args.league).eq("isActive", true),
			)
			.first();
	},
});

// Create a new season (admin only)
export const createSeason = mutation({
	args: {
		league: leagueValidator,
		name: v.string(),
		startDate: v.string(),
		endDate: v.string(),
		isActive: v.boolean(),
	},
	handler: async (ctx, args) => {
		const isAdmin = await isSuperAdmin(ctx);
		if (!isAdmin) {
			throw new Error("Unauthorized: Admin access required");
		}

		const now = Date.now();

		// If this season is active, deactivate other seasons for this league
		if (args.isActive) {
			const existingActive = await ctx.db
				.query("seasons")
				.withIndex("by_league_active", (q) =>
					q.eq("league", args.league).eq("isActive", true),
				)
				.collect();

			for (const season of existingActive) {
				await ctx.db.patch(season._id, { isActive: false, updatedAt: now });
			}
		}

		return await ctx.db.insert("seasons", {
			league: args.league,
			name: args.name,
			startDate: args.startDate,
			endDate: args.endDate,
			isActive: args.isActive,
			createdAt: now,
			updatedAt: now,
		});
	},
});

// Update a season (admin only)
export const updateSeason = mutation({
	args: {
		id: v.id("seasons"),
		name: v.optional(v.string()),
		startDate: v.optional(v.string()),
		endDate: v.optional(v.string()),
		isActive: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const isAdmin = await isSuperAdmin(ctx);
		if (!isAdmin) {
			throw new Error("Unauthorized: Admin access required");
		}

		const { id, ...updates } = args;
		const now = Date.now();

		const season = await ctx.db.get(id);
		if (!season) {
			throw new Error("Season not found");
		}

		// If setting this season as active, deactivate others
		if (updates.isActive === true) {
			const existingActive = await ctx.db
				.query("seasons")
				.withIndex("by_league_active", (q) =>
					q.eq("league", season.league).eq("isActive", true),
				)
				.collect();

			for (const s of existingActive) {
				if (s._id !== id) {
					await ctx.db.patch(s._id, { isActive: false, updatedAt: now });
				}
			}
		}

		await ctx.db.patch(id, {
			...updates,
			updatedAt: now,
		});
	},
});

// Delete a season (admin only)
export const deleteSeason = mutation({
	args: { id: v.id("seasons") },
	handler: async (ctx, args) => {
		const isAdmin = await isSuperAdmin(ctx);
		if (!isAdmin) {
			throw new Error("Unauthorized: Admin access required");
		}

		await ctx.db.delete(args.id);
	},
});

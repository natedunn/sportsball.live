import {
	createClient,
	type GenericCtx,
	type AuthFunctions,
} from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import authConfig from "./auth.config";
import { generateRandomUsername } from "./randomUsername";

const siteUrl = process.env.SITE_URL!;

const authFunctions: AuthFunctions = internal.auth as any;

export const authComponent = createClient<DataModel>(
	components.betterAuth as any,
	{
		authFunctions,
		triggers: {
			user: {
				onCreate: async (ctx, user) => {
					// Generate a random username if one wasn't provided
					const generatedUsername = user.username || generateRandomUsername();
					const finalUsername = generatedUsername.toLowerCase();

					// Sync to our local profile table for public profile queries
					await ctx.db.insert("profile", {
						email: user.email,
						name: user.name || undefined,
						image: user.image || undefined,
						emailVerified: user.emailVerified || false,
						username: finalUsername,
						displayUsername: user.username || generatedUsername,
						authUserId: String(user._id), // Store auth component's user ID for favorites lookup
						createdAt: Date.now(),
						updatedAt: Date.now(),
					});
				},
				onUpdate: async (ctx, user) => {
					// Sync updates to our local profile table
					const existingUser = await ctx.db
						.query("profile")
						.withIndex("by_email", (q) => q.eq("email", user.email))
						.first();

					if (existingUser) {
						await ctx.db.patch(existingUser._id, {
							name: user.name || undefined,
							image: user.image || undefined,
							username: user.username?.toLowerCase() || existingUser.username,
							displayUsername: user.username || existingUser.displayUsername,
							updatedAt: Date.now(),
						});
					} else {
						// Profile missing (e.g. onCreate failed) — create it now
						const generatedUsername = user.username || generateRandomUsername();
						const finalUsername = generatedUsername.toLowerCase();
						await ctx.db.insert("profile", {
							email: user.email,
							name: user.name || undefined,
							image: user.image || undefined,
							emailVerified: user.emailVerified || false,
							username: finalUsername,
							displayUsername: user.username || generatedUsername,
							authUserId: String(user._id),
							createdAt: Date.now(),
							updatedAt: Date.now(),
						});
					}
				},
			},
		},
	},
);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	return betterAuth({
		baseURL: siteUrl,
		trustedOrigins: ["http://localhost:3000", "http://localhost:3001", siteUrl],
		database: authComponent.adapter(ctx),
		socialProviders: {
			google: {
				clientId: process.env.GOOGLE_CLIENT_ID!,
				clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
			},
		},
		plugins: [username(), convex({ authConfig })],
	});
};

// Get the current authenticated user (merged with profile data)
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser) return null;

		const profile = await ctx.db
			.query("profile")
			.withIndex("by_email", (q) => q.eq("email", authUser.email))
			.first();

		return {
			...authUser,
			username: profile?.username,
			displayUsername: profile?.displayUsername,
		};
	},
});

// Get a user by username (public profile)
export const getUserByUsername = query({
	args: { username: v.string() },
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("profile")
			.withIndex("by_username", (q) =>
				q.eq("username", args.username.toLowerCase()),
			)
			.first();

		if (!user) return null;

		// Return only public fields
		return {
			id: user._id,
			name: user.name,
			username: user.username,
			displayUsername: user.displayUsername,
			image: user.image,
			createdAt: user.createdAt,
		};
	},
});

// Sync current user to local profile table (for existing profile created before triggers)
export const syncCurrentUserToLocal = mutation({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.safeGetAuthUser(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		// Check if user already exists in local table
		const existingUser = await ctx.db
			.query("profile")
			.withIndex("by_email", (q) => q.eq("email", user.email))
			.first();

		if (existingUser) {
			// Update existing record
			await ctx.db.patch(existingUser._id, {
				name: user.name || undefined,
				image: user.image || undefined,
				username:
					(user as any).username?.toLowerCase() || existingUser.username,
				displayUsername: (user as any).username || existingUser.displayUsername,
				authUserId: String(user._id), // Ensure auth component's user ID is stored
				updatedAt: Date.now(),
			});
			return { action: "updated" as const };
		}

		// Create new record
		const newUsername =
			(user as any).username?.toLowerCase() || generateRandomUsername();
		await ctx.db.insert("profile", {
			email: user.email,
			name: user.name || undefined,
			image: user.image || undefined,
			emailVerified: user.emailVerified || false,
			username: newUsername,
			displayUsername: (user as any).username || newUsername,
			authUserId: String(user._id), // Store auth component's user ID for favorites lookup
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		return { action: "created" as const };
	},
});

// Export triggers for Convex to call
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

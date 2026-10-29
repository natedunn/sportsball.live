import { getAuthUserId, setupConvexAuth } from "@convex-dev/auth/server";
import { setupGoogle } from "@convex-dev/auth/methods/google/server";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { viaGateway } from "./authGateway";

// Convex Auth v2 (beta). The core owns sessions, accounts, and JWT minting.
// Our `profile` table is the users table: every provider's `createUser`
// returns a profile id, and the JWT subject is that id.
const auth = setupConvexAuth({
	component: components.auth,
	usersTable: "profile",
});

export const { signOut, refreshSession, isAuthenticated } = auth;

// Exact origins sign-in may return to (comma-separated SITE_URL). Each
// environment sets its own: prod, cloud dev, and every local worktree.
const allowedRedirectOrigins = (process.env.SITE_URL ?? "http://localhost:3000")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

const google = setupGoogle(auth, {
	component: components.authGoogle,
	allowedRedirectOrigins,
}).attachUserCallbacks({
	createUser: internal.users.createUser,
	onSignIn: internal.users.onSignIn,
});
// Routes Google's callback through the OAuth gateway when AUTH_GATEWAY_SECRET is set.
export const startSignInWithGoogle = viaGateway("google", google.startSignInWithGoogle);
export const { completeSignInWithGoogle } = google;

/** The signed-in user's profile row, or null when signed out. */
export async function getCurrentProfile(ctx: QueryCtx) {
	const userId = await getAuthUserId<"profile">(ctx);
	if (userId === null) return null;
	return await ctx.db.get(userId);
}

// Get the current authenticated user
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const profile = await getCurrentProfile(ctx);
		if (!profile) return null;

		return {
			_id: profile._id,
			email: profile.email,
			name: profile.name,
			image: profile.image,
			username: profile.username,
			displayUsername: profile.displayUsername,
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

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export const isUsernameAvailable = query({
	args: { username: v.string() },
	handler: async (ctx, args) => {
		const username = args.username.trim().toLowerCase();
		if (!USERNAME_PATTERN.test(username)) return false;

		const existing = await ctx.db
			.query("profile")
			.withIndex("by_username", (q) => q.eq("username", username))
			.first();
		if (!existing) return true;

		const current = await getCurrentProfile(ctx);
		return current !== null && existing._id === current._id;
	},
});

// Update the signed-in user's display name and/or username
export const updateProfile = mutation({
	args: {
		name: v.optional(v.string()),
		username: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const profile = await getCurrentProfile(ctx);
		if (!profile) throw new ConvexError("Not authenticated");

		const updates: {
			name?: string;
			username?: string;
			displayUsername?: string;
			updatedAt: number;
		} = { updatedAt: Date.now() };

		if (args.name !== undefined) {
			updates.name = args.name.trim() || undefined;
		}

		if (args.username !== undefined) {
			const username = args.username.trim().toLowerCase();
			if (!USERNAME_PATTERN.test(username)) {
				throw new ConvexError(
					"Username must be 3-30 characters: letters, numbers, and underscores",
				);
			}
			const existing = await ctx.db
				.query("profile")
				.withIndex("by_username", (q) => q.eq("username", username))
				.first();
			if (existing && existing._id !== profile._id) {
				throw new ConvexError("Username is already taken");
			}
			updates.username = username;
			updates.displayUsername = username;
		}

		await ctx.db.patch(profile._id, updates);
	},
});

import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { auth } from "./zen/_generated/auth";
import { generateRandomUsername } from "./randomUsername";

type AuthUser = NonNullable<Awaited<ReturnType<typeof auth.user.safeGet>>>;

function profileFields(user: AuthUser) {
	const username = (user as AuthUser & { username?: string | null }).username;
	const fallbackUsername = username || generateRandomUsername();

	return {
		email: user.email,
		name: user.name || undefined,
		image: user.image || undefined,
		emailVerified: user.emailVerified,
		username: fallbackUsername.toLowerCase(),
		displayUsername: username || fallbackUsername,
		authUserId: String(user._id),
	};
}

async function syncUserToProfile(ctx: MutationCtx, user: AuthUser) {
	const fields = profileFields(user);
	const existing = await ctx.db
		.query("profile")
		.withIndex("by_email", (q) => q.eq("email", user.email))
		.first();

	if (existing) {
		await ctx.db.patch(existing._id, {
			...fields,
			updatedAt: Date.now(),
		});
		return { action: "updated" as const };
	}

	await ctx.db.insert("profile", {
		...fields,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	});
	return { action: "created" as const };
}

export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await auth.user.safeGet(ctx);
		if (!authUser) return null;

		const profile = await ctx.db
			.query("profile")
			.withIndex("by_email", (q) => q.eq("email", authUser.email))
			.first();

		return {
			...authUser,
			username: profile?.username ?? authUser.username,
			displayUsername: profile?.displayUsername ?? authUser.username,
		};
	},
});

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

export const isUsernameAvailable = query({
	args: { username: v.string() },
	handler: async (ctx, args) => {
		const username = args.username.trim().toLowerCase();
		const currentUser = await auth.user.safeGet(ctx);
		const existing = await ctx.db
			.query("profile")
			.withIndex("by_username", (q) => q.eq("username", username))
			.first();

		return {
			available: !existing || existing.authUserId === String(currentUser?._id),
		};
	},
});

export const syncCurrentUserToLocal = mutation({
	args: {},
	handler: async (ctx) => {
		const user = await auth.user.safeGet(ctx);
		if (!user) {
			throw new Error("Not authenticated");
		}

		return await syncUserToProfile(ctx, user);
	},
});

export const updateCurrentUserProfile = mutation({
	args: {
		name: v.optional(v.string()),
		username: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await auth.updateProfile(ctx, args);
		await syncUserToProfile(ctx, user);
		return user;
	},
});

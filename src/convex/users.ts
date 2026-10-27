import { vGoogleProfile } from "@convex-dev/auth/methods/google/server";
import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { generateRandomUsername } from "./randomUsername";

const vGoogleProvider = v.object({
	name: v.literal("google"),
	accountId: v.string(),
	profile: vGoogleProfile,
});

/**
 * Called by Convex Auth the first time it sees a Google account. Returns the
 * profile row the account belongs to.
 *
 * Profiles created under Better Auth are linked by verified email, and their
 * favorites (keyed by the old Better Auth user id) move to the profile id.
 */
export const createUser = internalMutation({
	args: { provider: vGoogleProvider },
	returns: v.id("profile"),
	handler: async (ctx, args) => {
		const { email, emailVerified, name, picture } = args.provider.profile;
		if (!email) {
			throw new ConvexError("Your Google account has no email address.");
		}
		const now = Date.now();

		if (emailVerified) {
			const existing = await ctx.db
				.query("profile")
				.withIndex("by_email", (q) => q.eq("email", email))
				.first();

			if (existing) {
				if (existing.authUserId) {
					const favorites = await ctx.db
						.query("favoriteTeams")
						.withIndex("by_user", (q) => q.eq("userId", existing.authUserId!))
						.collect();
					for (const favorite of favorites) {
						await ctx.db.patch(favorite._id, { userId: String(existing._id) });
					}
				}
				await ctx.db.patch(existing._id, {
					authUserId: undefined,
					emailVerified: true,
					image: existing.image ?? picture,
					updatedAt: now,
				});
				return existing._id;
			}
		}

		const username = generateRandomUsername().toLowerCase();
		return await ctx.db.insert("profile", {
			email,
			name,
			image: picture,
			emailVerified,
			username,
			displayUsername: username,
			createdAt: now,
			updatedAt: now,
		});
	},
});

/** Runs on every sign-in. Keeps the avatar in sync with Google; the name is the user's to edit. */
export const onSignIn = internalMutation({
	args: { provider: vGoogleProvider, userId: v.id("profile") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const profile = await ctx.db.get(args.userId);
		const { picture } = args.provider.profile;
		if (profile && picture && profile.image !== picture) {
			await ctx.db.patch(profile._id, { image: picture, updatedAt: Date.now() });
		}
		return null;
	},
});

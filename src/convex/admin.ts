import { query, internalQuery, type QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";

// Helper to check if current user is a super admin
async function isSuperAdmin(ctx: QueryCtx): Promise<boolean> {
	const user = await authComponent.safeGetAuthUser(ctx);
	if (!user?.email) return false;

	const superAdminEmail = process.env.SUPER_ADMIN;
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

// Internal version for use in actions
export const internalCheckIsAdmin = internalQuery({
	args: {},
	handler: async (ctx) => {
		return await isSuperAdmin(ctx);
	},
});

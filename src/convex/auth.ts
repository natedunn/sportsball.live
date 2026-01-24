import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(
	components.betterAuth as any,
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
		plugins: [convex({ authConfig })],
	});
};

// Get the current authenticated user
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		return authComponent.safeGetAuthUser(ctx);
	},
});

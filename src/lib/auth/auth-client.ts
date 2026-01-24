import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { adminClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: process.env.SITE_URL!,
	plugins: [
		//
		usernameClient(),
		adminClient(),
		convexClient(),
	],
});

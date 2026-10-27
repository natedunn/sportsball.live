import { defineApp } from "convex/server";
import { v } from "convex/values";
import auth from "@convex-dev/auth/convex.config.js";
import google from "@convex-dev/auth/components/google/convex.config.js";

const app = defineApp({
	env: {
		AUTH_PRIVATE_KEY: v.string(),
		AUTH_JWKS: v.string(),
		AUTH_GOOGLE_CLIENT_ID: v.string(),
		AUTH_GOOGLE_CLIENT_SECRET: v.string(),
		// The OAuth gateway's Google callback, e.g.
		// https://gateway-dev.sportsball.live/oauth/google/callback. Unset = the
		// deployment's own callback. Needs our @convex-dev/auth patch.
		AUTH_GOOGLE_CALLBACK_URL: v.optional(v.string()),
	},
});

// Core: sessions, accounts, and JWT minting. Serves the JWKS at /auth/.well-known/jwks.json.
app.use(auth, {
	httpPrefix: "/auth",
	env: {
		AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY,
		AUTH_JWKS: app.env.AUTH_JWKS,
	},
});

// Google OAuth. Google redirects to the tier's gateway, which forwards to this
// deployment's `/oauth/google/callback` (docs/auth-environments.md).
app.use(google, {
	httpPrefix: "/oauth/google",
	env: {
		CLIENT_ID: app.env.AUTH_GOOGLE_CLIENT_ID,
		CLIENT_SECRET: app.env.AUTH_GOOGLE_CLIENT_SECRET,
		CALLBACK_URL: app.env.AUTH_GOOGLE_CALLBACK_URL,
	},
});

export default app;

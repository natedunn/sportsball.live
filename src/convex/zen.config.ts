import { defineConvexZen, googleProvider, mapOAuthUser } from "convex-zen";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export default defineConvexZen({
	username: {
		required: true,
	},
	oauth: {
		mapUserOnCreate: async (args) => mapOAuthUser("create", args),
		mapUserOnSignIn: async (args) => mapOAuthUser("update", args),
	},
	providers:
		googleClientId && googleClientSecret
			? [
					googleProvider({
						clientId: googleClientId,
						clientSecret: googleClientSecret,
					}),
				]
			: [],
	runtime: {
		tokenEncryptionSecretEnvVar: "CONVEX_ZEN_SECRET",
	},
});

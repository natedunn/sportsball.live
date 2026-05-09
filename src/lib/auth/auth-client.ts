import { createTanStackAuthClient } from "convex-zen/tanstack-start";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/zen/_generated/meta";

export const authClient = createTanStackAuthClient({
	convexFunctions: api.zen,
	meta: authMeta,
});

export type AppAuthClient = typeof authClient;

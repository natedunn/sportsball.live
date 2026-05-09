import type { AuthConfig } from "convex/server";
import { createConvexZenIdentityJwt } from "convex-zen/tanstack-start/identity-jwt";

const authConfig: AuthConfig = {
	providers: [createConvexZenIdentityJwt().authProvider],
};

export default authConfig;

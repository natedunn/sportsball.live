/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    core: {
      gateway: {
        applyOAuthSignInPatch: FunctionReference<
          "mutation",
          "internal",
          { image?: string; name?: string; userId: string; username?: string },
          any,
          Name
        >;
        assertUserNotBanned: FunctionReference<
          "mutation",
          "internal",
          { userId: string },
          any,
          Name
        >;
        createOAuthProxyHandoff: FunctionReference<
          "action",
          "internal",
          {
            errorRedirectTo?: string;
            provider: string;
            redirectTo?: string;
            userId: string;
          },
          any,
          Name
        >;
        createSessionForOAuth: FunctionReference<
          "mutation",
          "internal",
          { ipAddress?: string; userAgent?: string; userId: string },
          any,
          Name
        >;
        exchangeProxyCode: FunctionReference<
          "action",
          "internal",
          {
            checkBanned?: boolean;
            code: string;
            ipAddress?: string;
            userAgent?: string;
          },
          any,
          Name
        >;
        finalizeOAuthIdentity: FunctionReference<
          "mutation",
          "internal",
          {
            accessTokenExpiresAt?: number;
            accountId: string;
            createUser?: {
              email: string;
              emailVerified: boolean;
              image?: string;
              name?: string;
              username?: string | null;
            };
            defaultRole?: string;
            email?: string;
            encryptedAccessToken: string;
            encryptedRefreshToken?: string;
            image?: string;
            name?: string;
            profileUsername?: string;
            providerId: string;
            skipSignInPatch?: boolean;
            usernameConfig?: false | { required: boolean };
          },
          any,
          Name
        >;
        getAuthorizationUrl: FunctionReference<
          "mutation",
          "internal",
          {
            callbackUrl?: string;
            errorRedirectTo?: string;
            provider: {
              accessType?: "offline" | "online";
              authorizationUrl: string;
              clientId: string;
              clientSecret: string;
              hostedDomain?: string;
              id: string;
              prompt?: "none" | "consent" | "select_account";
              runtimeConfig?: any;
              scopes: Array<string>;
              tokenEncryptionSecret?: string;
              tokenUrl: string;
              trustVerifiedEmail?: boolean;
              userInfoUrl: string;
            };
            proxyMode?: "direct" | "broker";
            redirectTo?: string;
            redirectUrl?: string;
            returnTarget?: string;
          },
          any,
          Name
        >;
        getCurrentUser: FunctionReference<
          "query",
          "internal",
          {
            checkBanned?: boolean;
            token: string;
            usernameConfig?: false | { required: boolean };
          },
          any,
          Name
        >;
        getOAuthUserSnapshot: FunctionReference<
          "query",
          "internal",
          { userId: string },
          any,
          Name
        >;
        getUserById: FunctionReference<
          "query",
          "internal",
          {
            checkBanned?: boolean;
            userId: string;
            usernameConfig?: false | { required: boolean };
          },
          any,
          Name
        >;
        handleCallback: FunctionReference<
          "action",
          "internal",
          {
            callbackUrl?: string;
            checkBanned?: boolean;
            code: string;
            defaultRole?: string;
            errorRedirectTo?: string;
            ipAddress?: string;
            provider: {
              accessType?: "offline" | "online";
              authorizationUrl: string;
              clientId: string;
              clientSecret: string;
              hostedDomain?: string;
              id: string;
              prompt?: "none" | "consent" | "select_account";
              runtimeConfig?: any;
              scopes: Array<string>;
              tokenEncryptionSecret?: string;
              tokenUrl: string;
              trustVerifiedEmail?: boolean;
              userInfoUrl: string;
            };
            redirectTo?: string;
            redirectUrl?: string;
            state: string;
            userAgent?: string;
            usernameConfig?: false | { required: boolean };
          },
          any,
          Name
        >;
        handleProxyCallback: FunctionReference<
          "action",
          "internal",
          {
            callbackUrl?: string;
            code: string;
            defaultRole?: string;
            errorRedirectTo?: string;
            provider: {
              accessType?: "offline" | "online";
              authorizationUrl: string;
              clientId: string;
              clientSecret: string;
              hostedDomain?: string;
              id: string;
              prompt?: "none" | "consent" | "select_account";
              runtimeConfig?: any;
              scopes: Array<string>;
              tokenEncryptionSecret?: string;
              tokenUrl: string;
              trustVerifiedEmail?: boolean;
              userInfoUrl: string;
            };
            redirectTo?: string;
            redirectUrl?: string;
            state: string;
            usernameConfig?: false | { required: boolean };
          },
          any,
          Name
        >;
        inspectOAuthIdentityCandidate: FunctionReference<
          "query",
          "internal",
          { accountId: string; email?: string; providerId: string },
          any,
          Name
        >;
        invalidateAllSessions: FunctionReference<
          "mutation",
          "internal",
          { userId: string },
          any,
          Name
        >;
        invalidateSession: FunctionReference<
          "mutation",
          "internal",
          { token: string },
          any,
          Name
        >;
        requestPasswordReset: FunctionReference<
          "mutation",
          "internal",
          { email: string; ipAddress?: string },
          any,
          Name
        >;
        resetPassword: FunctionReference<
          "mutation",
          "internal",
          { code: string; email: string; newPassword: string },
          any,
          Name
        >;
        resolveOAuthCallbackData: FunctionReference<
          "action",
          "internal",
          {
            callbackUrl?: string;
            code: string;
            defaultRole?: string;
            errorRedirectTo?: string;
            provider: {
              accessType?: "offline" | "online";
              authorizationUrl: string;
              clientId: string;
              clientSecret: string;
              hostedDomain?: string;
              id: string;
              prompt?: "none" | "consent" | "select_account";
              runtimeConfig?: any;
              scopes: Array<string>;
              tokenEncryptionSecret?: string;
              tokenUrl: string;
              trustVerifiedEmail?: boolean;
              userInfoUrl: string;
            };
            redirectTo?: string;
            redirectUrl?: string;
            state: string;
            usernameConfig?: false | { required: boolean };
          },
          any,
          Name
        >;
        signIn: FunctionReference<
          "mutation",
          "internal",
          {
            checkBanned?: boolean;
            email?: string;
            ipAddress?: string;
            password: string;
            requireVerification?: boolean;
            userAgent?: string;
            username?: string;
            usernameConfig?: false | { required: boolean };
          },
          any,
          Name
        >;
        signUp: FunctionReference<
          "mutation",
          "internal",
          {
            defaultRole?: string;
            email: string;
            ipAddress?: string;
            name?: string;
            password: string;
            username?: string;
            usernameConfig?: false | { required: boolean };
          },
          any,
          Name
        >;
        updateProfile: FunctionReference<
          "mutation",
          "internal",
          {
            image?: string;
            name?: string;
            token?: string;
            username?: string;
            usernameConfig?: false | { required: boolean };
          },
          any,
          Name
        >;
        validateOAuthUsernameCandidate: FunctionReference<
          "query",
          "internal",
          { existingUserId?: string; username: string },
          any,
          Name
        >;
        validateSession: FunctionReference<
          "mutation",
          "internal",
          { checkBanned?: boolean; token: string },
          any,
          Name
        >;
        verifyEmail: FunctionReference<
          "mutation",
          "internal",
          { code: string; email: string },
          any,
          Name
        >;
      };
    };
  };

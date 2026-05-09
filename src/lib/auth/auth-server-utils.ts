import {
	deleteCookie,
	getCookie,
	setCookie,
} from "@tanstack/react-start/server";
import { createConvexZenIdentityJwt } from "convex-zen/tanstack-start/identity-jwt";
import { ConvexHttpClient } from "convex/browser";
import type {
	FunctionArgs,
	FunctionReference,
	FunctionReturnType,
} from "convex/server";
import { api } from "../../convex/_generated/api";

const convexUrl = import.meta.env["VITE_CONVEX_URL"] as string;
const cookieName = "cz_session";
const identityJwt = createConvexZenIdentityJwt();
const cookieOptions = {
	httpOnly: true,
	sameSite: "lax" as const,
	secure: process.env.NODE_ENV === "production",
	path: "/",
	maxAge: 14 * 24 * 60 * 60,
};

function createConvexHttpClient(token?: string | null) {
	const client = new ConvexHttpClient(convexUrl);
	if (token) {
		client.setAuth(token);
	}
	return client;
}

async function encodeCookieToken(sessionToken: string, userId: string) {
	return await identityJwt.sessionTokenCodec.encode({ sessionToken, userId });
}

async function getRawSessionToken() {
	const cookieToken = getCookie(cookieName);
	if (!cookieToken) return null;

	const decoded = await identityJwt.sessionTokenCodec.decode(cookieToken);
	return decoded?.sessionToken ?? null;
}

async function establishSession(sessionToken: string) {
	const session = await createConvexHttpClient().mutation(
		api.zen.core.validateSession,
		{ token: sessionToken },
	);
	if (!session) {
		throw new Error("Invalid session token");
	}

	setCookie(
		cookieName,
		await encodeCookieToken(sessionToken, session.userId),
		cookieOptions,
	);
	return session;
}

export async function getSession() {
	const sessionToken = await getRawSessionToken();
	if (!sessionToken) return null;

	return await createConvexHttpClient().mutation(api.zen.core.validateSession, {
		token: sessionToken,
	});
}

export async function getToken() {
	const cookieToken = getCookie(cookieName);
	if (!cookieToken) return null;

	const session = await getSession();
	return session ? cookieToken : null;
}

async function requireAuth() {
	const [token, session] = await Promise.all([getToken(), getSession()]);
	if (!token || !session) {
		throw new Error("Unauthorized");
	}
	return { token, session };
}

export async function fetchAuthQuery<
	Query extends FunctionReference<"query", "public">,
>(fn: Query, args: FunctionArgs<Query>): Promise<FunctionReturnType<Query>> {
	const { token } = await requireAuth();
	return await createConvexHttpClient(token).query(fn, args);
}

export async function fetchAuthMutation<
	Mutation extends FunctionReference<"mutation", "public">,
>(
	fn: Mutation,
	args: FunctionArgs<Mutation>,
): Promise<FunctionReturnType<Mutation>> {
	const { token } = await requireAuth();
	return await createConvexHttpClient(token).mutation(fn, args);
}

export async function fetchAuthAction<
	Action extends FunctionReference<"action", "public">,
>(fn: Action, args: FunctionArgs<Action>): Promise<FunctionReturnType<Action>> {
	const { token } = await requireAuth();
	return await createConvexHttpClient(token).action(fn, args);
}

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store",
		},
	});
}

function redirect(to: string) {
	return new Response(null, {
		status: 302,
		headers: { location: to },
	});
}

function callbackUrlFor(request: Request, providerId: string) {
	return new URL(`/api/auth/callback/${providerId}`, request.url).toString();
}

function safeRedirectTarget(value: string | null, fallback = "/") {
	if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
	return value;
}

export async function handler(request: Request) {
	const url = new URL(request.url);
	const segments = url.pathname
		.replace(/^\/api\/auth\/?/, "")
		.split("/")
		.filter(Boolean);
	const action = segments[0];

	try {
		if (request.method === "GET" && action === "session") {
			return json({ session: await getSession() });
		}

		if (request.method === "GET" && action === "token") {
			return json({ token: await getToken() });
		}

		if (request.method === "POST" && action === "sign-out") {
			const sessionToken = await getRawSessionToken();
			if (sessionToken) {
				await createConvexHttpClient().mutation(api.zen.core.invalidateSession, {
					token: sessionToken,
				});
			}
			deleteCookie(cookieName, { path: "/" });
			return json({ ok: true });
		}

		if (request.method === "GET" && action === "sign-in" && segments[1]) {
			const providerId = segments[1];
			const redirectTo = safeRedirectTarget(url.searchParams.get("redirectTo"));
			const errorRedirectTo = safeRedirectTarget(
				url.searchParams.get("errorRedirectTo"),
				redirectTo,
			);
			const result = await createConvexHttpClient().mutation(
				api.zen.core.getOAuthUrl,
				{
					providerId,
					callbackUrl: callbackUrlFor(request, providerId),
					redirectTo,
					errorRedirectTo,
				},
			);

			if (
				!result ||
				typeof result !== "object" ||
				!("authorizationUrl" in result) ||
				typeof result.authorizationUrl !== "string"
			) {
				throw new Error("Invalid OAuth start response");
			}

			if (url.searchParams.get("mode") === "json") {
				return json({ authorizationUrl: result.authorizationUrl });
			}
			return redirect(result.authorizationUrl);
		}

		if (request.method === "GET" && action === "callback" && segments[1]) {
			const providerId = segments[1];
			const code = url.searchParams.get("code");
			const state = url.searchParams.get("state");
			if (!code || !state) {
				return redirect("/auth/sign-in?error=oauth_callback_error");
			}

			const result = await createConvexHttpClient().action(
				api.zen.core.handleOAuthCallback,
				{
					providerId,
					code,
					state,
					callbackUrl: callbackUrlFor(request, providerId),
					userAgent: request.headers.get("user-agent") ?? undefined,
				},
			);

			if (
				!result ||
				typeof result !== "object" ||
				!("sessionToken" in result) ||
				typeof result.sessionToken !== "string"
			) {
				throw new Error("Invalid OAuth callback response");
			}

			await establishSession(result.sessionToken);
			return redirect(
				safeRedirectTarget(
					"redirectTo" in result && typeof result.redirectTo === "string"
						? result.redirectTo
						: null,
				),
			);
		}
	} catch (error) {
		console.error("Auth route failed", error);
		return json({ error: "Authentication request failed" }, 400);
	}

	return json({ error: "Not found" }, 404);
}

import { isAllowedTarget, isProvider, verifyRouting } from "./routing.ts";

// One OAuth app per provider per tier registers this Worker's
// /oauth/<provider>/callback as its only redirect URI. The deployment that
// started the sign-in signed its address into `state`; we check it and send
// the browser on to that deployment's own callback with the original state.
// No provider credentials live here. See docs/auth-environments.md.

export interface Env {
	/** Shared with each deployment's AUTH_GATEWAY_SECRET. `wrangler secret put`. */
	ROUTING_SECRET: string;
	/** Comma-separated origin patterns this tier may forward to. */
	ALLOWED_TARGETS: string;
	CALLBACK_LIMITER?: RateLimit;
}

const CALLBACK = /^\/oauth\/([a-z]+)\/callback$/;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const match = CALLBACK.exec(url.pathname);
		if (!match) {
			return url.pathname === "/" ? text(200, "Sportsball sign-in gateway.") : text(404, "Not found.");
		}
		if (request.method !== "GET") return text(405, "Method not allowed.");
		const provider = match[1];
		if (!isProvider(provider)) return text(404, "Not found.");

		const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
		if (env.CALLBACK_LIMITER && !(await env.CALLBACK_LIMITER.limit({ key: ip })).success) {
			return text(429, "Too many sign-in attempts. Wait a minute and try again.");
		}

		const state = url.searchParams.get("state");
		const routing = state && (await verifyRouting(env.ROUTING_SECRET, provider, state));
		if (!routing || !isAllowedTarget(routing.target, env.ALLOWED_TARGETS)) {
			console.warn("gateway: rejected callback", { provider, hasState: !!state, routed: !!routing });
			return text(400, "This sign-in link is invalid. Go back to Sportsball and try signing in again.");
		}

		const next = new URL(`${routing.target}/oauth/${provider}/callback`);
		for (const [key, value] of url.searchParams) {
			next.searchParams.append(key, key === "state" ? routing.state : value);
		}
		return new Response(null, {
			status: 302,
			headers: { Location: next.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
		});
	},
} satisfies ExportedHandler<Env>;

function text(status: number, body: string) {
	return new Response(body, {
		status,
		headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
	});
}

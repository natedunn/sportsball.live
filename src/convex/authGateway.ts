import type { RegisteredMutation } from "convex/server";
import { v } from "convex/values";
import { type MutationCtx, mutation } from "./_generated/server";

// Every environment shares one OAuth app per provider, registered with the
// tier's gateway as its only callback (workers/gateway). The provider echoes
// `state`, so that's where we tell the gateway which deployment to forward
// the callback to: `<b64url(CONVEX_SITE_URL)>.<b64url(hmac)>.<original state>`.
// The gateway checks the signature, strips the prefix and forwards the
// original state, which is what the deployment stored the hash of.
//
// Active when AUTH_GATEWAY_SECRET is set (same secret as the gateway's
// ROUTING_SECRET); the AUTH_<PROVIDER>_CALLBACK_URL vars must then point at
// the gateway too. See docs/auth-environments.md.

type StartSignIn = RegisteredMutation<
	"public",
	{ redirectTo: string },
	Promise<{ redirect: string; state: string }>
>;

/** Wrap a provider's `startSignIn` so its callback routes through the gateway. */
export function viaGateway(provider: string, startSignIn: StartSignIn) {
	// `_handler` is undocumented but stable across Convex releases; the
	// package doesn't export the unregistered handler.
	const handler = (startSignIn as unknown as {
		_handler: (ctx: MutationCtx, args: { redirectTo: string }) => Promise<{ redirect: string; state: string }>;
	})._handler;
	return mutation({
		args: { redirectTo: v.string() },
		returns: v.object({ redirect: v.string(), state: v.string() }),
		handler: async (ctx, args) => {
			const result = await handler(ctx, args);
			const secret = process.env.AUTH_GATEWAY_SECRET;
			if (!secret) return result;
			const target = process.env.CONVEX_SITE_URL;
			if (!target) throw new Error("CONVEX_SITE_URL is not set");
			const url = new URL(result.redirect);
			url.searchParams.set("state", `${await routingPrefix(secret, provider, target)}${result.state}`);
			// The client keeps the original state; only the provider sees the prefix.
			return { redirect: url.toString(), state: result.state };
		},
	});
}

/** Must match `verifyRouting` in workers/gateway/src/routing.ts. */
export async function routingPrefix(secret: string, provider: string, target: string) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${provider}\n${target}`));
	return `${base64Url(new TextEncoder().encode(target))}.${base64Url(new Uint8Array(mac))}.`;
}

function base64Url(bytes: Uint8Array) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

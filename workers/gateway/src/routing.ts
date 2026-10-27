// The routing prefix a deployment puts in front of `state`, built by
// `routingPrefix` in src/convex/authGateway.ts:
//
//   <b64url(target)>.<b64url(HMAC-SHA256(secret, `${provider}\n${target}`))>.<state>
//
// `target` is the deployment's CONVEX_SITE_URL (an origin, no path).

export const PROVIDERS = ["google"] as const;
export type Provider = (typeof PROVIDERS)[number];

export function isProvider(value: string): value is Provider {
	return (PROVIDERS as readonly string[]).includes(value);
}

export type Routing = { target: string; state: string };

/** Verify the prefix on `state`; null if it's missing, malformed or forged. */
export async function verifyRouting(secret: string, provider: Provider, prefixed: string): Promise<Routing | null> {
	const parts = prefixed.split(".");
	if (parts.length !== 3) return null;
	const [encodedTarget, encodedMac, state] = parts;
	const target = decodeText(encodedTarget);
	const mac = decodeBytes(encodedMac);
	if (target === null || mac === null || state === "") return null;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	);
	// subtle.verify compares in constant time.
	const valid = await crypto.subtle.verify("HMAC", key, mac, new TextEncoder().encode(`${provider}\n${target}`));
	return valid ? { target, state } : null;
}

/**
 * Whether `target` is an origin the tier may forward to. Patterns are
 * comma-separated origins; `*.` matches one leading host label and `:*` any
 * port, e.g. `https://*.convex.site,http://127.0.0.1:*`.
 */
export function isAllowedTarget(target: string, patterns: string): boolean {
	let url: URL;
	try {
		url = new URL(target);
	} catch {
		return false;
	}
	// Exactly an origin: no path, query, credentials or trailing slash.
	if (url.origin !== target) return false;
	return patterns
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean)
		.some((pattern) => matchesOrigin(url, pattern));
}

function matchesOrigin(url: URL, pattern: string): boolean {
	const match = /^(https?):\/\/([^/:]+)(?::(\d+|\*))?$/.exec(pattern);
	if (!match) return false;
	const [, scheme, host, port] = match;
	if (url.protocol !== `${scheme}:`) return false;
	if (port === "*") {
		// any port, including the default
	} else if ((url.port || "") !== (port ?? "")) {
		return false;
	}
	if (host.startsWith("*.")) {
		const suffix = host.slice(1); // ".convex.site"
		const label = url.hostname.slice(0, -suffix.length);
		return url.hostname.endsWith(suffix) && /^[a-z0-9-]+$/.test(label);
	}
	return url.hostname === host;
}

function decodeBytes(value: string): Uint8Array | null {
	if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
	try {
		const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
		return Uint8Array.from(binary, (c) => c.charCodeAt(0));
	} catch {
		return null;
	}
}

function decodeText(value: string): string | null {
	const bytes = decodeBytes(value);
	if (!bytes) return null;
	try {
		return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
	} catch {
		return null;
	}
}

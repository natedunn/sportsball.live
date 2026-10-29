import assert from "node:assert/strict";
import { test } from "node:test";
import worker, { type Env } from "./index.ts";
import { isAllowedTarget, verifyRouting } from "./routing.ts";

// Produced by convex/authGateway.ts `routingPrefix` on a local deployment
// (secret "test-secret-local", provider "google"), so both sides agree.
const SECRET = "test-secret-local";
const PREFIX = "aHR0cDovLzEyNy4wLjAuMTozMjEx.BDAG-tF1MeKnh20cZ0V30clabCfh1j3EsAF57ofNroQ.";
const STATE = "5eEgJ8BiIRjcyIzXPcgcjUY8B1rfl8Z-_auvFVqxZ2Q";

const env: Env = { ROUTING_SECRET: SECRET, ALLOWED_TARGETS: "https://*.convex.site, http://127.0.0.1:*" };

const call = (path: string, init?: RequestInit, e: Env = env) =>
	worker.fetch(new Request(`https://gateway-dev.sportsball.live${path}`, init), e);

test("verifies a prefix minted by the Convex side", async () => {
	assert.deepEqual(await verifyRouting(SECRET, "google", PREFIX + STATE), {
		target: "http://127.0.0.1:3211",
		state: STATE,
	});
});

test("rejects a wrong secret, provider or tampered target", async () => {
	assert.equal(await verifyRouting("other", "google", PREFIX + STATE), null);
	assert.equal(await verifyRouting(SECRET, "discord" as "google", PREFIX + STATE), null);
	const forged = `${btoa("https://evil.convex.site").replace(/=+$/, "")}.${PREFIX.split(".")[1]}.${STATE}`;
	assert.equal(await verifyRouting(SECRET, "google", forged), null);
	assert.equal(await verifyRouting(SECRET, "google", STATE), null);
	assert.equal(await verifyRouting(SECRET, "google", `${PREFIX}`), null);
});

test("allowlist matches origins only", () => {
	const patterns = "https://*.convex.site,http://127.0.0.1:*";
	assert.ok(isAllowedTarget("https://grandiose-yak-969.convex.site", patterns));
	assert.ok(isAllowedTarget("http://127.0.0.1:3211", patterns));
	assert.ok(!isAllowedTarget("https://a.b.convex.site", patterns));
	assert.ok(!isAllowedTarget("https://convex.site", patterns));
	assert.ok(!isAllowedTarget("https://evilconvex.site", patterns));
	assert.ok(!isAllowedTarget("http://grandiose-yak-969.convex.site", patterns));
	assert.ok(!isAllowedTarget("https://grandiose-yak-969.convex.site/path", patterns));
	assert.ok(!isAllowedTarget("https://grandiose-yak-969.convex.site/", patterns));
	assert.ok(!isAllowedTarget("https://user@grandiose-yak-969.convex.site", patterns));
	assert.ok(!isAllowedTarget("http://127.0.0.1.evil.com:3211", patterns));
	assert.ok(isAllowedTarget("https://sportsball-prod.convex.site", "https://sportsball-prod.convex.site"));
	assert.ok(!isAllowedTarget("https://other.convex.site", "https://sportsball-prod.convex.site"));
	assert.ok(!isAllowedTarget("https://x.convex.site", ""));
});

test("forwards to the deployment with the original state and other params intact", async () => {
	const res = await call(`/oauth/google/callback?code=abc&state=${PREFIX}${STATE}`);
	assert.equal(res.status, 302);
	const location = new URL(res.headers.get("location")!);
	assert.equal(location.origin + location.pathname, "http://127.0.0.1:3211/oauth/google/callback");
	assert.equal(location.searchParams.get("code"), "abc");
	assert.equal(location.searchParams.get("state"), STATE);
	assert.equal(res.headers.get("referrer-policy"), "no-referrer");
});

test("forwards provider errors too, so the deployment can tell the app", async () => {
	const res = await call(`/oauth/google/callback?error=access_denied&state=${PREFIX}${STATE}`);
	assert.equal(res.status, 302);
	assert.equal(new URL(res.headers.get("location")!).searchParams.get("error"), "access_denied");
});

test("refuses bad requests", async () => {
	assert.equal((await call(`/oauth/google/callback?code=abc`)).status, 400);
	assert.equal((await call(`/oauth/google/callback?code=abc&state=${STATE}`)).status, 400);
	assert.equal((await call(`/oauth/github/callback?code=abc&state=${PREFIX}${STATE}`)).status, 404);
	assert.equal((await call(`/oauth/twitter/callback?state=${PREFIX}${STATE}`)).status, 404);
	assert.equal((await call(`/oauth/google/callback`, { method: "POST" })).status, 405);
	assert.equal((await call(`/elsewhere`)).status, 404);
	const prodOnly = { ...env, ALLOWED_TARGETS: "https://sportsball-prod.convex.site" };
	assert.equal((await call(`/oauth/google/callback?code=abc&state=${PREFIX}${STATE}`, {}, prodOnly)).status, 400);
});

test("rate limits per IP", async () => {
	const limited: Env = { ...env, CALLBACK_LIMITER: { limit: async () => ({ success: false }) } as RateLimit };
	assert.equal((await call(`/oauth/google/callback?state=${PREFIX}${STATE}`, {}, limited)).status, 429);
});

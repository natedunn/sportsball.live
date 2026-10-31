import type { ReactElement } from "react";
import { GoogleFont, ImageResponse } from "@cf-wasm/og";
import { OG_HEIGHT, OG_WIDTH } from "./og-cards";

// Bump to make every cached card render again after a design change
const OG_VERSION = "1";

// Module scope, so an isolate fetches each font once
const fonts = [
	new GoogleFont("Inter", { weight: 400 }),
	new GoogleFont("Inter", { weight: 600 }),
	new GoogleFont("Inter", { weight: 800 }),
];

/**
 * Render a card to PNG, cached in the Cloudflare Cache API for `maxAge`
 * seconds. Crawlers get the same max-age.
 */
export async function ogImageResponse(
	request: Request,
	maxAge: number,
	renderCard: () => Promise<ReactElement | null>,
): Promise<Response> {
	const cacheKey = new URL(request.url);
	cacheKey.searchParams.set("og-version", OG_VERSION);
	const cache = typeof caches !== "undefined" ? await caches.open("og-images") : null;

	const cached = await cache?.match(cacheKey.toString());
	if (cached) return cached;

	try {
		const card = await renderCard();
		if (!card) {
			return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-cache" } });
		}
		const image = await ImageResponse.async(card, {
			width: OG_WIDTH,
			height: OG_HEIGHT,
			fonts,
			emoji: "noto",
		});
		const response = new Response(await image.arrayBuffer(), {
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": `public, max-age=${maxAge}`,
			},
		});
		if (cache) await cache.put(cacheKey.toString(), response.clone());
		return response;
	} catch (error) {
		console.error("OG image error:", error);
		return new Response("Failed to render image", {
			status: 500,
			headers: { "Cache-Control": "no-cache" },
		});
	}
}

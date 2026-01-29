// Server-side logo caching using Cloudflare Cache API
// This prevents excessive requests to ESPN CDN

const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Fetch a logo with server-side caching.
 * Uses Cloudflare Cache API when available, falls back to direct fetch.
 */
export async function fetchLogoWithCache(
	logoUrl: string,
	cacheKey: string,
): Promise<Response> {
	// Try to use Cloudflare Cache API (only available in Workers runtime)
	const cache =
		typeof caches !== "undefined" ? await caches.open("logos") : null;

	if (cache) {
		// Check cache first
		const cached = await cache.match(cacheKey);
		if (cached) {
			return cached;
		}
	}

	// Fetch from origin
	const response = await fetch(logoUrl);

	if (!response.ok) {
		return new Response("Failed to fetch logo", {
			status: 502,
			headers: { "Cache-Control": "no-cache" },
		});
	}

	const contentType = response.headers.get("content-type") || "image/png";
	const imageData = await response.arrayBuffer();

	// Create cacheable response
	const cacheableResponse = new Response(imageData, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Cache-Control": `public, max-age=${CACHE_TTL}`,
		},
	});

	// Store in cache (non-blocking)
	if (cache) {
		// Clone response since we need to return the original
		cache.put(cacheKey, cacheableResponse.clone());
	}

	return cacheableResponse;
}

/**
 * Create a logo proxy handler for a league.
 */
export function createLogoHandler(
	teamLogos: Record<string, string>,
	league: string,
) {
	return async (params: { id: string }): Promise<Response> => {
		const { id } = params;
		const logoUrl = teamLogos[id.toLowerCase()];

		if (!logoUrl) {
			return new Response("Logo not found", {
				status: 404,
				headers: { "Cache-Control": "no-cache" },
			});
		}

		try {
			// Use a consistent cache key that includes the league and team
			const cacheKey = `https://sportsball.live/cache/${league}/logo/${id.toLowerCase()}`;
			return await fetchLogoWithCache(logoUrl, cacheKey);
		} catch (error) {
			console.error("Logo fetch error:", error);
			return new Response("Failed to fetch logo", {
				status: 502,
				headers: { "Cache-Control": "no-cache" },
			});
		}
	};
}

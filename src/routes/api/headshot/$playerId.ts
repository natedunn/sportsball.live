import { createFileRoute } from "@tanstack/react-router";
import { fetchLogoWithCache } from "@/lib/logo-cache";

export const Route = createFileRoute("/api/headshot/$playerId")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const { playerId } = params;

				// Validate playerId is numeric
				if (!/^\d+$/.test(playerId)) {
					return new Response("Invalid player ID", {
						status: 400,
						headers: { "Cache-Control": "no-cache" },
					});
				}

				const cdnBase = process.env.NBA_HEADSHOT_CDN;
				if (!cdnBase) {
					return new Response("NBA_HEADSHOT_CDN not configured", {
						status: 500,
						headers: { "Cache-Control": "no-cache" },
					});
				}

				// Headshot URL (works for NBA, WNBA, and G-League players)
				const headshotUrl = `${cdnBase}/headshots/nba/latest/260x190/${playerId}.png`;
				const cacheKey = `https://sportsball.live/cache/headshot/${playerId}`;

				try {
					return await fetchLogoWithCache(headshotUrl, cacheKey);
				} catch (error) {
					console.error("Headshot fetch error:", error);
					return new Response("Failed to fetch headshot", {
						status: 502,
						headers: { "Cache-Control": "no-cache" },
					});
				}
			},
		},
	},
});

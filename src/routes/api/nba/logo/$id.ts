import { createFileRoute } from "@tanstack/react-router";
import { NBA_TEAM_LOGOS } from "@/lib/nba/team-logos";

export const Route = createFileRoute("/api/nba/logo/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { id } = params;
        const logoUrl = NBA_TEAM_LOGOS[id.toLowerCase()];

        if (!logoUrl) {
          return new Response("Logo not found", {
            status: 404,
            headers: { "Cache-Control": "no-cache" },
          });
        }

        try {
          const response = await fetch(logoUrl);

          if (!response.ok) {
            return new Response("Failed to fetch logo", {
              status: 502,
              headers: { "Cache-Control": "no-cache" },
            });
          }

          const contentType = response.headers.get("content-type") || "image/png";
          const imageData = await response.arrayBuffer();

          return new Response(imageData, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=604800", // 7 days
            },
          });
        } catch (error) {
          console.error("Logo fetch error:", error);
          return new Response("Failed to fetch logo", {
            status: 502,
            headers: { "Cache-Control": "no-cache" },
          });
        }
      },
    },
  },
});

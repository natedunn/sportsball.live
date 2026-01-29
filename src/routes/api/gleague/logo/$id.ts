import { createFileRoute } from "@tanstack/react-router";
import { GLEAGUE_TEAM_LOGOS } from "@/lib/gleague/team-logos";
import { createLogoHandler } from "@/lib/logo-cache";

const handleLogo = createLogoHandler(GLEAGUE_TEAM_LOGOS, "gleague");

export const Route = createFileRoute("/api/gleague/logo/$id")({
	server: {
		handlers: {
			GET: async ({ params }) => handleLogo(params),
		},
	},
});

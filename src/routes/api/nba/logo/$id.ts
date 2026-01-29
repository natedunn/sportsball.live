import { createFileRoute } from "@tanstack/react-router";
import { NBA_TEAM_LOGOS } from "@/lib/nba/team-logos";
import { createLogoHandler } from "@/lib/logo-cache";

const handleLogo = createLogoHandler(NBA_TEAM_LOGOS, "nba");

export const Route = createFileRoute("/api/nba/logo/$id")({
	server: {
		handlers: {
			GET: async ({ params }) => handleLogo(params),
		},
	},
});

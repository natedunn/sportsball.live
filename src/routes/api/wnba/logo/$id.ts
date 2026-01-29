import { createFileRoute } from "@tanstack/react-router";
import { WNBA_TEAM_LOGOS } from "@/lib/wnba/team-logos";
import { createLogoHandler } from "@/lib/logo-cache";

const handleLogo = createLogoHandler(WNBA_TEAM_LOGOS, "wnba");

export const Route = createFileRoute("/api/wnba/logo/$id")({
	server: {
		handlers: {
			GET: async ({ params }) => handleLogo(params),
		},
	},
});

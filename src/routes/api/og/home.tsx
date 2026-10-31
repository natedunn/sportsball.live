import { createFileRoute } from "@tanstack/react-router";
import { HomeCard } from "@/lib/og/og-cards";
import { ogImageResponse } from "@/lib/og/og-response.server";

const ONE_WEEK = 7 * 24 * 60 * 60;

export const Route = createFileRoute("/api/og/home")({
	server: {
		handlers: {
			GET: async ({ request }) =>
				ogImageResponse(request, ONE_WEEK, async () => <HomeCard />),
		},
	},
});

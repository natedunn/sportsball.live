import { createFileRoute } from "@tanstack/react-router";

import { handler } from "@/lib/auth/auth-server-utils";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => {
				return handler(request);
			},
			POST: ({ request }) => {
				return handler(request);
			},
		},
	},
});

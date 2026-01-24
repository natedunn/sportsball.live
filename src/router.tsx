import { ConvexQueryClient } from "@convex-dev/react-query";
import { notifyManager, QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexReactClient } from "convex/react";

import { DefaultCatchBoundary } from "./components/_default-catch-boundary";
import { NotFound } from "./components/_not-found";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	if (typeof document !== "undefined") {
		notifyManager.setScheduler(window.requestAnimationFrame);
	}

	const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!;
	if (!CONVEX_URL) {
		throw new Error("missing VITE_CONVEX_URL envar");
	}
	const convex = new ConvexReactClient(CONVEX_URL, {
		expectAuth: true,
	});

	const convexQueryClient = new ConvexQueryClient(convex);

	const queryClient: QueryClient = new QueryClient({
		defaultOptions: {
			queries: {
				queryKeyHashFn: convexQueryClient.hashFn(),
				queryFn: convexQueryClient.queryFn(),
				gcTime: 5000,
			},
		},
	});
	convexQueryClient.connect(queryClient);

	const router = createTanStackRouter({
		routeTree,
		defaultPreload: "intent",
		defaultErrorComponent: DefaultCatchBoundary,
		defaultNotFoundComponent: () => <NotFound isContainer />,
		defaultStaleTime: 60_000, // 30 seconds
		defaultPreloadStaleTime: 30_000, // 30 seconds
		defaultPreloadGcTime: 5 * 60_000, // 5 minutes
		scrollRestoration: true,
		notFoundMode: "fuzzy",
		context: { queryClient, convexQueryClient },
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}

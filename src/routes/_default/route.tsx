import { Header } from "@/components/layout/header";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { api } from "~api";

export const Route = createFileRoute("/_default")({
	component: RouteComponent,
	loader: async ({ context }) => {
		// Only prefetch auth data if user is authenticated
		// This prevents blocking for unauthenticated users
		if (context.isAuthenticated) {
			await context.queryClient.ensureQueryData(
				convexQuery(api.auth.getCurrentUser, {}),
			);
		}
	},
});

function RouteComponent() {
	return (
		<>
			<Header />
			<div>
				<Outlet />
			</div>
		</>
	);
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";

export const Route = createFileRoute("/_default/admin/")({
	component: AdminPage,
	beforeLoad: async ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/auth/sign-in" });
		}

		const isAdmin = await context.queryClient.ensureQueryData(
			convexQuery(api.admin.checkIsAdmin),
		);

		if (!isAdmin) {
			throw redirect({ to: "/" });
		}
	},
});

function AdminPage() {
	return (
		<div className="container py-8">
			<div className="mx-auto max-w-4xl space-y-8">
				<div>
					<h1 className="text-3xl font-bold">Admin Dashboard</h1>
					<p className="mt-1 text-muted-foreground">
						Manage app settings and data.
					</p>
				</div>

				<div className="rounded-lg border border-dashed border-border p-8 text-center">
					<p className="text-muted-foreground">
						No admin tools configured yet.
					</p>
				</div>
			</div>
		</div>
	);
}

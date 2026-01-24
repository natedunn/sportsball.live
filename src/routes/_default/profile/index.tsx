import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { api } from "~api";

export const Route = createFileRoute("/_default/profile/")({
	component: ProfilePage,
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/auth/sign-in" });
		}
	},
});

function ProfilePage() {
	const { data: user } = useSuspenseQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	)

	const handleSignOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: async () => {
					// for now, recommend reloading on sign out as Convex client
					// expectAuth only works on initial load
					location.reload();
				},
			},
		})
	}

	if (!user) {
		return null;
	}

	return (
		<div className="container py-8">
			<div className="mx-auto max-w-md space-y-6">
				<div className="flex items-center gap-4">
					{user.image && (
						<img
							src={user.image}
							alt={user.name || "Profile"}
							className="h-16 w-16 rounded-full"
						/>
					)}
					<div>
						<h1 className="text-2xl font-bold">{user.name || "User"}</h1>
						<p className="text-muted-foreground">{user.email}</p>
					</div>
				</div>

				<div className="space-y-2">
					<Link to="/profile/settings">
						<Button variant="outline" className="w-full">
							Edit Profile
						</Button>
					</Link>
					<Button onClick={handleSignOut} variant="outline" className="w-full">
						Sign Out
					</Button>
				</div>
			</div>
		</div>
	)
}

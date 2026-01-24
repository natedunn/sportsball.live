import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";

export const Route = createFileRoute("/_default/profile/settings")({
	component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
	const { data: user } = useSuspenseQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	)

	const navigate = useNavigate();
	const [name, setName] = useState(user?.name || "");
	const [saving, setSaving] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		try {
			await authClient.updateUser({ name });
			navigate({ to: "/profile" });
		} catch (error) {
			console.error("Failed to update profile:", error);
		} finally {
			setSaving(false);
		}
	}

	if (!user) {
		return null;
	}

	return (
		<div className="container py-8">
			<div className="mx-auto max-w-md space-y-6">
				<h1 className="text-2xl font-bold">Profile Settings</h1>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="name" className="text-sm font-medium">
							Display Name
						</label>
						<input
							id="name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full rounded-md border bg-background px-3 py-2 text-sm"
							placeholder="Your name"
						/>
					</div>

					<div className="space-y-2">
						<label className="text-sm font-medium">Email</label>
						<input
							type="email"
							value={user.email}
							disabled
							className="w-full rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground"
						/>
						<p className="text-xs text-muted-foreground">
							Email cannot be changed
						</p>
					</div>

					<div className="flex gap-2">
						<Button type="submit" disabled={saving}>
							{saving ? "Saving..." : "Save Changes"}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => navigate({ to: "/profile" })}
						>
							Cancel
						</Button>
					</div>
				</form>
			</div>
		</div>
	)
}

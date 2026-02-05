import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~api";
import { Sun, Moon, Monitor, Check, Palette, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { FavoritesSection } from "@/components/favorites/favorites-section";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_default/settings")({
	component: SettingsPage,
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/auth/sign-in" });
		}
	},
});

type Theme = "light" | "dark" | "system";

function ThemeOption({
	theme,
	currentTheme,
	onSelect,
	icon: Icon,
	label,
	description,
}: {
	theme: Theme;
	currentTheme: Theme;
	onSelect: (theme: Theme) => void;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	description: string;
}) {
	const isSelected = currentTheme === theme;

	return (
		<button
			type="button"
			onClick={() => onSelect(theme)}
			className={cn(
				"relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all",
				"focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				isSelected
					? "border-primary bg-primary/5 hover:border-primary"
					: "border-border bg-card hover:border-muted-foreground",
			)}
			aria-pressed={isSelected}
		>
			{isSelected && (
				<div className="absolute right-2 top-2">
					<Check className="size-4 text-primary" />
				</div>
			)}
			<div
				className={cn(
					"flex size-12 items-center justify-center rounded-full",
					isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
				)}
			>
				<Icon className="size-6" />
			</div>
			<div className="text-center">
				<div className="font-medium">{label}</div>
				<div className="text-xs text-muted-foreground">{description}</div>
			</div>
		</button>
	);
}

function ThemeSelector() {
	const [theme, setTheme] = useState<Theme>("system");

	useEffect(() => {
		const stored = localStorage.getItem("theme") as Theme | null;
		if (stored === "light" || stored === "dark") {
			setTheme(stored);
		} else {
			setTheme("system");
		}
	}, []);

	const handleThemeChange = (newTheme: Theme) => {
		setTheme(newTheme);

		if (newTheme === "system") {
			localStorage.removeItem("theme");
			const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			document.documentElement.classList.toggle("dark", prefersDark);
		} else {
			localStorage.setItem("theme", newTheme);
			document.documentElement.classList.toggle("dark", newTheme === "dark");
		}
	};

	return (
		<section aria-labelledby="theme-heading">
			<div className="mb-4">
				<SectionTitle id="theme-heading" icon={Palette}>Appearance</SectionTitle>
			</div>
			<Card classNames={{ inner: "p-4 flex-col" }}>
				<p className="mb-4 text-sm text-muted-foreground">
					Choose how Sportsball looks to you. Select a single theme, or sync with your
					system settings.
				</p>
				<div className="grid grid-cols-3 gap-3">
					<ThemeOption
						theme="light"
						currentTheme={theme}
						onSelect={handleThemeChange}
						icon={Sun}
						label="Light"
						description="Always light"
					/>
					<ThemeOption
						theme="dark"
						currentTheme={theme}
						onSelect={handleThemeChange}
						icon={Moon}
						label="Dark"
						description="Always dark"
					/>
					<ThemeOption
						theme="system"
						currentTheme={theme}
						onSelect={handleThemeChange}
						icon={Monitor}
						label="System"
						description="Sync with OS"
					/>
				</div>
			</Card>
		</section>
	);
}

function ProfileForm() {
	const { data: user } = useSuspenseQuery(convexQuery(api.auth.getCurrentUser, {}));
	const [name, setName] = useState(user?.name || "");
	const [username, setUsername] = useState((user as any)?.username || "");
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

	// Reset fields when user changes
	useEffect(() => {
		if (user?.name) setName(user.name);
		if ((user as any)?.username) setUsername((user as any).username);
	}, [user]);

	// Check username availability with debounce
	useEffect(() => {
		const currentUsername = (user as any)?.username || "";
		if (!username.trim() || username === currentUsername) {
			setUsernameStatus("idle");
			return;
		}

		// Basic validation
		if (username.length < 3) {
			setUsernameStatus("idle");
			return;
		}

		setUsernameStatus("checking");
		const timer = setTimeout(async () => {
			try {
				const { data } = await authClient.isUsernameAvailable({ username });
				setUsernameStatus(data?.available ? "available" : "taken");
			} catch {
				setUsernameStatus("idle");
			}
		}, 500);

		return () => clearTimeout(timer);
	}, [username, user]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		const nameChanged = name.trim() !== (user?.name || "");
		const usernameChanged = username.trim() !== ((user as any)?.username || "");

		if (!nameChanged && !usernameChanged) return;
		if (usernameChanged && usernameStatus === "taken") {
			setError("Username is already taken");
			return;
		}

		setSaving(true);
		setSaved(false);
		try {
			const updates: { name?: string; username?: string } = {};
			if (nameChanged) updates.name = name.trim();
			if (usernameChanged && username.trim()) updates.username = username.trim().toLowerCase();

			await authClient.updateUser(updates);
			setSaved(true);
			setUsernameStatus("idle");
			setTimeout(() => setSaved(false), 2000);
		} catch (err: any) {
			console.error("Failed to update profile:", err);
			setError(err?.message || "Failed to update profile");
		} finally {
			setSaving(false);
		}
	};

	const nameChanged = name.trim() !== (user?.name || "");
	const usernameChanged = username.trim() !== ((user as any)?.username || "");
	const hasChanges = nameChanged || usernameChanged;
	const canSave = hasChanges && usernameStatus !== "taken" && usernameStatus !== "checking";

	return (
		<section aria-labelledby="profile-heading">
			<div className="mb-4">
				<SectionTitle id="profile-heading" icon={User}>Profile</SectionTitle>
			</div>
			<Card classNames={{ inner: "p-4 flex-col" }}>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="username" className="text-sm font-medium">
							Username
						</label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
							<input
								id="username"
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
								className={cn(
									"w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
									usernameStatus === "taken" && "border-destructive",
									usernameStatus === "available" && "border-green-500",
								)}
								placeholder="username"
								minLength={3}
								maxLength={30}
							/>
						</div>
						<p className="text-xs text-muted-foreground">
							{usernameStatus === "checking" && "Checking availability..."}
							{usernameStatus === "available" && (
								<span className="text-green-600 dark:text-green-400">Username is available</span>
							)}
							{usernameStatus === "taken" && (
								<span className="text-destructive">Username is already taken</span>
							)}
							{usernameStatus === "idle" && "3-30 characters, letters, numbers, and underscores only"}
						</p>
					</div>

					<div className="space-y-2">
						<label htmlFor="name" className="text-sm font-medium">
							Display Name
						</label>
						<input
							id="name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="Your name"
						/>
					</div>

					<div className="space-y-2">
						<label htmlFor="email" className="text-sm font-medium">
							Email
						</label>
						<input
							id="email"
							type="email"
							value={user?.email || ""}
							disabled
							className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
						/>
						<p className="text-xs text-muted-foreground">
							Email is managed by your sign-in provider
						</p>
					</div>

					{error && (
						<p className="text-sm text-destructive">{error}</p>
					)}

					<div className="flex items-center gap-3">
						<Button type="submit" disabled={saving || !canSave} size="sm">
							{saving ? "Saving..." : saved ? "Saved!" : "Save changes"}
						</Button>
						{saved && (
							<span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
								<Check className="size-4" />
								Profile updated
							</span>
						)}
					</div>
				</form>
			</Card>
		</section>
	);
}

function SettingsPage() {
	const syncUserToLocal = useConvexMutation(api.auth.syncCurrentUserToLocal);
	const hasSynced = useRef(false);

	// Sync user data to local table on first load (for users created before triggers)
	useEffect(() => {
		if (!hasSynced.current) {
			hasSynced.current = true;
			syncUserToLocal({});
		}
	}, []);

	return (
		<div className="container py-8">
			<div className="mx-auto max-w-2xl">
				<div className="mb-8">
					<h1 className="text-2xl font-bold">Settings</h1>
					<p className="text-muted-foreground">
						Manage your account preferences and personalization
					</p>
				</div>

				<div className="space-y-8">
					<ThemeSelector />
					<FavoritesSection />
					<ProfileForm />
				</div>
			</div>
		</div>
	);
}

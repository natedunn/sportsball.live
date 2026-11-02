import { Link } from "@tanstack/react-router";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";
import {
	Menu,
	MenuTrigger,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuLabel,
} from "@/components/ui/menu";
import { useAuthActions } from "@convex-dev/auth/react";

interface UserMenuProps {
	user: {
		name?: string | null;
		email: string;
		image?: string | null;
		username?: string | null;
		displayUsername?: string | null;
	};
}

export function UserMenu({ user }: UserMenuProps) {
	const { signOut } = useAuthActions();

	const handleSignOut = async () => {
		await signOut();
		location.reload();
	};

	return (
		<Menu>
			<MenuTrigger
				className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label="User menu"
			>
				{/* Phones get an icon; the username is too wide next to the league toggle */}
				<User className="size-4 sm:hidden" aria-hidden="true" />
				<span className="hidden max-w-30 truncate text-sm sm:inline">
					{user.username
						? `@${user.displayUsername || user.username}`
						: "Account"}
				</span>
				<ChevronDown
					className="size-4 text-muted-foreground"
					aria-hidden="true"
				/>
			</MenuTrigger>

			<MenuContent align="end">
				<MenuLabel>
					<div className="flex flex-col">
						<span className="font-medium text-foreground">
							{user.name || "User"}
						</span>
						{user.username && (
							<span className="text-xs font-normal">
								@{user.displayUsername || user.username}
							</span>
						)}
					</div>
				</MenuLabel>
				<MenuSeparator />
				{user.username && (
					<Link to="/profile/$username" params={{ username: user.username }}>
						<MenuItem>
							<User className="size-4" aria-hidden="true" />
							Profile
						</MenuItem>
					</Link>
				)}
				<Link to="/settings">
					<MenuItem>
						<Settings className="size-4" aria-hidden="true" />
						Settings
					</MenuItem>
				</Link>
				<MenuSeparator />
				<MenuItem
					onSelect={handleSignOut}
					className="text-destructive focus:text-destructive"
				>
					<LogOut className="size-4" aria-hidden="true" />
					Sign out
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}

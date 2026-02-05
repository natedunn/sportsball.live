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
import { authClient } from "@/lib/auth/auth-client";

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
	const handleSignOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: async () => {
					location.reload();
				},
			},
		});
	};

	return (
		<Menu>
			<MenuTrigger
				className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label="User menu"
			>
				{user.image ? (
					<img
						src={user.image}
						alt=""
						className="size-7 rounded-full"
						aria-hidden="true"
					/>
				) : (
					<div className="flex size-7 items-center justify-center rounded-full bg-muted">
						<User className="size-4 text-muted-foreground" />
					</div>
				)}
				<span className="hidden max-w-[100px] truncate text-sm sm:inline">
					{user.name || "Account"}
				</span>
				<ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
			</MenuTrigger>

			<MenuContent align="end">
				<MenuLabel>
					<div className="flex flex-col">
						<span className="font-medium text-foreground">{user.name || "User"}</span>
						{user.username && (
							<span className="text-xs font-normal">@{user.displayUsername || user.username}</span>
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
				<MenuItem onSelect={handleSignOut} className="text-destructive focus:text-destructive">
					<LogOut className="size-4" aria-hidden="true" />
					Sign out
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}

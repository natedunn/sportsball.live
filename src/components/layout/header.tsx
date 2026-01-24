import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "./theme-toggle";
import { useSuspenseQuery } from "@tanstack/react-query";
import { api } from "~api";
import { convexQuery } from "@convex-dev/react-query";

export function Header() {
	const { data: user } = useSuspenseQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	);
	return (
		<nav className="border-b border-border bg-background py-2">
			<div className="container flex items-center justify-between">
				<Link
					to="/"
					className="group inline-flex justify-center gap-2 px-2 py-2"
				>
					<span className="py-0.5 text-lg leading-none">◍</span>
					<span className="group-hover:underline group-focus:underline">
						Sportsball
					</span>
				</Link>
				<div className="flex items-center gap-3">
					<Link
						to="/nba"
						className="inline-flex px-2 py-2 hover:underline focus:underline"
					>
						NBA
					</Link>
					<Link
						to="/nfl"
						className="pointer-events-none inline-flex px-2 py-2 text-muted-foreground"
					>
						NFL (Coming soon)
					</Link>
					<div className="text-muted-foreground/50">|</div>
					<ThemeToggle />
					<div className="text-muted-foreground/50">|</div>
					{user ? (
						<Link
							to="/profile"
							className="inline-flex items-center gap-2 px-2 py-2 hover:underline focus:underline"
						>
							{user?.image && (
								<img src={user.image} alt="" className="h-6 w-6 rounded-full" />
							)}
							<span className="hidden sm:inline">{user.name || "Profile"}</span>
						</Link>
					) : (
						<Link
							to="/auth/sign-in"
							className="inline-flex px-2 py-2 hover:underline focus:underline"
						>
							Sign In
						</Link>
					)}
				</div>
			</div>
		</nav>
	);
}

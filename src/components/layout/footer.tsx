import { Link } from "@tanstack/react-router";

export function Footer() {
	const currentYear = new Date().getFullYear();

	return (
		<footer className="border-t border-border bg-background py-6">
			<div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
				<div className="text-sm text-muted-foreground">
					Sportsball™ © {currentYear}
				</div>
				<div className="flex items-center gap-4">
					<Link
						to="/about"
						className="text-sm text-muted-foreground hover:underline"
					>
						About
					</Link>
				</div>
			</div>
		</footer>
	);
}

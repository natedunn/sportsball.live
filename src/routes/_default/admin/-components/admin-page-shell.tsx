import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AdminPage = "bootstrap" | "schedules";

const navItems: Array<{
	page: AdminPage;
	to: "/admin" | "/admin/schedules";
	label: string;
}> = [
	{ page: "bootstrap", to: "/admin", label: "Bootstrap" },
	{ page: "schedules", to: "/admin/schedules", label: "Season Schedules" },
];

export function AdminPageShell({
	activePage,
	title,
	description,
	children,
}: {
	activePage: AdminPage;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<div className="container py-8">
			<div className="mx-auto max-w-5xl space-y-8">
				<header className="space-y-5">
					<div>
						<h1 className="text-3xl font-bold">{title}</h1>
						<p className="mt-1 text-muted-foreground">{description}</p>
					</div>

					<nav className="flex flex-wrap gap-2 border-b border-border pb-3">
						{navItems.map((item) => (
							<Link
								key={item.page}
								to={item.to}
								className={cn(
									"inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors",
									item.page === activePage
										? "bg-secondary text-secondary-foreground"
										: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
								)}
							>
								{item.label}
							</Link>
						))}
					</nav>
				</header>

				{children}
			</div>
		</div>
	);
}

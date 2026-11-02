import { Link, useRouterState } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { api } from "~api";
import { convexQuery } from "@convex-dev/react-query";
import { cn } from "@/lib/utils";
import type { League } from "@/lib/shared/league";
import {
	LEAGUES,
	LEAGUE_SECTIONS,
	getActiveSection,
	getLeagueFromPathname,
	switchLeagueHref,
} from "@/lib/shared/league-nav";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserMenu } from "./user-menu";

function LeagueSwitcher({
	pathname,
	activeLeague,
}: {
	pathname: string;
	activeLeague: League | null;
}) {
	return (
		// Same tabs as the team pages, rounded. Off league pages no tab matches,
		// so nothing is highlighted.
		<Tabs value={activeLeague ?? "none"} size="sm">
			<TabsList
				responsive={false}
				className="rounded-full"
				indicatorClassName="rounded-full"
			>
				{LEAGUES.map(({ league, label }) => (
					<TabsTrigger
						key={league}
						value={league}
						className="rounded-full max-sm:px-2"
						render={
							<Link
								to={
									league === activeLeague
										? `/${league}`
										: switchLeagueHref(pathname, league)
								}
							/>
						}
					>
						{label}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}

function LeagueSectionNav({
	league,
	pathname,
}: {
	league: League;
	pathname: string;
}) {
	const activeSection = getActiveSection(pathname);

	return (
		<div className="container">
			<ul className="-mb-px flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
				{LEAGUE_SECTIONS[league].map((section) => {
					const isActive = activeSection?.path === section.path;
					return (
						<li key={section.path} className="shrink-0">
							<Link
								to={`/${league}${section.path}` as string}
								activeOptions={{ exact: true, includeSearch: false }}
								className={cn(
									"inline-flex border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									isActive
										? "border-foreground text-foreground"
										: "border-transparent text-muted-foreground hover:text-foreground",
								)}
							>
								{section.label}
							</Link>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

export function Header() {
	const { data: user } = useSuspenseQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const league = getLeagueFromPathname(pathname);

	return (
		<nav className="relative z-50 border-b border-border bg-background backdrop-blur-xl">
			<div className="container flex items-center justify-between gap-1 py-2 sm:gap-2">
				<Link
					to="/"
					className="group inline-flex shrink-0 items-center justify-center gap-2 px-1 py-2 sm:px-2"
				>
					<span className="py-0.5 text-lg leading-none">🏀</span>
					<span className="hidden group-hover:underline group-focus:underline sm:inline">
						Sportsball
					</span>
					<span className="hidden rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400 md:inline">
						BETA
					</span>
				</Link>

				<div className="sm:absolute sm:left-1/2 sm:-translate-x-1/2">
					<LeagueSwitcher pathname={pathname} activeLeague={league} />
				</div>

				<div className="flex shrink-0 items-center">
					{user ? (
						<UserMenu user={user} />
					) : (
						<Link
							to="/auth/sign-in"
							className="inline-flex whitespace-nowrap rounded-md px-2 py-2 text-sm sm:px-3 font-medium transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							Sign In
						</Link>
					)}
				</div>
			</div>

			{league && <LeagueSectionNav league={league} pathname={pathname} />}
		</nav>
	);
}

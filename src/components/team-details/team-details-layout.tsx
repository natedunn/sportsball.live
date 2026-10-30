import { createContext, useContext, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import {
	ArrowLeft,
	LayoutDashboard,
	Users,
	Calendar,
	BarChart3,
	TrendingUp,
	Star,
} from "lucide-react";
import { AnimationProvider } from "./animation-context";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TeamHeader } from "./team-header";
import { useFavorites } from "@/lib/use-favorites";
import { leagueLabels, type League } from "@/lib/teams";
import { leagueRoutes, leagueTeamRoutes } from "@/lib/league-routes";
import { tabRoute } from "@/lib/route-tabs";
import type {
	TeamOverview,
	RosterPlayer,
	ScheduleGame,
	TeamStats,
	TeamLeader,
	InjuredPlayer,
} from "@/lib/types/team";
import type { TeamGameData } from "./stats/trend-chart";

/** Team page tabs, each its own child route. The first is the index route. */
export const TEAM_TABS = ["overview", "roster", "games", "stats", "trends"] as const;
export type TeamTab = (typeof TEAM_TABS)[number];

const TAB_ITEMS: Array<{ tab: TeamTab; label: string; icon: typeof Users }> = [
	{ tab: "overview", label: "Overview", icon: LayoutDashboard },
	{ tab: "roster", label: "Roster", icon: Users },
	{ tab: "games", label: "Games", icon: Calendar },
	{ tab: "stats", label: "Stats", icon: BarChart3 },
	{ tab: "trends", label: "Trends", icon: TrendingUp },
];

export function teamTabRoute(league: League, tab: TeamTab) {
	return tabRoute(leagueTeamRoutes[league], TEAM_TABS, tab);
}

export interface TeamDetailsData {
	overview: TeamOverview;
	roster: RosterPlayer[];
	schedule: ScheduleGame[];
	stats: TeamStats | undefined;
	leaders: TeamLeader[];
	injuries: InjuredPlayer[];
	gameLog: TeamGameData[];
	league: League;
	teamSlug: string;
}

const TeamDetailsContext = createContext<TeamDetailsData | null>(null);

/** Team data for the tab pages, provided by the team layout route */
export function useTeamDetails() {
	const data = useContext(TeamDetailsContext);
	if (!data) {
		throw new Error("useTeamDetails must be used inside TeamDetailsLayout");
	}
	return data;
}

interface TeamDetailsLayoutProps extends TeamDetailsData {
	activeTab: TeamTab;
	children: ReactNode;
}

export function TeamDetailsLayout({
	activeTab,
	children,
	...data
}: TeamDetailsLayoutProps) {
	const { overview, league, teamSlug } = data;

	// Favorites
	const { isFavorited, toggleFavorite, isLoading: favoritesLoading } = useFavorites();
	const favorited = isFavorited(league, overview.id);
	const { data: currentUser } = useQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	);
	const isAuthenticated = !!currentUser;

	return (
		<TeamDetailsContext.Provider value={data}>
			<AnimationProvider activeTab={activeTab}>
				<div className="flex flex-col pb-16 lg:pb-24">
					{/* Header with team info */}
					<TeamHeader overview={overview} league={league} />

					<div className="relative bg-background">
						{/* Navigation row with full-width border */}
						<div className="border-b border-border">
							<div className="container">
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
									{/* Back link */}
									<Link
										to={leagueRoutes[league]}
										className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors sm:w-30"
									>
										<ArrowLeft className="h-4 w-4" />
										<span>Back to {leagueLabels[league]}</span>
									</Link>

									{/* Tabs: each links to its own page */}
									<Tabs value={activeTab} className="w-full sm:w-auto">
										<TabsList className="w-full sm:w-auto">
											{TAB_ITEMS.map(({ tab, label, icon: Icon }) => (
												<TabsTrigger
													key={tab}
													value={tab}
													className="flex-1 sm:flex-initial"
													render={
														<Link
															to={teamTabRoute(league, tab)}
															params={{ teamId: teamSlug }}
															activeOptions={{ exact: true, includeSearch: false }}
														/>
													}
												>
													<Icon className="h-3.5 w-3.5 mr-1.5" />
													{label}
												</TabsTrigger>
											))}
										</TabsList>
									</Tabs>

									{/* Favorite button */}
									<div className="hidden sm:flex sm:w-30 sm:justify-end">
										{isAuthenticated && !favoritesLoading && teamSlug && (
											<Button
												variant={favorited ? "default" : "outline"}
												size="sm"
												onClick={() => toggleFavorite(league, overview.id, teamSlug)}
												aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
												aria-pressed={favorited}
											>
												<Star
													className={favorited ? "fill-current" : ""}
												/>
												Favorite
											</Button>
										)}
									</div>
								</div>
							</div>
						</div>

						<div className="container py-8">{children}</div>
					</div>
				</div>
			</AnimationProvider>
		</TeamDetailsContext.Provider>
	);
}

export function TeamDetailsPending() {
	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			{/* Skeleton header */}
			<div className="border-b bg-card">
				<div className="container py-10 md:py-14">
					<div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
						{/* Logo skeleton */}
						<div className="flex justify-center md:justify-start">
							<div className="h-24 w-24 md:h-32 md:w-32 rounded-full bg-muted animate-pulse" />
						</div>
						{/* Text skeleton */}
						<div className="flex flex-col items-center md:items-start gap-3">
							<div className="h-4 w-24 bg-muted rounded animate-pulse" />
							<div className="h-10 w-48 bg-muted rounded animate-pulse" />
							<div className="h-6 w-32 bg-muted rounded animate-pulse" />
						</div>
					</div>
				</div>
			</div>
			{/* Content skeleton */}
			<div className="container">
				<div className="flex justify-center">
					<p className="text-muted-foreground">Loading team details...</p>
				</div>
			</div>
		</div>
	);
}

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TeamHeader } from "./team-header";
import { OverviewTab } from "./overview/overview-tab";
import { RosterTab } from "./roster/roster-tab";
import { GamesTab } from "./games/games-tab";
import { StatsTab } from "./stats/stats-tab";
import { TrendsCard } from "./stats/trends-card";
import { useFavorites } from "@/lib/use-favorites";
import { leagueLabels, type League } from "@/lib/teams";
import { leagueRoutes } from "@/lib/league-routes";
import type {
	TeamOverview,
	RosterPlayer,
	ScheduleGame,
	TeamStats,
	TeamLeader,
	InjuredPlayer,
} from "@/lib/types/team";
import type { TeamGameData } from "./stats/trend-chart";

interface TeamDetailsLayoutProps {
	overview: TeamOverview;
	providerRoster: RosterPlayer[];
	schedule: ScheduleGame[];
	providerStats: TeamStats | undefined;
	leaders: TeamLeader[];
	injuries: InjuredPlayer[];
	gameLog: TeamGameData[];
	league: League;
	teamSlug: string;
	activeTab: string;
	onTabChange: (tab: string) => void;
}

export function TeamDetailsLayout({
	overview,
	providerRoster,
	schedule,
	providerStats,
	leaders,
	injuries,
	gameLog,
	league,
	teamSlug,
	activeTab,
	onTabChange,
}: TeamDetailsLayoutProps) {
	// Data comes pre-computed from the route (no merging needed)
	const roster = providerRoster;
	const stats = providerStats;

	// Favorites
	const { isFavorited, toggleFavorite, isLoading: favoritesLoading } = useFavorites();
	const favorited = isFavorited(league, overview.id);
	const { data: currentUser } = useQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	);
	const isAuthenticated = !!currentUser;

	// Separate past and upcoming/active games
	const pastGames = schedule
		.filter((g) => g.state === "post")
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	const upcomingGames = schedule
		.filter((g) => g.state === "pre" || g.state === "in")
		.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	return (
		<AnimationProvider activeTab={activeTab}>
			<div className="flex flex-col pb-16 lg:pb-24">
				{/* Header with team info */}
				<TeamHeader overview={overview} league={league} />

				{/* Tabbed Content */}
				<div className="relative bg-background">
					<Tabs
						value={activeTab}
						onValueChange={onTabChange}
						className="w-full"
					>
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

									{/* Tabs */}
									<TabsList className="w-full sm:w-auto">
										<TabsTrigger
											value="overview"
											className="flex-1 sm:flex-initial"
										>
											<LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
											Overview
										</TabsTrigger>
										<TabsTrigger
											value="roster"
											className="flex-1 sm:flex-initial"
										>
											<Users className="h-3.5 w-3.5 mr-1.5" />
											Roster
										</TabsTrigger>
										<TabsTrigger
											value="games"
											className="flex-1 sm:flex-initial"
										>
											<Calendar className="h-3.5 w-3.5 mr-1.5" />
											Games
										</TabsTrigger>
										<TabsTrigger
											value="stats"
											className="flex-1 sm:flex-initial"
										>
											<BarChart3 className="h-3.5 w-3.5 mr-1.5" />
											Stats
										</TabsTrigger>
										<TabsTrigger
											value="trends"
											className="flex-1 sm:flex-initial"
										>
											<TrendingUp className="h-3.5 w-3.5 mr-1.5" />
											Trends
										</TabsTrigger>
									</TabsList>

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

						<div className="container py-8">
							<TabsContent value="overview" className="mt-0">
								<OverviewTab
									overview={overview}
									stats={stats}
									leaders={leaders}
									injuries={injuries}
									recentGames={pastGames.slice(0, 3)}
									upcomingGames={upcomingGames.slice(0, 3)}
									league={league}
									teamSlug={teamSlug}
									onTabChange={onTabChange}
								/>
							</TabsContent>

							<TabsContent value="roster" className="mt-0">
								<RosterTab roster={roster} league={league} />
							</TabsContent>

							<TabsContent value="games" className="mt-0">
								<GamesTab
									games={schedule}
									teamId={overview.id}
									league={league}
								/>
							</TabsContent>

							<TabsContent value="stats" className="mt-0">
								<StatsTab stats={stats} />
							</TabsContent>

							<TabsContent value="trends" className="mt-0">
								{gameLog.length >= 2 ? (
									<TrendsCard gameData={gameLog} />
								) : (
									<div className="flex flex-col items-center justify-center py-16 text-center">
										<h3 className="text-lg font-semibold mb-1">
											Trends Unavailable
										</h3>
										<p className="text-sm text-muted-foreground max-w-sm">
											Need at least 2 games of data to show trends.
										</p>
									</div>
								)}
							</TabsContent>
						</div>
					</Tabs>
				</div>
			</div>
		</AnimationProvider>
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

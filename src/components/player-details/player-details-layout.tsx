import { Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	LayoutDashboard,
	SplitSquareVertical,
	ListOrdered,
	GitCompareArrows,
} from "lucide-react";
import { AnimationProvider } from "@/components/team-details/animation-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { leaguePlayersRoutes } from "@/lib/league-routes";
import { leagueLabels } from "@/lib/teams";
import type { League } from "@/lib/shared/league";
import { PlayerHeader } from "./player-header";
import { OverviewTab } from "./overview-tab";
import { SplitsTab } from "./splits-tab";
import { Last10Tab } from "./last10-tab";
import { ComparisonTab } from "./comparison-tab";
import type { PlayerProfileData } from "@/lib/players/mock-data";

interface PlayerDetailsLayoutProps {
	player: PlayerProfileData;
	teammates: PlayerProfileData[];
	allPlayers: PlayerProfileData[];
	league: League;
	activeTab: string;
	onTabChange: (tab: string) => void;
	compareId: string;
	onCompareChange: (playerId: string) => void;
	isLoadingCompare: boolean;
	comparedPlayer: PlayerProfileData | undefined;
	onCompareTeammate: (teammateId: string) => void;
}

export function PlayerDetailsLayout({
	player,
	teammates,
	allPlayers,
	league,
	activeTab,
	onTabChange,
	compareId,
	onCompareChange,
	isLoadingCompare,
	comparedPlayer,
	onCompareTeammate,
}: PlayerDetailsLayoutProps) {
	return (
		<AnimationProvider activeTab={activeTab}>
			<div className="flex flex-col pb-16 lg:pb-24">
				<PlayerHeader player={player} />

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
										to={leaguePlayersRoutes[league]}
										className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors sm:w-30"
									>
										<ArrowLeft className="h-4 w-4" />
										<span>Back to {leagueLabels[league]} players</span>
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
											value="splits"
											className="flex-1 sm:flex-initial"
										>
											<SplitSquareVertical className="h-3.5 w-3.5 mr-1.5" />
											Splits
										</TabsTrigger>
										<TabsTrigger
											value="last10"
											className="flex-1 sm:flex-initial"
										>
											<ListOrdered className="h-3.5 w-3.5 mr-1.5" />
											Last 10
										</TabsTrigger>
										<TabsTrigger
											value="comparison"
											className="flex-1 sm:flex-initial"
										>
											<GitCompareArrows className="h-3.5 w-3.5 mr-1.5" />
											Comparison
										</TabsTrigger>
									</TabsList>

									{/* Empty spacer for alignment */}
									<div className="hidden sm:flex sm:w-30" />
								</div>
							</div>
						</div>

						<div className="container py-8">
							<TabsContent value="overview" className="mt-0">
								<OverviewTab
									player={player}
									teammates={teammates}
									league={league}
									onCompareTeammate={onCompareTeammate}
								/>
							</TabsContent>

							<TabsContent value="splits" className="mt-0">
								<SplitsTab splits={player.splits} />
							</TabsContent>

							<TabsContent value="last10" className="mt-0">
								<Last10Tab games={player.lastTen} />
							</TabsContent>

							<TabsContent value="comparison" className="mt-0">
								<ComparisonTab
									player={player}
									allPlayers={allPlayers}
									compareId={compareId}
									onCompareChange={onCompareChange}
									isLoading={isLoadingCompare}
									comparedPlayer={comparedPlayer}
								/>
							</TabsContent>
						</div>
					</Tabs>
				</div>
			</div>
		</AnimationProvider>
	);
}

export function PlayerDetailsPending() {
	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			{/* Skeleton header */}
			<div className="border-b bg-card">
				<div className="container py-6 md:py-8">
					<div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
						{/* Avatar skeleton */}
						<div className="flex justify-center md:justify-start">
							<div className="size-16 md:size-20 rounded-full bg-muted animate-pulse" />
						</div>
						{/* Text skeleton */}
						<div className="flex flex-col items-center md:items-start gap-3">
							<div className="h-3 w-20 bg-muted rounded animate-pulse" />
							<div className="h-8 w-40 bg-muted rounded animate-pulse" />
							<div className="h-5 w-32 bg-muted rounded animate-pulse" />
						</div>
					</div>
				</div>
			</div>
			{/* Content skeleton */}
			<div className="container">
				<div className="flex justify-center">
					<p className="text-muted-foreground">Loading player details...</p>
				</div>
			</div>
		</div>
	);
}

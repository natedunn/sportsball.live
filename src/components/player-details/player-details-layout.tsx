import { createContext, useContext, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	LayoutDashboard,
	SplitSquareVertical,
	ListOrdered,
	GitCompareArrows,
} from "lucide-react";
import { AnimationProvider } from "@/components/team-details/animation-context";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { leaguePlayerRoutes, leaguePlayersRoutes } from "@/lib/league-routes";
import { tabRoute } from "@/lib/route-tabs";
import { leagueLabels } from "@/lib/teams";
import type { League } from "@/lib/shared/league";
import { PlayerHeader } from "./player-header";
import type { PlayerProfileData } from "@/lib/players/mock-data";

/** Player page tabs, each its own child route. The first is the index route. */
export const PLAYER_TABS = ["overview", "splits", "last-10", "compare"] as const;
export type PlayerTab = (typeof PLAYER_TABS)[number];

const TAB_ITEMS: Array<{
	tab: PlayerTab;
	label: string;
	icon: typeof LayoutDashboard;
}> = [
	{ tab: "overview", label: "Overview", icon: LayoutDashboard },
	{ tab: "splits", label: "Splits", icon: SplitSquareVertical },
	{ tab: "last-10", label: "Last 10", icon: ListOrdered },
	{ tab: "compare", label: "Comparison", icon: GitCompareArrows },
];

export function playerTabRoute(league: League, tab: PlayerTab) {
	return tabRoute(leaguePlayerRoutes[league], PLAYER_TABS, tab);
}

export interface PlayerDetailsData {
	player: PlayerProfileData;
	teammates: PlayerProfileData[];
	allPlayers: PlayerProfileData[];
	league: League;
}

const PlayerDetailsContext = createContext<PlayerDetailsData | null>(null);

/** Player data for the tab pages, provided by the player layout route */
export function usePlayerDetails() {
	const data = useContext(PlayerDetailsContext);
	if (!data) {
		throw new Error("usePlayerDetails must be used inside PlayerDetailsLayout");
	}
	return data;
}

interface PlayerDetailsLayoutProps extends PlayerDetailsData {
	activeTab: PlayerTab;
	children: ReactNode;
}

export function PlayerDetailsLayout({
	activeTab,
	children,
	...data
}: PlayerDetailsLayoutProps) {
	const { player, league } = data;

	return (
		<PlayerDetailsContext.Provider value={data}>
			<AnimationProvider activeTab={activeTab}>
				<div className="flex flex-col pb-16 lg:pb-24">
					<PlayerHeader player={player} />

					<div className="relative bg-background">
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
															to={playerTabRoute(league, tab)}
															params={{ id: player.id }}
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

									{/* Empty spacer for alignment */}
									<div className="hidden sm:flex sm:w-30" />
								</div>
							</div>
						</div>

						<div className="container py-8">{children}</div>
					</div>
				</div>
			</AnimationProvider>
		</PlayerDetailsContext.Provider>
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

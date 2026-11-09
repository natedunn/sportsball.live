import { createContext, useContext, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AnimationProvider } from "@/components/team-details/animation-context";
import { cn } from "@/lib/utils";
import { leaguePlayerRoutes } from "@/lib/league-routes";
import { tabRoute } from "@/lib/route-tabs";
import type { League } from "@/lib/shared/league";
import { PlayerHeader } from "./player-header";
import type { PlayerProfileData } from "@/lib/players/mock-data";
import type { PlayerStatus } from "@/lib/players/player-status";

/** Player page tabs, each its own child route. The first is the index route. */
export const PLAYER_TABS = ["overview", "stats", "games", "compare"] as const;
export type PlayerTab = (typeof PLAYER_TABS)[number];

const TAB_ITEMS: Array<{ tab: PlayerTab; label: string }> = [
	{ tab: "overview", label: "Overview" },
	{ tab: "stats", label: "Stats" },
	{ tab: "games", label: "Games" },
	{ tab: "compare", label: "Comparison" },
];

export function playerTabRoute(league: League, tab: PlayerTab) {
	return tabRoute(leaguePlayerRoutes[league], PLAYER_TABS, tab);
}

/** The full game log, a page under the games tab */
export function playerGameLogRoute(league: League) {
	return `${playerTabRoute(league, "games")}/log`;
}

export interface PlayerDetailsData {
	player: PlayerProfileData;
	teammates: PlayerProfileData[];
	/** Null when the injury report can't say */
	status: PlayerStatus | null;
	league: League;
	season: string;
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
	const { player, league, status } = data;

	return (
		<PlayerDetailsContext.Provider value={data}>
			<AnimationProvider activeTab={activeTab}>
				<div className="flex flex-col pb-16 lg:pb-24">
					<PlayerHeader player={player} league={league} status={status} />

					<div className="relative bg-background">
						{/* Tab row, styled like the league section nav */}
						<nav aria-label="Player sections" className="border-b border-border">
							<div className="container">
								<ul className="-mb-px flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
									{TAB_ITEMS.map(({ tab, label }) => {
										const isActive = tab === activeTab;
										return (
											<li key={tab} className="shrink-0">
												<Link
													to={playerTabRoute(league, tab)}
													params={{ id: player.id }}
													activeOptions={{ exact: true, includeSearch: false }}
													aria-current={isActive ? "page" : undefined}
													className={cn(
														"inline-flex border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
														isActive
															? "border-foreground text-foreground"
															: "border-transparent text-muted-foreground hover:text-foreground",
													)}
												>
													{label}
												</Link>
											</li>
										);
									})}
								</ul>
							</div>
						</nav>

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

import { createContext, useContext, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { formatGameDate } from "@/lib/date";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { GameTeamHeader } from "./game-team-header";
import { leagueGameRoutes } from "@/lib/league-routes";
import { tabRoute } from "@/lib/route-tabs";
import type { SeasonSeries } from "@/lib/shared/game-details.types";
import type { League } from "@/lib/shared/league";

/** Game page tabs, each its own child route. The first is the index route. */
export const GAME_TABS = ["box-score", "team-stats", "matchups"] as const;
export type GameTab = (typeof GAME_TABS)[number];

export function gameTabRoute(league: League, tab: GameTab) {
	return tabRoute(leagueGameRoutes[league], GAME_TABS, tab);
}

// Local type that works across all leagues
interface GameDetailsTeam {
	id: string;
	uid: string | undefined;
	name: string | undefined;
	abbreviation: string | undefined;
	score: number;
	logo: string | undefined;
	darkColor: string;
	lightColor: string;
	winner: boolean;
	record: string | undefined;
	stats: any;
	players: any[];
}

export interface GameDetails {
	id: string;
	state: "pre" | "in" | "post";
	statusDetail: string | undefined;
	venue: string | undefined;
	date: string | undefined;
	away: GameDetailsTeam;
	home: GameDetailsTeam;
	allSeries?: SeasonSeries[];
}

const leagueScoresRoutes: Record<League, string> = {
	nba: "/nba/scores",
	wnba: "/wnba/scores",
	gleague: "/gleague/scores",
};

const GameDetailsContext = createContext<{
	game: GameDetails;
	league: League;
} | null>(null);

/** Game data for the tab pages, provided by the game layout route */
export function useGameDetails() {
	const data = useContext(GameDetailsContext);
	if (!data) {
		throw new Error("useGameDetails must be used inside GameDetailsLayout");
	}
	return data;
}

interface GameDetailsLayoutProps {
	game: GameDetails;
	league: League;
	fromDate: string | undefined;
	activeTab: GameTab;
	children: ReactNode;
}

export function GameDetailsLayout({
	game,
	league,
	fromDate,
	activeTab,
	children,
}: GameDetailsLayoutProps) {
	const hasMatchups = !!game.allSeries && game.allSeries.length > 0;
	// Keep the scores date when moving between tabs, for the back link
	const search = fromDate ? { fromDate } : undefined;
	const tabLink = (tab: GameTab) => (
		<Link
			to={gameTabRoute(league, tab)}
			params={{ gameId: game.id }}
			search={search}
			activeOptions={{ exact: true, includeSearch: false }}
		/>
	);

	return (
		<GameDetailsContext.Provider value={{ game, league }}>
			<div className="flex flex-col pb-12 lg:pb-20">
				{/* Header with score */}
				<div className="pt-6 pb-6 border-b overflow-hidden bg-card">
					<div className="container">
						{/* Teams and Score */}
						<div className="flex items-center justify-center gap-4 md:gap-8">
							<GameTeamHeader team={game.away} league={league} />

							{/* Score */}
							<div className="flex flex-col items-center gap-1 relative z-20">
								{game.state !== "pre" && (
									<div className="flex items-center gap-2 md:gap-4">
										<span
											className={`text-4xl font-bold tabular-nums md:text-5xl ${
												game.state === "post"
													? game.away.winner
														? ""
														: "text-muted-foreground"
													: "text-foreground"
											}`}
										>
											{game.away.score}
										</span>
										<span className="text-2xl text-muted-foreground md:text-3xl">
											—
										</span>
										<span
											className={`text-4xl font-bold tabular-nums md:text-5xl ${
												game.state === "post"
													? game.home.winner
														? ""
														: "text-muted-foreground"
													: "text-foreground"
											}`}
										>
											{game.home.score}
										</span>
									</div>
								)}
								{game.state === "post" && game.date ? (
									<Tooltip content={formatGameDate(new Date(game.date))}>
										<span className="text-muted-foreground cursor-default border-b border-dashed border-muted-foreground/50">
											{game.statusDetail}
										</span>
									</Tooltip>
								) : (
									<span className="text-sm text-muted-foreground">
										{game.statusDetail}
									</span>
								)}
								{game.venue && (
									<span className="text-xs text-muted-foreground">
										{game.venue}
									</span>
								)}
							</div>

							<GameTeamHeader team={game.home} league={league} />
						</div>
					</div>
				</div>

				{/* Tabbed Content */}
				<div className="relative bg-background">
					<div className="container py-8">
						<div className="flex items-center justify-between mb-8">
							<Link
								to={leagueScoresRoutes[league]}
								search={fromDate ? { date: fromDate } : undefined}
								className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
							>
								<ArrowLeft className="h-4 w-4" />
								Back to scores
							</Link>
							{/* Tabs: each links to its own page */}
							<Tabs value={activeTab}>
								<TabsList>
									<TabsTrigger value="box-score" render={tabLink("box-score")}>
										Box Score
									</TabsTrigger>
									<TabsTrigger value="team-stats" render={tabLink("team-stats")}>
										Team Stats
									</TabsTrigger>
									{hasMatchups && (
										<TabsTrigger value="matchups" render={tabLink("matchups")}>
											Matchups
										</TabsTrigger>
									)}
								</TabsList>
							</Tabs>
							<div className="w-[108px]" />
						</div>

						{children}
					</div>
				</div>
			</div>
		</GameDetailsContext.Provider>
	);
}

export function GameDetailsPending() {
	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<div className="bg-linear-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
				<div className="flex flex-col items-center justify-center gap-2">
					<p className="text-muted-foreground">Loading game details...</p>
				</div>
			</div>
		</div>
	);
}

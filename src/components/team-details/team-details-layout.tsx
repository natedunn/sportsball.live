import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TeamHeader } from "./team-header";
import { OverviewTab } from "./overview/overview-tab";
import { RosterTab } from "./roster/roster-tab";
import { GamesTab } from "./games/games-tab";
import { StatsTab } from "./stats/stats-tab";
import type {
  TeamOverview,
  RosterPlayer,
  ScheduleGame,
  TeamStats,
  TeamLeader,
  InjuredPlayer,
} from "@/lib/types/team";
import type { TeamGameData } from "./stats/trend-chart";

type League = "nba" | "wnba" | "gleague";

const leagueRoutes: Record<League, string> = {
  nba: "/nba",
  wnba: "/wnba",
  gleague: "/gleague",
};

const leagueLabels: Record<League, string> = {
  nba: "NBA",
  wnba: "WNBA",
  gleague: "G League",
};

interface TeamDetailsLayoutProps {
  overview: TeamOverview;
  roster: RosterPlayer[];
  schedule: ScheduleGame[];
  stats: TeamStats | undefined;
  recentGames?: TeamGameData[];
  leaders: TeamLeader[];
  injuries: InjuredPlayer[];
  league: League;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TeamDetailsLayout({
  overview,
  roster,
  schedule,
  stats,
  recentGames,
  leaders,
  injuries,
  league,
  activeTab,
  onTabChange,
}: TeamDetailsLayoutProps) {
  // Separate past/current and future games
  // Include in-progress games ("in") with past games since they're current activity
  const pastGames = schedule
    .filter((g) => g.state === "post" || g.state === "in")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const upcomingGames = schedule
    .filter((g) => g.state === "pre")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="flex flex-col pb-16 lg:pb-24">
      {/* Header with team info */}
      <TeamHeader overview={overview} />

      {/* Tabbed Content */}
      <div className="relative bg-background">
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
          {/* Navigation row with full-width border */}
          <div className="border-b border-border">
            <div className="container">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
                {/* Back link */}
                <Link
                  to={leagueRoutes[league]}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors sm:w-[120px]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to {leagueLabels[league]}</span>
                </Link>

                {/* Tabs */}
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="overview" className="flex-1 sm:flex-initial">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="roster" className="flex-1 sm:flex-initial">
                    Roster
                  </TabsTrigger>
                  <TabsTrigger value="games" className="flex-1 sm:flex-initial">
                    Games
                  </TabsTrigger>
                  <TabsTrigger value="stats" className="flex-1 sm:flex-initial">
                    Stats
                  </TabsTrigger>
                </TabsList>

                {/* Spacer for desktop alignment */}
                <div className="hidden sm:block w-[120px]" />
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
              <StatsTab stats={stats} recentGames={recentGames} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
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

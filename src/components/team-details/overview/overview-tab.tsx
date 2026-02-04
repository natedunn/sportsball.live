import { Calendar, Zap, Shield, TrendingUp, TrendingDown, Target } from "lucide-react";
import { StatCard } from "../stat-card";
import { fmt, fmtPlusMinus } from "../format-utils";
import { TopPerformers } from "./top-performers";
import { InjuryReport } from "./injury-report";
import { GamesTable } from "./games-table";
import type {
  TeamOverview,
  TeamStats,
  TeamLeader,
  InjuredPlayer,
  ScheduleGame,
} from "@/lib/types/team";

type League = "nba" | "wnba" | "gleague";

interface OverviewTabProps {
  overview: TeamOverview;
  stats: TeamStats | undefined;
  leaders: TeamLeader[];
  injuries: InjuredPlayer[];
  recentGames: ScheduleGame[];
  upcomingGames: ScheduleGame[];
  league: League;
  onTabChange?: (tab: string) => void;
}

export function OverviewTab({
  overview,
  stats,
  leaders,
  injuries,
  recentGames,
  upcomingGames,
  league,
  onTabChange,
}: OverviewTabProps) {
  // Merge stats from the stats query if available
  const quickStats = stats?.scoring ?? overview.stats;
  const ranks = stats?.ranks;

  return (
    <div className="space-y-8">
      {/* Quick Stats - Full width */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Team Stats</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="PPG" value={fmt(quickStats.ppg)} icon={Zap} description="Points Per Game" rank={ranks?.rankPpg} />
          <StatCard label="OPP PPG" value={fmt(quickStats.oppPpg)} icon={Shield} description="Opponent Points Per Game" rank={ranks?.rankOppPpg} />
          <StatCard label="OFF RTG" value={fmt(quickStats.ortg)} icon={TrendingUp} description="Offensive Rating" rank={ranks?.rankOrtg} />
          <StatCard label="DEF RTG" value={fmt(quickStats.drtg)} icon={TrendingDown} description="Defensive Rating" rank={ranks?.rankDrtg} />
          <StatCard label="NET RTG" value={fmtPlusMinus(quickStats.netRtg)} icon={Target} description="Net Rating" rank={ranks?.rankNetRtg} />
        </div>
      </section>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Games - 2 columns */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Games
            </h2>
            {onTabChange && (
              <button
                onClick={() => onTabChange("games")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
              </button>
            )}
          </div>
          <GamesTable
            recentGames={recentGames}
            upcomingGames={upcomingGames}
            league={league}
          />
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Top Performers */}
          {leaders.length > 0 && <TopPerformers leaders={leaders} />}

          {/* Injury Report */}
          <InjuryReport injuries={injuries} />
        </div>
      </div>
    </div>
  );
}

import { Calendar, Zap, Shield, TrendingUp, TrendingDown, Target, BarChart3 } from "lucide-react";
import { StatCard } from "../stat-card";
import { SectionHeader } from "../section-header";
import { fmt, fmtPlusMinus } from "../format-utils";
import { TopPerformers } from "./top-performers";
import { InjuryReport } from "./injury-report";
import { GamesTable } from "./games-table";
import { NewsSection } from "./news-section";
import type {
  TeamOverview,
  TeamStats,
  TeamLeader,
  InjuredPlayer,
  ScheduleGame,
} from "@/lib/types/team";
import type { League } from "@/lib/shared/league";

interface OverviewTabProps {
  overview: TeamOverview;
  stats: TeamStats | undefined;
  leaders: TeamLeader[];
  injuries: InjuredPlayer[];
  recentGames: ScheduleGame[];
  upcomingGames: ScheduleGame[];
  league: League;
  teamSlug: string;
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
  teamSlug,
  onTabChange,
}: OverviewTabProps) {
  // Merge stats from the stats query if available
  const quickStats = stats?.scoring ?? overview.stats;
  const ranks = stats?.ranks;

  return (
    <div className="space-y-8">
      {/* Quick Stats - Full width */}
      <section>
        <SectionHeader icon={BarChart3} title="Team Stats" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="PPG" value={fmt(quickStats.ppg)} rawValue={quickStats.ppg} formatValue={fmt} icon={Zap} description="Points Per Game" rank={ranks?.rankPpg} delay={0} />
          <StatCard label="OPP PPG" value={fmt(quickStats.oppPpg)} rawValue={quickStats.oppPpg} formatValue={fmt} icon={Shield} description="Opponent Points Per Game" rank={ranks?.rankOppPpg} delay={50} />
          <StatCard label="OFF RTG" value={fmt(quickStats.ortg)} rawValue={quickStats.ortg} formatValue={fmt} icon={TrendingUp} description="Offensive Rating" rank={ranks?.rankOrtg} delay={100} />
          <StatCard label="DEF RTG" value={fmt(quickStats.drtg)} rawValue={quickStats.drtg} formatValue={fmt} icon={TrendingDown} description="Defensive Rating" rank={ranks?.rankDrtg} delay={150} />
          <StatCard label="NET RTG" value={fmtPlusMinus(quickStats.netRtg)} rawValue={quickStats.netRtg} formatValue={fmtPlusMinus} icon={Target} description="Net Rating" rank={ranks?.rankNetRtg} delay={200} />
        </div>
      </section>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Games + News - 2 columns */}
        <div className="lg:col-span-2 space-y-8">
          <div>
            <SectionHeader
              icon={Calendar}
              title="Games"
              action={onTabChange && (
                <button
                  onClick={() => onTabChange("games")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  View all
                </button>
              )}
            />
            <GamesTable
              recentGames={recentGames}
              upcomingGames={upcomingGames}
              league={league}
            />
          </div>

          {/* News */}
          <NewsSection league={league} teamSlug={teamSlug} />
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

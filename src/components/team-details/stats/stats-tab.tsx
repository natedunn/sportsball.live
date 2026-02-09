import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TeamStats } from "@/lib/types/team";
import { StatCard } from "../stat-card";
import { StatsTable } from "./stats-table";
import { fmt, fmtPct, fmtPlusMinus } from "../format-utils";
import {
  Zap,
  Target,
  TrendingUp,
  TrendingDown,
  Gauge,
  Crosshair,
  Circle,
  Grab,
  ArrowUpFromLine,
  ArrowDownToLine,
  Users,
  AlertTriangle,
  Repeat,
  Shield,
  Hand,
  Percent,
  Sparkles,
  LayoutGrid,
  Table,
} from "lucide-react";

interface StatsTabProps {
  stats: TeamStats | undefined;
}

export function StatsTab({ stats }: StatsTabProps) {
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg
            className="h-8 w-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-1">Stats Unavailable</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Team statistics are not available at this time. Check back later.
        </p>
      </div>
    );
  }

  // Calculate margin
  const margin = stats.scoring.ppg - stats.scoring.oppPpg;

  // Net Rating
  const netRtg = stats.scoring.netRtg ?? (stats.scoring.ortg - stats.scoring.drtg);

  return (
    <div className="space-y-8">
      {/* View toggle */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">View</label>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "cards" | "table")}>
          <TabsList responsive={false}>
            <TabsTrigger value="cards">
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
              Cards
            </TabsTrigger>
            <TabsTrigger value="table">
              <Table className="h-3.5 w-3.5 mr-1.5" />
              Table
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === "table" ? (
        <StatsTable stats={stats} />
      ) : (
        <>
          {/* Team Stats Section */}
          <section id="team-stats">
            {/* All Stats Cards - each category in its own row */}
            <div className="space-y-10">
              {/* Scoring */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Scoring</h3>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <StatCard label="PPG" value={fmt(stats.scoring.ppg)} rawValue={stats.scoring.ppg} formatValue={fmt} icon={Zap} description="Points Per Game" rank={stats.ranks?.rankPpg} delay={0} />
                  <StatCard label="OPP PPG" value={fmt(stats.scoring.oppPpg)} rawValue={stats.scoring.oppPpg} formatValue={fmt} icon={Shield} description="Opponent Points Per Game" rank={stats.ranks?.rankOppPpg} delay={50} />
                  <StatCard label="Margin" value={fmtPlusMinus(margin)} rawValue={margin} formatValue={fmtPlusMinus} icon={Target} description="Average Point Differential" rank={stats.ranks?.rankMargin} delay={100} />
                  <StatCard label="Pace" value={fmt(stats.scoring.pace)} rawValue={stats.scoring.pace} formatValue={fmt} icon={Gauge} description="Possessions Per 48 Minutes" rank={stats.ranks?.rankPace} delay={150} />
                  <StatCard label="OFF RTG" value={fmt(stats.scoring.ortg)} rawValue={stats.scoring.ortg} formatValue={fmt} icon={TrendingUp} description="Points Per 100 Possessions" rank={stats.ranks?.rankOrtg} delay={200} />
                  <StatCard label="DEF RTG" value={fmt(stats.scoring.drtg)} rawValue={stats.scoring.drtg} formatValue={fmt} icon={TrendingDown} description="Opponent Pts Per 100 Poss" rank={stats.ranks?.rankDrtg} delay={250} />
                  <StatCard label="NET RTG" value={fmtPlusMinus(netRtg)} rawValue={netRtg} formatValue={fmtPlusMinus} icon={Target} description="OFF RTG - DEF RTG" rank={stats.ranks?.rankNetRtg} delay={300} />
                </div>
              </div>

              {/* Shooting */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Crosshair className="h-4 w-4 text-muted-foreground shrink-0" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Shooting</h3>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <StatCard label="FG%" value={fmtPct(stats.shooting.fgPct)} rawValue={stats.shooting.fgPct} formatValue={fmtPct} icon={Target} description="Field Goal Percentage" rank={stats.ranks?.rankFgPct} detail={`${fmt(stats.shooting.fgMade)} / ${fmt(stats.shooting.fgAttempted)} per game`} delay={0} />
                  <StatCard label="3P%" value={fmtPct(stats.shooting.threePct)} rawValue={stats.shooting.threePct} formatValue={fmtPct} icon={Crosshair} description="Three-Point Percentage" rank={stats.ranks?.rankThreePct} detail={`${fmt(stats.shooting.threeMade)} / ${fmt(stats.shooting.threeAttempted)} per game`} delay={50} />
                  <StatCard label="FT%" value={fmtPct(stats.shooting.ftPct)} rawValue={stats.shooting.ftPct} formatValue={fmtPct} icon={Circle} description="Free Throw Percentage" rank={stats.ranks?.rankFtPct} detail={`${fmt(stats.shooting.ftMade)} / ${fmt(stats.shooting.ftAttempted)} per game`} delay={100} />
                  <StatCard label="eFG%" value={fmtPct(stats.shooting.efgPct)} rawValue={stats.shooting.efgPct} formatValue={fmtPct} icon={Percent} description="Effective Field Goal %" rank={stats.ranks?.rankEfgPct} delay={150} />
                  <StatCard label="TS%" value={fmtPct(stats.shooting.tsPct)} rawValue={stats.shooting.tsPct} formatValue={fmtPct} icon={Sparkles} description="True Shooting %" rank={stats.ranks?.rankTsPct} delay={200} />
                </div>
              </div>

              {/* Rebounding */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Grab className="h-4 w-4 text-muted-foreground shrink-0" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Rebounding</h3>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <StatCard label="RPG" value={fmt(stats.rebounding.rpg)} rawValue={stats.rebounding.rpg} formatValue={fmt} icon={Grab} description="Rebounds Per Game" rank={stats.ranks?.rankRpg} delay={0} />
                  <StatCard label="ORPG" value={fmt(stats.rebounding.orpg)} rawValue={stats.rebounding.orpg} formatValue={fmt} icon={ArrowUpFromLine} description="Offensive Rebounds" rank={stats.ranks?.rankOrpg} delay={50} />
                  <StatCard label="DRPG" value={fmt(stats.rebounding.drpg)} rawValue={stats.rebounding.drpg} formatValue={fmt} icon={ArrowDownToLine} description="Defensive Rebounds" rank={stats.ranks?.rankDrpg} delay={100} />
                  {stats.rebounding.orebPct > 0 && (
                    <StatCard label="OREB%" value={fmtPct(stats.rebounding.orebPct)} rawValue={stats.rebounding.orebPct} formatValue={fmtPct} description="Offensive Rebound Percentage" delay={150} />
                  )}
                </div>
              </div>

              {/* Playmaking */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Playmaking</h3>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <StatCard label="APG" value={fmt(stats.playmaking.apg)} rawValue={stats.playmaking.apg} formatValue={fmt} icon={Users} description="Assists Per Game" rank={stats.ranks?.rankApg} delay={0} />
                  <StatCard label="TOV" value={fmt(stats.playmaking.tovPg)} rawValue={stats.playmaking.tovPg} formatValue={fmt} icon={AlertTriangle} description="Turnovers Per Game" rank={stats.ranks?.rankTov} delay={50} />
                  <StatCard label="AST/TO" value={fmt(stats.playmaking.astToRatio, 2)} rawValue={stats.playmaking.astToRatio} formatValue={(v) => fmt(v, 2)} icon={Repeat} description="Assist to Turnover Ratio" rank={stats.ranks?.rankAstToRatio} delay={100} />
                </div>
              </div>

              {/* Defense */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Defense</h3>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <StatCard label="SPG" value={fmt(stats.defense.spg)} rawValue={stats.defense.spg} formatValue={fmt} icon={Hand} description="Steals Per Game" rank={stats.ranks?.rankSpg} delay={0} />
                  <StatCard label="BPG" value={fmt(stats.defense.bpg)} rawValue={stats.defense.bpg} formatValue={fmt} icon={Shield} description="Blocks Per Game" rank={stats.ranks?.rankBpg} delay={50} />
                  {stats.defense.oppFgPct > 0 && (
                    <StatCard label="OPP FG%" value={fmtPct(stats.defense.oppFgPct)} rawValue={stats.defense.oppFgPct} formatValue={fmtPct} description="Opponent Field Goal %" delay={100} />
                  )}
                  {stats.defense.oppThreePct > 0 && (
                    <StatCard label="OPP 3P%" value={fmtPct(stats.defense.oppThreePct)} rawValue={stats.defense.oppThreePct} formatValue={fmtPct} description="Opponent Three-Point %" delay={150} />
                  )}
                </div>
              </div>
            </div>
          </section>

        </>
      )}
    </div>
  );
}


import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { TeamStats } from "@/lib/types/team";
import type { TeamGameData } from "./trend-chart";
import { TrendsCard } from "./trends-card";
import { StatCard } from "../stat-card";
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
} from "lucide-react";

interface StatsTabProps {
  stats: TeamStats | undefined;
  recentGames?: TeamGameData[];
}

export function StatsTab({ stats, recentGames = [] }: StatsTabProps) {
  const hasTrends = recentGames.length >= 2;

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
      {/* Section quick links */}
      <nav className="flex items-center gap-1 text-sm">
        <span className="text-muted-foreground">Jump to:</span>
        <a
          href="#team-stats"
          className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
        >
          Team Stats
        </a>
        <span className="text-muted-foreground/50">·</span>
        <a
          href="#shooting-splits"
          className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
        >
          Shooting
        </a>
        {hasTrends && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <a
              href="#trends"
              className="text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
            >
              Trends
            </a>
          </>
        )}
      </nav>

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
              <StatCard label="PPG" value={fmt(stats.scoring.ppg)} icon={Zap} description="Points Per Game" rank={stats.ranks?.rankPpg} />
              <StatCard label="OPP PPG" value={fmt(stats.scoring.oppPpg)} icon={Shield} description="Opponent Points Per Game" rank={stats.ranks?.rankOppPpg} />
              <StatCard label="Margin" value={fmtPlusMinus(margin)} icon={Target} description="Average Point Differential" rank={stats.ranks?.rankMargin} />
              <StatCard label="Pace" value={fmt(stats.scoring.pace)} icon={Gauge} description="Possessions Per 48 Minutes" rank={stats.ranks?.rankPace} />
              <StatCard label="OFF RTG" value={fmt(stats.scoring.ortg)} icon={TrendingUp} description="Points Per 100 Possessions" rank={stats.ranks?.rankOrtg} />
              <StatCard label="DEF RTG" value={fmt(stats.scoring.drtg)} icon={TrendingDown} description="Opponent Pts Per 100 Poss" rank={stats.ranks?.rankDrtg} />
              <StatCard label="NET RTG" value={fmtPlusMinus(netRtg)} icon={Target} description="OFF RTG - DEF RTG" rank={stats.ranks?.rankNetRtg} />
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
              <StatCard label="FG%" value={fmtPct(stats.shooting.fgPct)} icon={Target} description="Field Goal Percentage" rank={stats.ranks?.rankFgPct} />
              <StatCard label="3P%" value={fmtPct(stats.shooting.threePct)} icon={Crosshair} description="Three-Point Percentage" rank={stats.ranks?.rankThreePct} />
              <StatCard label="FT%" value={fmtPct(stats.shooting.ftPct)} icon={Circle} description="Free Throw Percentage" rank={stats.ranks?.rankFtPct} />
              <StatCard label="eFG%" value={fmtPct(stats.shooting.efgPct)} icon={Percent} description="Effective Field Goal %" rank={stats.ranks?.rankEfgPct} />
              <StatCard label="TS%" value={fmtPct(stats.shooting.tsPct)} icon={Sparkles} description="True Shooting %" rank={stats.ranks?.rankTsPct} />
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
              <StatCard label="RPG" value={fmt(stats.rebounding.rpg)} icon={Grab} description="Rebounds Per Game" rank={stats.ranks?.rankRpg} />
              <StatCard label="ORPG" value={fmt(stats.rebounding.orpg)} icon={ArrowUpFromLine} description="Offensive Rebounds" rank={stats.ranks?.rankOrpg} />
              <StatCard label="DRPG" value={fmt(stats.rebounding.drpg)} icon={ArrowDownToLine} description="Defensive Rebounds" rank={stats.ranks?.rankDrpg} />
              {stats.rebounding.orebPct > 0 && (
                <StatCard label="OREB%" value={fmtPct(stats.rebounding.orebPct)} description="Offensive Rebound Percentage" />
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
              <StatCard label="APG" value={fmt(stats.playmaking.apg)} icon={Users} description="Assists Per Game" rank={stats.ranks?.rankApg} />
              <StatCard label="TOV" value={fmt(stats.playmaking.tovPg)} icon={AlertTriangle} description="Turnovers Per Game" rank={stats.ranks?.rankTov} />
              <StatCard label="AST/TO" value={fmt(stats.playmaking.astToRatio, 2)} icon={Repeat} description="Assist to Turnover Ratio" rank={stats.ranks?.rankAstToRatio} />
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
              <StatCard label="SPG" value={fmt(stats.defense.spg)} icon={Hand} description="Steals Per Game" rank={stats.ranks?.rankSpg} />
              <StatCard label="BPG" value={fmt(stats.defense.bpg)} icon={Shield} description="Blocks Per Game" rank={stats.ranks?.rankBpg} />
              {stats.defense.oppFgPct > 0 && (
                <StatCard label="OPP FG%" value={fmtPct(stats.defense.oppFgPct)} description="Opponent Field Goal %" />
              )}
              {stats.defense.oppThreePct > 0 && (
                <StatCard label="OPP 3P%" value={fmtPct(stats.defense.oppThreePct)} description="Opponent Three-Point %" />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Shooting Splits Section */}
      <section id="shooting-splits">
        <Card classNames={{ inner: "flex-col p-0" }}>
          <div className="px-6 py-4 border-b border-border bg-muted/50">
            <h2 className="text-lg font-semibold">Shooting Splits</h2>
            <p className="text-sm text-muted-foreground">Made / Attempted per game</p>
          </div>
          <div className="p-6 space-y-5">
            <ShootingStatRow
              label="Field Goals"
              made={stats.shooting.fgMade}
              attempted={stats.shooting.fgAttempted}
              percentage={stats.shooting.fgPct}
              color="blue"
            />
            <ShootingStatRow
              label="3-Pointers"
              made={stats.shooting.threeMade}
              attempted={stats.shooting.threeAttempted}
              percentage={stats.shooting.threePct}
              color="green"
            />
            <ShootingStatRow
              label="Free Throws"
              made={stats.shooting.ftMade}
              attempted={stats.shooting.ftAttempted}
              percentage={stats.shooting.ftPct}
              color="purple"
            />
          </div>
        </Card>
      </section>

      {/* Trends Section */}
      {hasTrends && (
        <section id="trends">
          <TrendsCard gameData={recentGames} />
        </section>
      )}
    </div>
  );
}

// Shooting Stat Row with Progress Bar
interface ShootingStatRowProps {
  label: string;
  made: number;
  attempted: number;
  percentage: number;
  color: "blue" | "green" | "purple";
}

function ShootingStatRow({
  label,
  made,
  attempted,
  percentage,
  color,
}: ShootingStatRowProps) {
  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    purple: "bg-purple-500",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {fmt(made)} / {fmt(attempted)}
          </span>
          <span className="text-sm font-bold tabular-nums min-w-[50px] text-right">
            {isNaN(percentage) ? "—" : `${percentage.toFixed(1)}%`}
          </span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", colorClasses[color])}
          style={{
            width: `${Math.min(Math.max(percentage || 0, 0), 100)}%`,
          }}
        />
      </div>
    </div>
  );
}

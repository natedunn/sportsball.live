import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { fmt, fmtPct, fmtPlusMinus, getOrdinalSuffix } from "../format-utils";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { TeamStats } from "@/lib/types/team";

interface StatsTableProps {
  stats: TeamStats;
}

interface StatRow {
  label: string;
  abbr: string;
  value: string;
  rank?: number;
  category: string;
}

type SortDirection = "none" | "asc" | "desc";

function buildAllRows(stats: TeamStats): StatRow[] {
  const margin = stats.scoring.ppg - stats.scoring.oppPpg;
  const netRtg = stats.scoring.netRtg ?? (stats.scoring.ortg - stats.scoring.drtg);

  return [
    { category: "Scoring", label: "Points Per Game", abbr: "PPG", value: fmt(stats.scoring.ppg), rank: stats.ranks?.rankPpg },
    { category: "Scoring", label: "Opponent Points Per Game", abbr: "OPP PPG", value: fmt(stats.scoring.oppPpg), rank: stats.ranks?.rankOppPpg },
    { category: "Scoring", label: "Average Point Differential", abbr: "Margin", value: fmtPlusMinus(margin), rank: stats.ranks?.rankMargin },
    { category: "Scoring", label: "Possessions Per 48 Minutes", abbr: "Pace", value: fmt(stats.scoring.pace), rank: stats.ranks?.rankPace },
    { category: "Scoring", label: "Points Per 100 Possessions", abbr: "OFF RTG", value: fmt(stats.scoring.ortg), rank: stats.ranks?.rankOrtg },
    { category: "Scoring", label: "Opponent Pts Per 100 Poss", abbr: "DEF RTG", value: fmt(stats.scoring.drtg), rank: stats.ranks?.rankDrtg },
    { category: "Scoring", label: "Net Rating", abbr: "NET RTG", value: fmtPlusMinus(netRtg), rank: stats.ranks?.rankNetRtg },
    { category: "Shooting", label: "Field Goal Percentage", abbr: "FG%", value: fmtPct(stats.shooting.fgPct), rank: stats.ranks?.rankFgPct },
    { category: "Shooting", label: "Three-Point Percentage", abbr: "3P%", value: fmtPct(stats.shooting.threePct), rank: stats.ranks?.rankThreePct },
    { category: "Shooting", label: "Free Throw Percentage", abbr: "FT%", value: fmtPct(stats.shooting.ftPct), rank: stats.ranks?.rankFtPct },
    { category: "Shooting", label: "Effective Field Goal %", abbr: "eFG%", value: fmtPct(stats.shooting.efgPct), rank: stats.ranks?.rankEfgPct },
    { category: "Shooting", label: "True Shooting %", abbr: "TS%", value: fmtPct(stats.shooting.tsPct), rank: stats.ranks?.rankTsPct },
    { category: "Rebounding", label: "Rebounds Per Game", abbr: "RPG", value: fmt(stats.rebounding.rpg), rank: stats.ranks?.rankRpg },
    { category: "Rebounding", label: "Offensive Rebounds", abbr: "ORPG", value: fmt(stats.rebounding.orpg), rank: stats.ranks?.rankOrpg },
    { category: "Rebounding", label: "Defensive Rebounds", abbr: "DRPG", value: fmt(stats.rebounding.drpg), rank: stats.ranks?.rankDrpg },
    ...(stats.rebounding.orebPct > 0
      ? [{ category: "Rebounding", label: "Offensive Rebound Percentage", abbr: "OREB%", value: fmtPct(stats.rebounding.orebPct) }]
      : []),
    { category: "Playmaking", label: "Assists Per Game", abbr: "APG", value: fmt(stats.playmaking.apg), rank: stats.ranks?.rankApg },
    { category: "Playmaking", label: "Turnovers Per Game", abbr: "TOV", value: fmt(stats.playmaking.tovPg), rank: stats.ranks?.rankTov },
    { category: "Playmaking", label: "Assist to Turnover Ratio", abbr: "AST/TO", value: fmt(stats.playmaking.astToRatio, 2), rank: stats.ranks?.rankAstToRatio },
    { category: "Defense", label: "Steals Per Game", abbr: "SPG", value: fmt(stats.defense.spg), rank: stats.ranks?.rankSpg },
    { category: "Defense", label: "Blocks Per Game", abbr: "BPG", value: fmt(stats.defense.bpg), rank: stats.ranks?.rankBpg },
    ...(stats.defense.oppFgPct > 0
      ? [{ category: "Defense", label: "Opponent Field Goal %", abbr: "OPP FG%", value: fmtPct(stats.defense.oppFgPct) }]
      : []),
    ...(stats.defense.oppThreePct > 0
      ? [{ category: "Defense", label: "Opponent Three-Point %", abbr: "OPP 3P%", value: fmtPct(stats.defense.oppThreePct) }]
      : []),
  ];
}

function getRankSortValue(rank: number | undefined): number {
  // No rank = sort to bottom
  if (rank === undefined || rank <= 0) return 9999;
  return rank;
}

export function StatsTable({ stats }: StatsTableProps) {
  const [rankSort, setRankSort] = useState<SortDirection>("none");
  const allRows = buildAllRows(stats);

  const isSorted = rankSort !== "none";

  const sortedRows = isSorted
    ? [...allRows].sort((a, b) => {
        const aRank = getRankSortValue(a.rank);
        const bRank = getRankSortValue(b.rank);
        return rankSort === "asc" ? aRank - bRank : bRank - aRank;
      })
    : allRows;


  function cycleSort() {
    setRankSort((prev) => {
      if (prev === "none") return "asc";
      if (prev === "asc") return "desc";
      return "none";
    });
  }

  const SortIcon = rankSort === "asc" ? ArrowUp : rankSort === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <Card classNames={{ inner: "flex-col p-0" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Stat
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Value
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <button
                  type="button"
                  onClick={cycleSort}
                  className={cn(
                    "inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer",
                    isSorted && "text-foreground",
                  )}
                >
                  Rank
                  <SortIcon className="h-3 w-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <StatRowTr key={row.abbr} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StatRowTr({ row }: { row: StatRow }) {
  const isTopTen = row.rank !== undefined && row.rank > 0 && row.rank <= 10;
  return (
    <tr
      className={cn(
        "border-b border-border last:border-b-0 transition-colors",
        isTopTen ? "bg-primary/5" : "hover:bg-muted/30",
      )}
    >
      <td className="px-4 py-2.5">
        <span className="font-medium">{row.label}</span>
        <span className="text-muted-foreground ml-2 text-xs uppercase">
          {row.abbr}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
        {row.value}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {row.rank && row.rank > 0 ? (
          <span className={cn(isTopTen && "text-primary font-medium")}>
            {getOrdinalSuffix(row.rank)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

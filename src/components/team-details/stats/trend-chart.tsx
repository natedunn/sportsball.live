import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  useChartSize,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Weekly snapshot data (from teamStatsHistory)
export interface TeamStatsHistoryPoint {
  weekStartDate: number;
  offensiveRating: number;
  defensiveRating: number;
  netRating: number;
  pointsFor: number;
  pointsAgainst: number;
}

// Game-by-game data (from teamGameLog)
export interface TeamGameData {
  gameDate: string;
  pointsFor: number;
  pointsAgainst: number;
  won: boolean;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
}

type TimeRange = "5g" | "10g" | "4w" | "8w" | "season";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string; isGames: boolean }[] = [
  { value: "5g", label: "Last 5", isGames: true },
  { value: "10g", label: "Last 10", isGames: true },
  { value: "4w", label: "4 Weeks", isGames: false },
  { value: "8w", label: "8 Weeks", isGames: false },
  { value: "season", label: "Season", isGames: false },
];

const chartConfig = {
  offensive: {
    label: "Offensive Rtg",
    color: "hsl(142, 76%, 36%)", // green-600
  },
  defensive: {
    label: "Defensive Rtg",
    color: "hsl(0, 84%, 60%)", // red-500
  },
} satisfies ChartConfig;

interface TrendChartProps {
  weeklyData: TeamStatsHistoryPoint[];
  gameData?: TeamGameData[];
  title?: string;
  subtitle?: string;
}

export function TrendChart({
  weeklyData,
  gameData = [],
  title = "Efficiency Trends",
  subtitle = "Offensive & Defensive Rating",
}: TrendChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartSize = useChartSize(chartRef);
  const [timeRange, setTimeRange] = useState<TimeRange>("season");

  const selectedOption = TIME_RANGE_OPTIONS.find((o) => o.value === timeRange)!;
  const isGameMode = selectedOption.isGames;

  // Calculate rolling stats from game data
  const gameChartData = useMemo(() => {
    if (gameData.length === 0) return [];

    const gamesCount = timeRange === "5g" ? 5 : 10;
    const games = gameData.slice(-gamesCount);

    return games.map((game, idx) => {
      // Calculate rolling averages up to this game
      const gamesUpToHere = games.slice(0, idx + 1);
      const totalPF = gamesUpToHere.reduce((sum, g) => sum + g.pointsFor, 0);
      const totalPA = gamesUpToHere.reduce((sum, g) => sum + g.pointsAgainst, 0);
      const totalFGA = gamesUpToHere.reduce((sum, g) => sum + g.fgAttempted, 0);
      const totalFTA = gamesUpToHere.reduce((sum, g) => sum + g.ftAttempted, 0);
      const totalTO = gamesUpToHere.reduce((sum, g) => sum + g.turnovers, 0);

      // Estimate possessions
      const possessions = totalFGA + 0.4 * totalFTA + totalTO;
      const ortg = possessions > 0 ? (totalPF / possessions) * 100 : 0;
      const drtg = possessions > 0 ? (totalPA / possessions) * 100 : 0;

      // Parse date for display
      const dateStr = game.gameDate;
      const date = new Date(
        parseInt(dateStr.slice(0, 4)),
        parseInt(dateStr.slice(4, 6)) - 1,
        parseInt(dateStr.slice(6, 8))
      );

      return {
        date: date.getTime(),
        dateLabel: format(date, "MMM d"),
        offensive: Math.round(ortg * 10) / 10,
        defensive: Math.round(drtg * 10) / 10,
        result: game.won ? "W" : "L",
        score: `${game.pointsFor}-${game.pointsAgainst}`,
      };
    });
  }, [gameData, timeRange]);

  // Filter weekly data based on time range
  const weeklyChartData = useMemo(() => {
    if (weeklyData.length === 0) return [];

    const sorted = [...weeklyData].sort((a, b) => a.weekStartDate - b.weekStartDate);

    let filtered = sorted;
    if (timeRange === "4w") {
      const cutoff = Date.now() - 4 * 7 * 24 * 60 * 60 * 1000;
      filtered = sorted.filter((d) => d.weekStartDate >= cutoff);
    } else if (timeRange === "8w") {
      const cutoff = Date.now() - 8 * 7 * 24 * 60 * 60 * 1000;
      filtered = sorted.filter((d) => d.weekStartDate >= cutoff);
    }

    return filtered.map((d) => ({
      date: d.weekStartDate,
      dateLabel: format(new Date(d.weekStartDate), "MMM d"),
      offensive: d.offensiveRating,
      defensive: d.defensiveRating,
    }));
  }, [weeklyData, timeRange]);

  // Use appropriate data based on mode
  const chartData = isGameMode ? gameChartData : weeklyChartData;

  // Calculate trend values
  const trendData = useMemo(() => {
    if (chartData.length < 2) return null;

    const first = chartData[0];
    const last = chartData[chartData.length - 1];

    return {
      currentOff: last.offensive,
      currentDef: last.defensive,
      currentNet: Math.round((last.offensive - last.defensive) * 10) / 10,
      trendOff: Math.round((last.offensive - first.offensive) * 10) / 10,
      trendDef: Math.round((last.defensive - first.defensive) * 10) / 10,
      trendNet: Math.round(
        (last.offensive - last.defensive - (first.offensive - first.defensive)) * 10
      ) / 10,
    };
  }, [chartData]);

  // Get trend label
  const trendLabel = useMemo(() => {
    switch (timeRange) {
      case "5g":
        return "over 5 games";
      case "10g":
        return "over 10 games";
      case "4w":
        return "vs 4 weeks ago";
      case "8w":
        return "vs 8 weeks ago";
      case "season":
        return "season trend";
    }
  }, [timeRange]);

  // Check if we have enough data
  const hasGameData = gameData.length >= 2;
  const hasWeeklyData = weeklyData.length >= 2;
  const hasDataForMode = isGameMode ? hasGameData : hasWeeklyData;

  if (!hasDataForMode || chartData.length < 2) {
    return (
      <Card classNames={{ inner: "flex-col p-0" }}>
        <div className="px-6 py-4 border-b border-border bg-muted/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <TimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
            hasGameData={hasGameData}
            hasWeeklyData={hasWeeklyData}
          />
        </div>
        <div className="p-8 text-center text-muted-foreground">
          <p>Not enough data for selected time range.</p>
          <p className="text-sm mt-1">
            {isGameMode
              ? "Need at least 2 games of data."
              : "Try selecting a different time range."}
          </p>
        </div>
      </Card>
    );
  }

  // Calculate Y-axis domain
  const allValues = chartData.flatMap((d) => [d.offensive, d.defensive]);
  const minY = Math.floor(Math.min(...allValues) - 2);
  const maxY = Math.ceil(Math.max(...allValues) + 2);

  return (
    <Card classNames={{ inner: "flex-col p-0" }}>
      <div className="px-6 py-4 border-b border-border bg-muted/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <TimeRangeSelector
          value={timeRange}
          onChange={setTimeRange}
          hasGameData={hasGameData}
          hasWeeklyData={hasWeeklyData}
        />
      </div>

      <div className="p-6">
        {/* Summary Stats */}
        {trendData && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Offensive Rating
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {trendData.currentOff.toFixed(1)}
              </div>
              <div
                className={cn(
                  "text-xs",
                  trendData.trendOff >= 0 ? "text-green-500" : "text-red-500"
                )}
              >
                {trendData.trendOff >= 0 ? "+" : ""}
                {trendData.trendOff.toFixed(1)} {trendLabel}
              </div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Defensive Rating
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {trendData.currentDef.toFixed(1)}
              </div>
              <div
                className={cn(
                  "text-xs",
                  trendData.trendDef <= 0 ? "text-green-500" : "text-red-500"
                )}
              >
                {trendData.trendDef >= 0 ? "+" : ""}
                {trendData.trendDef.toFixed(1)} {trendLabel}
              </div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Net Rating
              </div>
              <div
                className={cn(
                  "text-2xl font-bold",
                  trendData.currentNet >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}
              >
                {trendData.currentNet >= 0 ? "+" : ""}
                {trendData.currentNet.toFixed(1)}
              </div>
              <div
                className={cn(
                  "text-xs",
                  trendData.trendNet >= 0 ? "text-green-500" : "text-red-500"
                )}
              >
                {trendData.trendNet >= 0 ? "+" : ""}
                {trendData.trendNet.toFixed(1)} {trendLabel}
              </div>
            </div>
          </div>
        )}

        {/* Chart */}
        <ChartContainer ref={chartRef} config={chartConfig} className="h-[250px] w-full">
          {chartSize && (
            <AreaChart
              width={chartSize.width}
              height={chartSize.height}
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillOffensive" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-offensive)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-offensive)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient id="fillDefensive" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-defensive)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-defensive)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="dateLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
                interval={chartData.length > 12 ? Math.floor(chartData.length / 6) : 0}
              />
              <YAxis
                domain={[minY, maxY]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
                width={35}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelKey="dateLabel"
                    formatter={(value) => value.toFixed(1)}
                  />
                }
              />
              <Area
                type="linear"
                dataKey="offensive"
                stroke="var(--color-offensive)"
                strokeWidth={2}
                fill="url(#fillOffensive)"
                dot={{ fill: "var(--color-offensive)", strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
              <Area
                type="linear"
                dataKey="defensive"
                stroke="var(--color-defensive)"
                strokeWidth={2}
                fill="url(#fillDefensive)"
                dot={{ fill: "var(--color-defensive)", strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          )}
        </ChartContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: chartConfig.offensive.color }}
            />
            <span className="text-sm text-muted-foreground">
              Offensive Rating <span className="text-xs">(higher = better)</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: chartConfig.defensive.color }}
            />
            <span className="text-sm text-muted-foreground">
              Defensive Rating <span className="text-xs">(lower = better)</span>
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Time Range Selector Component
interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  hasGameData: boolean;
  hasWeeklyData: boolean;
}

function TimeRangeSelector({
  value,
  onChange,
  hasGameData,
  hasWeeklyData,
}: TimeRangeSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TimeRange)}>
      <SelectTrigger className="w-[100px]" />
      <SelectContent>
        {TIME_RANGE_OPTIONS.map((option) => {
          const isDisabled = option.isGames ? !hasGameData : !hasWeeklyData;
          return (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={isDisabled}
            >
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { TrendingUp } from "lucide-react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	XAxis,
	YAxis,
	ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import {
	Select,
	SelectTrigger,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TeamGameData } from "./trend-chart";

// Stat series configuration
interface StatSeries {
	key: string;
	label: string;
	shortLabel?: string;
	color: string;
	higherIsBetter: boolean;
	format?: (value: number) => string;
}

interface DerivedStat {
	label: string;
	calculate: (data: Record<string, number>) => number;
	higherIsBetter: boolean;
	format: (value: number) => string;
}

interface StatPreset {
	title: string;
	subtitle: string;
	series: StatSeries[];
	derivedStat?: DerivedStat;
}

// Preset stat configurations
const STAT_PRESETS: Record<string, StatPreset> = {
	efficiency: {
		title: "Efficiency",
		subtitle: "Offensive & Defensive Rating",
		series: [
			{
				key: "ortg",
				label: "Offensive Rating",
				shortLabel: "ORTG",
				color: "hsl(142, 76%, 36%)",
				higherIsBetter: true,
				format: (v: number) => v.toFixed(1),
			},
			{
				key: "drtg",
				label: "Defensive Rating",
				shortLabel: "DRTG",
				color: "hsl(0, 84%, 60%)",
				higherIsBetter: false,
				format: (v: number) => v.toFixed(1),
			},
		],
		derivedStat: {
			label: "Net Rating",
			calculate: (data: Record<string, number>) => data.ortg - data.drtg,
			higherIsBetter: true,
			format: (v: number) => (v >= 0 ? "+" : "") + v.toFixed(1),
		},
	},
	scoring: {
		title: "Scoring",
		subtitle: "Points For vs Against",
		series: [
			{
				key: "ppg",
				label: "Points Per Game",
				shortLabel: "PPG",
				color: "hsl(142, 76%, 36%)",
				higherIsBetter: true,
				format: (v: number) => v.toFixed(1),
			},
			{
				key: "oppPpg",
				label: "Opponent PPG",
				shortLabel: "OPP",
				color: "hsl(0, 84%, 60%)",
				higherIsBetter: false,
				format: (v: number) => v.toFixed(1),
			},
		],
		derivedStat: {
			label: "Margin",
			calculate: (data: Record<string, number>) => data.ppg - data.oppPpg,
			higherIsBetter: true,
			format: (v: number) => (v >= 0 ? "+" : "") + v.toFixed(1),
		},
	},
	ballSecurity: {
		title: "Ball Security",
		subtitle: "Assists vs Turnovers",
		series: [
			{
				key: "ast",
				label: "Assists",
				shortLabel: "AST",
				color: "hsl(217, 91%, 60%)",
				higherIsBetter: true,
				format: (v: number) => v.toFixed(1),
			},
			{
				key: "tov",
				label: "Turnovers",
				shortLabel: "TOV",
				color: "hsl(25, 95%, 53%)",
				higherIsBetter: false,
				format: (v: number) => v.toFixed(1),
			},
		],
		derivedStat: {
			label: "AST/TOV",
			calculate: (data: Record<string, number>) =>
				data.tov > 0 ? data.ast / data.tov : 0,
			higherIsBetter: true,
			format: (v: number) => v.toFixed(2),
		},
	},
	shooting: {
		title: "Shooting",
		subtitle: "Field Goal % vs 3-Point %",
		series: [
			{
				key: "fgPct",
				label: "Field Goal %",
				shortLabel: "FG%",
				color: "hsl(262, 83%, 58%)",
				higherIsBetter: true,
				format: (v: number) => (v * 100).toFixed(1) + "%",
			},
			{
				key: "threePct",
				label: "3-Point %",
				shortLabel: "3P%",
				color: "hsl(199, 89%, 48%)",
				higherIsBetter: true,
				format: (v: number) => (v * 100).toFixed(1) + "%",
			},
		],
	},
	defense: {
		title: "Defense",
		subtitle: "Steals vs Blocks",
		series: [
			{
				key: "stl",
				label: "Steals",
				shortLabel: "STL",
				color: "hsl(280, 87%, 60%)",
				higherIsBetter: true,
				format: (v: number) => v.toFixed(1),
			},
			{
				key: "blk",
				label: "Blocks",
				shortLabel: "BLK",
				color: "hsl(330, 81%, 60%)",
				higherIsBetter: true,
				format: (v: number) => v.toFixed(1),
			},
		],
		derivedStat: {
			label: "STL+BLK",
			calculate: (data: Record<string, number>) => data.stl + data.blk,
			higherIsBetter: true,
			format: (v: number) => v.toFixed(1),
		},
	},
};

type StatPresetKey = keyof typeof STAT_PRESETS;
type TimeRange = "5g" | "1m" | "3m" | "season";

const PRESET_OPTIONS: { value: StatPresetKey; label: string }[] = [
	{ value: "efficiency", label: "Efficiency" },
	{ value: "scoring", label: "Scoring" },
	{ value: "ballSecurity", label: "Ball Security" },
	{ value: "shooting", label: "Shooting" },
	{ value: "defense", label: "Defense" },
];

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
	{ value: "season", label: "Full Season" },
	{ value: "3m", label: "Last 3 Months" },
	{ value: "1m", label: "Last Month" },
	{ value: "5g", label: "Last 5 Games" },
];

// Chart data point type
interface ChartDataPoint {
	date: number;
	dateLabel: string;
	[key: string]: string | number;
}

// Extract stat values from game data
function extractGameStats(
	games: TeamGameData[],
	seriesKeys: string[],
): Record<string, number>[] {
	return games.map((game) => {
		const stats: Record<string, number> = {
			date: new Date(
				parseInt(game.gameDate.slice(0, 4)),
				parseInt(game.gameDate.slice(4, 6)) - 1,
				parseInt(game.gameDate.slice(6, 8)),
			).getTime(),
		};

		for (const key of seriesKeys) {
			switch (key) {
				case "ortg":
				case "drtg": {
					const poss =
						game.fgAttempted + 0.4 * game.ftAttempted + game.turnovers;
					stats.ortg = poss > 0 ? (game.pointsFor / poss) * 100 : 0;
					stats.drtg = poss > 0 ? (game.pointsAgainst / poss) * 100 : 0;
					break;
				}
				case "ppg":
					stats.ppg = game.pointsFor;
					break;
				case "oppPpg":
					stats.oppPpg = game.pointsAgainst;
					break;
				case "ast":
					stats.ast = game.assists;
					break;
				case "tov":
					stats.tov = game.turnovers;
					break;
				case "fgPct":
					stats.fgPct =
						game.fgAttempted > 0 ? game.fgMade / game.fgAttempted : 0;
					break;
				case "threePct":
					stats.threePct =
						game.threeAttempted > 0 ? game.threeMade / game.threeAttempted : 0;
					break;
				case "stl":
					stats.stl = game.steals;
					break;
				case "blk":
					stats.blk = game.blocks;
					break;
			}
		}

		return stats;
	});
}

// Calculate rolling averages
function calculateRollingAverages(
	gameStats: Record<string, number>[],
	seriesKeys: string[],
): ChartDataPoint[] {
	return gameStats.map((currentGame, idx) => {
		const gamesUpToHere = gameStats.slice(0, idx + 1);
		const result: ChartDataPoint = {
			date: currentGame.date,
			dateLabel: format(new Date(currentGame.date), "MMM d"),
		};

		for (const key of seriesKeys) {
			const sum = gamesUpToHere.reduce((acc, g) => acc + (g[key] || 0), 0);
			result[key] = sum / gamesUpToHere.length;
		}

		return result;
	});
}

interface TrendsCardProps {
	gameData: TeamGameData[];
}

export function TrendsCard({ gameData }: TrendsCardProps) {
	const [selectedPreset, setSelectedPreset] =
		useState<StatPresetKey>("efficiency");
	const [timeRange, setTimeRange] = useState<TimeRange>("season");

	const config = STAT_PRESETS[selectedPreset];
	const seriesKeys = config.series.map((s) => s.key);

	// Build chart config for recharts
	const chartConfig = useMemo(() => {
		const cfg: ChartConfig = {};
		for (const series of config.series) {
			cfg[series.key] = {
				label: series.shortLabel || series.label,
				color: series.color,
			};
		}
		return cfg;
	}, [config.series]);

	// Process game data into chart data
	const chartData = useMemo(() => {
		if (gameData.length === 0) return [];

		let games = gameData;
		if (timeRange === "5g") {
			games = gameData.slice(-5);
		} else if (timeRange === "1m" || timeRange === "3m") {
			const now = new Date();
			const monthsAgo = timeRange === "1m" ? 1 : 3;
			const cutoffDate = new Date(
				now.getFullYear(),
				now.getMonth() - monthsAgo,
				now.getDate(),
			);
			games = gameData.filter((game) => {
				const gameDate = new Date(
					parseInt(game.gameDate.slice(0, 4)),
					parseInt(game.gameDate.slice(4, 6)) - 1,
					parseInt(game.gameDate.slice(6, 8)),
				);
				return gameDate >= cutoffDate;
			});
		}

		const rawStats = extractGameStats(games, seriesKeys);
		return calculateRollingAverages(rawStats, seriesKeys);
	}, [gameData, timeRange, seriesKeys]);

	// Calculate summary stats
	const summaryData = useMemo(() => {
		if (chartData.length < 2) return null;

		const first = chartData[0];
		const last = chartData[chartData.length - 1];

		const result: {
			series: Array<{
				key: string;
				label: string;
				current: number;
				trend: number;
				higherIsBetter: boolean;
				format: (v: number) => string;
				color: string;
			}>;
			derived?: {
				label: string;
				current: number;
				trend: number;
				higherIsBetter: boolean;
				format: (v: number) => string;
			};
		} = { series: [] };

		for (const series of config.series) {
			const current = (last[series.key] as number) || 0;
			const start = (first[series.key] as number) || 0;
			result.series.push({
				key: series.key,
				label: series.shortLabel || series.label,
				current,
				trend: current - start,
				higherIsBetter: series.higherIsBetter,
				format: series.format || ((v) => v.toFixed(1)),
				color: series.color,
			});
		}

		if (config.derivedStat) {
			const lastData: Record<string, number> = {};
			const firstData: Record<string, number> = {};
			for (const key of seriesKeys) {
				lastData[key] = (last[key] as number) || 0;
				firstData[key] = (first[key] as number) || 0;
			}
			const currentDerived = config.derivedStat.calculate(lastData);
			const startDerived = config.derivedStat.calculate(firstData);
			result.derived = {
				label: config.derivedStat.label,
				current: currentDerived,
				trend: currentDerived - startDerived,
				higherIsBetter: config.derivedStat.higherIsBetter,
				format: config.derivedStat.format,
			};
		}

		return result;
	}, [chartData, config, seriesKeys]);

	// Get trend label
	const trendLabel = useMemo(() => {
		switch (timeRange) {
			case "5g":
				return "over 5 games";
			case "1m":
				return "over 1 month";
			case "3m":
				return "over 3 months";
			case "season":
				return "season trend";
		}
	}, [timeRange]);

	const hasEnoughData = gameData.length >= 2;

	if (!hasEnoughData || chartData.length < 2) {
		return (
			<div>
				{/* Header outside card */}
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
					<div className="flex items-center gap-2">
						<TrendingUp className="h-5 w-5 text-muted-foreground" />
						<div>
							<h2 className="text-lg font-semibold">Trends</h2>
							<p className="text-sm text-muted-foreground">{config.subtitle}</p>
						</div>
					</div>
					<div className="flex items-center gap-4">
						<div className="flex flex-col gap-1">
							<label className="text-xs text-muted-foreground">Stat</label>
							<Select
								value={selectedPreset}
								onValueChange={(v) => setSelectedPreset(v as StatPresetKey)}
							>
								<SelectTrigger size="default" className="w-[140px]" />
								<SelectContent>
									{PRESET_OPTIONS.map((option) => (
										<SelectItem
											key={option.value}
											value={option.value}
											size="default"
										>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1">
							<label className="text-xs text-muted-foreground">Range</label>
							<Select
								value={timeRange}
								onValueChange={(v) => setTimeRange(v as TimeRange)}
							>
								<SelectTrigger size="default" className="w-[160px]" />
								<SelectContent>
									{TIME_RANGE_OPTIONS.map((option) => (
										<SelectItem
											key={option.value}
											value={option.value}
											size="default"
										>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>
				<Card classNames={{ inner: "flex-col p-8" }}>
					<div className="text-center text-muted-foreground">
						<p>Not enough data available.</p>
						<p className="text-sm mt-1">Need at least 2 games of data.</p>
					</div>
				</Card>
			</div>
		);
	}

	// Calculate Y-axis domain
	const allValues = chartData.flatMap((d) =>
		seriesKeys.map((k) => d[k] as number).filter((v) => typeof v === "number"),
	);
	const minVal = Math.min(...allValues);
	const maxVal = Math.max(...allValues);
	const padding = (maxVal - minVal) * 0.1 || 1;
	const minY = Math.floor((minVal - padding) * 10) / 10;
	const maxY = Math.ceil((maxVal + padding) * 10) / 10;

	return (
		<div>
			{/* Header outside card */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
				<div className="flex items-center gap-2">
					<TrendingUp className="h-5 w-5 text-muted-foreground" />
					<div>
						<h2 className="text-lg font-semibold">Trends</h2>
						<p className="text-sm text-muted-foreground">{config.subtitle}</p>
					</div>
				</div>
				<div className="flex items-center gap-4">
					<div className="flex flex-col gap-1">
						<label className="text-xs text-muted-foreground">Stat</label>
						<Select
							value={selectedPreset}
							onValueChange={(v) => setSelectedPreset(v as StatPresetKey)}
						>
							<SelectTrigger size="default" className="w-35" />
							<SelectContent>
								{PRESET_OPTIONS.map((option) => (
									<SelectItem
										key={option.value}
										value={option.value}
										size="default"
									>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-1">
						<label className="text-xs text-muted-foreground">Range</label>
						<Select
							value={timeRange}
							onValueChange={(v) => setTimeRange(v as TimeRange)}
						>
							<SelectTrigger size="default" className="w-40" />
							<SelectContent>
								{TIME_RANGE_OPTIONS.map((option) => (
									<SelectItem
										key={option.value}
										value={option.value}
										size="default"
									>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			<Card classNames={{ inner: "flex-col p-0" }}>
				{/* Summary Stats */}
				{summaryData && (
					<div className="border-b border-border">
						<div
							className={cn(
								"grid divide-x divide-border bg-muted/50",
								summaryData.derived ? "grid-cols-3" : "grid-cols-2",
							)}
						>
							{summaryData.series.map((s) => (
								<div key={s.key} className="text-center py-4 px-3">
									<div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
										{s.label}
									</div>
									<div className="text-2xl font-bold tabular-nums">
										{s.format(s.current)}
									</div>
									<div
										className={cn(
											"text-xs",
											(s.higherIsBetter ? s.trend >= 0 : s.trend <= 0)
												? "text-green-500"
												: "text-red-500",
										)}
									>
										{s.trend >= 0 ? "+" : ""}
										{s.format(s.trend)} {trendLabel}
									</div>
								</div>
							))}
							{summaryData.derived && (
								<div className="text-center py-4 px-3">
									<div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
										{summaryData.derived.label}
									</div>
									<div className="text-2xl font-bold tabular-nums">
										{summaryData.derived.format(summaryData.derived.current)}
									</div>
									<div
										className={cn(
											"text-xs",
											(
												summaryData.derived.higherIsBetter
													? summaryData.derived.trend >= 0
													: summaryData.derived.trend <= 0
											)
												? "text-green-500"
												: "text-red-500",
										)}
									>
										{summaryData.derived.format(summaryData.derived.trend)}{" "}
										{trendLabel}
									</div>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Chart */}
				<div className="p-6">
					<ChartContainer config={chartConfig} className="h-[250px] w-full">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart
								data={chartData}
								margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
							>
								<defs>
									{config.series.map((series) => (
										<linearGradient
											key={series.key}
											id={`fill-trends-${series.key}`}
											x1="0"
											y1="0"
											x2="0"
											y2="1"
										>
											<stop
												offset="5%"
												stopColor={series.color}
												stopOpacity={0.3}
											/>
											<stop
												offset="95%"
												stopColor={series.color}
												stopOpacity={0.05}
											/>
										</linearGradient>
									))}
								</defs>
								<CartesianGrid strokeDasharray="3 3" vertical={false} />
								<XAxis
									dataKey="dateLabel"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									fontSize={11}
									interval={
										chartData.length > 12 ? Math.floor(chartData.length / 6) : 0
									}
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
											formatter={(value, name) => {
												const series = config.series.find(
													(s) => s.key === name,
												);
												if (series?.format) {
													return series.format(value as number);
												}
												return (value as number).toFixed(1);
											}}
										/>
									}
								/>
								{config.series.map((series) => (
									<Area
										key={series.key}
										type="linear"
										dataKey={series.key}
										stroke={series.color}
										strokeWidth={2}
										fill={`url(#fill-trends-${series.key})`}
										dot={{ fill: series.color, strokeWidth: 0, r: 3 }}
										activeDot={{ r: 5, strokeWidth: 0 }}
									/>
								))}
							</AreaChart>
						</ResponsiveContainer>
					</ChartContainer>
				</div>

				{/* Legend */}
				<div className="border-t border-border">
					<div className="flex items-center justify-center gap-6 py-4 px-6 flex-wrap">
						{config.series.map((series) => (
							<div key={series.key} className="flex items-center gap-2">
								<div
									className="w-3 h-3 rounded-full"
									style={{ backgroundColor: series.color }}
								/>
								<span className="text-sm text-muted-foreground">
									{series.label}{" "}
									<span className="text-xs">
										({series.higherIsBetter ? "higher" : "lower"} = better)
									</span>
								</span>
							</div>
						))}
					</div>
				</div>
			</Card>
		</div>
	);
}

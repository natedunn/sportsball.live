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
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { AnimatedValue } from "../animated-value";
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
const STAT_PRESETS: StatPreset[] = [
	{
		title: "Efficiency",
		subtitle: "Offensive & Defensive Rating",
		series: [
			{
				key: "ortg",
				label: "Offensive Rating",
				shortLabel: "ORTG",
				color: "hsl(217, 91%, 60%)",
				higherIsBetter: true,
				format: (v: number) => v.toFixed(1),
			},
			{
				key: "drtg",
				label: "Defensive Rating",
				shortLabel: "DRTG",
				color: "hsl(38, 92%, 50%)",
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
	{
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
	{
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
	{
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
	{
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
];

type TimeRange = "5g" | "1m" | "3m" | "season";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
	{ value: "season", label: "Full Season" },
	{ value: "3m", label: "Last 3 Months" },
	{ value: "1m", label: "Last Month" },
	{ value: "5g", label: "Last 5 Games" },
];

// Chart data point type
interface ChartDataPoint {
	idx: number;
	date: number;
	dateLabel: string;
	[key: string]: string | number;
}

const NORMALIZED_POINTS = 20;

// Resample data to a fixed number of points via linear interpolation.
// Keeps the line always full-width so range changes only morph y-values.
function normalizeChartData(
	data: ChartDataPoint[],
	targetLength: number,
	seriesKeys: string[],
): ChartDataPoint[] {
	if (data.length === 0) return [];
	if (data.length === 1) {
		return Array.from({ length: targetLength }, (_, i) => ({
			...data[0],
			idx: i,
		}));
	}

	const result: ChartDataPoint[] = [];
	for (let i = 0; i < targetLength; i++) {
		const t = i / (targetLength - 1);
		const srcIdx = t * (data.length - 1);
		const lo = Math.floor(srcIdx);
		const hi = Math.min(lo + 1, data.length - 1);
		const frac = srcIdx - lo;

		const point: ChartDataPoint = {
			idx: i,
			date:
				(data[lo].date as number) +
				((data[hi].date as number) - (data[lo].date as number)) * frac,
			dateLabel: frac < 0.5 ? data[lo].dateLabel : data[hi].dateLabel,
		};

		for (const key of seriesKeys) {
			const loVal = data[lo][key] as number;
			const hiVal = data[hi][key] as number;
			point[key] = loVal + (hiVal - loVal) * frac;
		}

		result.push(point);
	}

	return result;
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
			idx,
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

// Filter games by time range
function filterGamesByRange(
	gameData: TeamGameData[],
	timeRange: TimeRange,
): TeamGameData[] {
	if (timeRange === "5g") {
		return gameData.slice(-5);
	}
	if (timeRange === "1m" || timeRange === "3m") {
		const now = new Date();
		const monthsAgo = timeRange === "1m" ? 1 : 3;
		const cutoffDate = new Date(
			now.getFullYear(),
			now.getMonth() - monthsAgo,
			now.getDate(),
		);
		return gameData.filter((game) => {
			const gameDate = new Date(
				parseInt(game.gameDate.slice(0, 4)),
				parseInt(game.gameDate.slice(4, 6)) - 1,
				parseInt(game.gameDate.slice(6, 8)),
			);
			return gameDate >= cutoffDate;
		});
	}
	return gameData;
}

interface TrendsCardProps {
	gameData: TeamGameData[];
}

export function TrendsCard({ gameData }: TrendsCardProps) {
	const [timeRange, setTimeRange] = useState<TimeRange>("season");

	const filteredGames = useMemo(
		() => filterGamesByRange(gameData, timeRange),
		[gameData, timeRange],
	);

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

	return (
		<div className="space-y-10">
			{/* Range selector */}
			<div className="flex flex-col gap-1">
				<label className="text-xs text-muted-foreground">Range</label>
				<Menu>
					<MenuTrigger className="inline-flex h-11 items-center justify-between gap-2 rounded-lg bg-muted px-4 py-1.5 text-sm font-medium text-foreground border w-fit hover:bg-foreground/5 transition-colors cursor-pointer">
						<span>{TIME_RANGE_OPTIONS.find((o) => o.value === timeRange)?.label}</span>
						<svg className="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
					</MenuTrigger>
					<MenuContent align="start">
						{TIME_RANGE_OPTIONS.map((option) => (
							<MenuItem
								key={option.value}
								onSelect={() => setTimeRange(option.value)}
								className={option.value === timeRange ? "text-foreground bg-foreground/10" : ""}
							>
								{option.label}
							</MenuItem>
						))}
					</MenuContent>
				</Menu>
			</div>

			{/* All trend sections */}
			{STAT_PRESETS.map((preset) => (
				<TrendSection
					key={preset.title}
					preset={preset}
					games={filteredGames}
					trendLabel={trendLabel}
				/>
			))}
		</div>
	);
}

// Individual trend section
interface TrendSectionProps {
	preset: StatPreset;
	games: TeamGameData[];
	trendLabel: string;
}

function TrendSection({ preset, games, trendLabel }: TrendSectionProps) {
	const chartRef = useRef<HTMLDivElement>(null);
	const chartSize = useChartSize(chartRef);
	const seriesKeys = useMemo(() => preset.series.map((s) => s.key), [preset.series]);

	const chartConfig = useMemo(() => {
		const cfg: ChartConfig = {};
		for (const series of preset.series) {
			cfg[series.key] = {
				label: series.shortLabel || series.label,
				color: series.color,
			};
		}
		return cfg;
	}, [preset.series]);

	const chartData = useMemo(() => {
		if (games.length === 0) return [];
		const rawStats = extractGameStats(games, seriesKeys);
		const rolling = calculateRollingAverages(rawStats, seriesKeys);
		return normalizeChartData(rolling, NORMALIZED_POINTS, seriesKeys);
	}, [games, seriesKeys]);



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

		for (const series of preset.series) {
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

		if (preset.derivedStat) {
			const lastData: Record<string, number> = {};
			const firstData: Record<string, number> = {};
			for (const key of seriesKeys) {
				lastData[key] = (last[key] as number) || 0;
				firstData[key] = (first[key] as number) || 0;
			}
			const currentDerived = preset.derivedStat.calculate(lastData);
			const startDerived = preset.derivedStat.calculate(firstData);
			result.derived = {
				label: preset.derivedStat.label,
				current: currentDerived,
				trend: currentDerived - startDerived,
				higherIsBetter: preset.derivedStat.higherIsBetter,
				format: preset.derivedStat.format,
			};
		}

		return result;
	}, [chartData, preset, seriesKeys]);

	if (chartData.length < 2) {
		return (
			<section>
				<div className="mb-4">
					<h3 className="text-lg font-semibold">{preset.title}</h3>
					<p className="text-sm text-muted-foreground">{preset.subtitle}</p>
				</div>
				<Card classNames={{ inner: "flex-col p-8" }}>
					<div className="text-center text-muted-foreground">
						<p>Not enough data available for this range.</p>
					</div>
				</Card>
			</section>
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
		<section>
			<div className="mb-4">
				<h3 className="text-lg font-semibold">{preset.title}</h3>
				<p className="text-sm text-muted-foreground">{preset.subtitle}</p>
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
							{summaryData.series.map((s, i) => (
								<div key={s.key} className="text-center py-4 px-3">
									<div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
										{s.label}
									</div>
									<div className="text-2xl font-bold tabular-nums">
										<AnimatedValue
											value={s.current}
											format={s.format}
											delay={i * 100}
										/>
									</div>
									<div
										className={cn(
											"text-xs",
											(s.higherIsBetter ? s.trend >= 0 : s.trend <= 0)
												? "text-green-500"
												: "text-red-500",
										)}
									>
										<AnimatedValue
											value={s.trend}
											format={(v) =>
												`${v >= 0 ? "+" : ""}${s.format(v)} ${trendLabel}`
											}
											delay={i * 100 + 200}
											duration={600}
										/>
									</div>
								</div>
							))}
							{summaryData.derived && (
								<div className="text-center py-4 px-3">
									<div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
										{summaryData.derived.label}
									</div>
									<div className="text-2xl font-bold tabular-nums">
										<AnimatedValue
											value={summaryData.derived.current}
											format={summaryData.derived.format}
											delay={summaryData.series.length * 100}
										/>
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
										<AnimatedValue
											value={summaryData.derived.trend}
											format={(v) =>
												`${summaryData.derived!.format(v)} ${trendLabel}`
											}
											delay={summaryData.series.length * 100 + 200}
											duration={600}
										/>
									</div>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Chart */}
				<div className="p-6">
					<ChartContainer ref={chartRef} config={chartConfig} className="h-[250px] w-full">
						{chartSize && (
							<AreaChart
								width={chartSize.width}
								height={chartSize.height}
								data={chartData}
								margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
							>
								<defs>
									{preset.series.map((series) => (
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
									dataKey="idx"
									type="number"
									domain={[0, NORMALIZED_POINTS - 1]}
									tickFormatter={(idx: number) =>
										chartData[Math.round(idx)]?.dateLabel ?? ""
									}
									ticks={Array.from({ length: 5 }, (_, i) =>
										Math.round((i * (NORMALIZED_POINTS - 1)) / 4),
									)}
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									fontSize={11}
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
												const series = preset.series.find(
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
								{preset.series.map((series) => (
									<Area
										key={series.key}
										type="linear"
										dataKey={series.key}
										stroke={series.color}
										strokeWidth={2}
										fill={`url(#fill-trends-${series.key})`}
										dot={false}
										activeDot={{ r: 5, strokeWidth: 0 }}
										animationDuration={300}
									/>
								))}
							</AreaChart>
						)}
					</ChartContainer>
				</div>

				{/* Legend */}
				<div className="border-t border-border">
					<div className="flex items-center justify-center gap-6 py-4 px-6 flex-wrap">
						{preset.series.map((series) => (
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
		</section>
	);
}

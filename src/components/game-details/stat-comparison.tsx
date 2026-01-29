import { cn } from "@/lib/utils";
import { useIsDarkMode } from "@/lib/use-is-dark-mode";

interface StatComparisonProps {
	label: string;
	awayValue: number;
	homeValue: number;
	awayDarkColor: string;
	awayLightColor: string;
	homeDarkColor: string;
	homeLightColor: string;
	format?: "number" | "percent";
	higherIsBetter?: boolean;
	awayDisplay?: string;
	homeDisplay?: string;
	awaySubValue?: string;
	homeSubValue?: string;
}

export function StatComparison({
	label,
	awayValue,
	homeValue,
	awayDarkColor,
	awayLightColor,
	homeDarkColor,
	homeLightColor,
	format = "number",
	higherIsBetter = true,
	awayDisplay,
	homeDisplay,
	awaySubValue,
	homeSubValue,
}: StatComparisonProps) {
	const isDark = useIsDarkMode();
	const awayColor = isDark ? awayDarkColor : awayLightColor;
	const homeColor = isDark ? homeDarkColor : homeLightColor;
	const total = awayValue + homeValue;
	const awayPercent = total > 0 ? (awayValue / total) * 100 : 50;
	const homePercent = total > 0 ? (homeValue / total) * 100 : 50;

	const awayWins = higherIsBetter
		? awayValue > homeValue
		: awayValue < homeValue;
	const homeWins = higherIsBetter
		? homeValue > awayValue
		: homeValue < awayValue;
	const isTied = awayValue === homeValue;

	const formatValue = (value: number) => {
		if (format === "percent") {
			return `${value}%`;
		}
		return value.toString();
	};

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between">
				<div className="flex flex-col items-start">
					<span
						className={cn(
							"font-medium tabular-nums px-2 rounded-full border",
							awayWins && "font-bold bg-foreground/10 border-foreground/20",
							isTied && "text-muted-foreground border-transparent",
							!awayWins && !isTied && "border-transparent",
						)}
					>
						{awayDisplay ?? formatValue(awayValue)}
					</span>
					{awaySubValue && (
						<span className="text-xs text-muted-foreground tabular-nums px-2">
							{awaySubValue}
						</span>
					)}
				</div>
				<span className="text-foreground text-sm uppercase tracking-wide">
					{label}
				</span>
				<div className="flex flex-col items-end">
					<span
						className={cn(
							"font-medium tabular-nums px-2 rounded-full border",
							homeWins && "font-bold bg-foreground/10 border-foreground/20",
							isTied && "text-muted-foreground border-transparent",
							!homeWins && !isTied && "border-transparent",
						)}
					>
						{homeDisplay ?? formatValue(homeValue)}
					</span>
					{homeSubValue && (
						<span className="text-xs text-muted-foreground tabular-nums px-2">
							{homeSubValue}
						</span>
					)}
				</div>
			</div>
			<div className="relative flex h-4 w-full overflow-hidden border-border/30 border-2 rounded-full bg-muted">
				<div className="pointer-events-none z-10 absolute inset-0 bg-linear-to-b from-transparent dark:to-black/40 to-white/30" />
				<div
					className="transition-all duration-300 ease-out border-r-2 border-background"
					style={{
						width: `${awayPercent}%`,
						backgroundColor: `#${awayColor}`,
					}}
				/>
				<div
					className="transition-all duration-300 ease-out"
					style={{
						width: `${homePercent}%`,
						backgroundColor: `#${homeColor}`,
					}}
				/>
			</div>
		</div>
	);
}

interface StatComparisonGroupProps {
	title: string;
	children: React.ReactNode;
	isFirst?: boolean;
}

export function StatComparisonGroup({
	title,
	children,
	isFirst,
}: StatComparisonGroupProps) {
	return (
		<div className="flex flex-col">
			<h3
				className={cn(
					"px-4 pb-3 pt-3.5 text-xs font-medium uppercase tracking-wider text-muted-foreground bg-muted/30 border-border/50",
					isFirst ? "border-b" : "border-y",
				)}
			>
				{title}
			</h3>
			<div className="flex flex-col gap-3 p-4">{children}</div>
		</div>
	);
}

import { cn } from "@/lib/utils";

interface StatComparisonProps {
	label: string;
	awayValue: number;
	homeValue: number;
	awayColor: string;
	homeColor: string;
	format?: "number" | "percent";
	higherIsBetter?: boolean;
}

export function StatComparison({
	label,
	awayValue,
	homeValue,
	awayColor,
	homeColor,
	format = "number",
	higherIsBetter = true,
}: StatComparisonProps) {
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
			<div className="flex items-center justify-between text-sm">
				<span
					className={cn(
						"font-medium tabular-nums",
						awayWins && "font-bold",
						isTied && "text-muted-foreground",
					)}
				>
					{formatValue(awayValue)}
				</span>
				<span className="text-muted-foreground text-xs uppercase tracking-wide">
					{label}
				</span>
				<span
					className={cn(
						"font-medium tabular-nums",
						homeWins && "font-bold",
						isTied && "text-muted-foreground",
					)}
				>
					{formatValue(homeValue)}
				</span>
			</div>
			<div className="relative flex h-4 w-full overflow-hidden border-border/30 border-2 rounded-full bg-muted">
				<div className="pointer-events-none z-10 absolute inset-0 bg-linear-to-b from-transparent dark:to-black/40 to-white/30" />
				<div
					className="transition-all duration-300 ease-out"
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
}

export function StatComparisonGroup({
	title,
	children,
}: StatComparisonGroupProps) {
	return (
		<div className="flex flex-col gap-4">
			<h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
				{title}
			</h3>
			<div className="flex flex-col gap-3">{children}</div>
		</div>
	);
}

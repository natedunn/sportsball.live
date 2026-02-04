import { cn } from "@/lib/utils";

interface MarginBarProps {
	margin: number;
	maxMargin?: number;
}

export function MarginBar({ margin, maxMargin = 30 }: MarginBarProps) {
	const absMargin = Math.abs(margin);
	const percentage = Math.min((absMargin / maxMargin) * 100, 100);
	const isWin = margin > 0;

	return (
		<div className="flex items-center gap-2">
			{/* Bar container */}
			<div className="relative flex-1 h-4 bg-muted rounded-full border overflow-hidden">
				{/* Center line */}
				<div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-10" />

				{/* Bar */}
				<div
					className={cn(
						"absolute top-0 bottom-0 transition-all",
						isWin
							? "left-1/2 bg-green-500 dark:bg-green-500"
							: "right-1/2 bg-red-500 dark:bg-red-500",
					)}
					style={{
						width: `${percentage / 2}%`,
					}}
				/>
			</div>

			{/* Margin value */}
			<span
				className={cn(
					"w-8 text-right text-xs font-medium tabular-nums",
					isWin
						? "text-green-600 dark:text-green-400"
						: "text-red-600 dark:text-red-400",
				)}
			>
				{isWin ? "+" : ""}
				{margin}
			</span>
		</div>
	);
}

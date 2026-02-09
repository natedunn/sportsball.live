import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getOrdinalSuffix } from "./format-utils";
import { AnimatedValue } from "./animated-value";
import { useHasTabAnimated } from "./animation-context";

interface StatCardProps {
	label: string;
	value: string;
	description?: string;
	subtitle?: string; // For custom subtitle text (e.g., "85% win rate")
	detail?: string; // Secondary detail line (e.g., "35.2 / 82.1 per game")
	icon?: React.ComponentType<{ className?: string }>;
	rank?: number; // If provided, generates subtitle like "3rd in league"
	highlight?: boolean; // Force highlight regardless of rank
	rawValue?: number; // If provided with formatValue, animates counting
	formatValue?: (v: number) => string;
	delay?: number; // Stagger delay for animation (ms)
}

export function StatCard({
	label,
	value,
	description,
	subtitle,
	detail,
	icon: Icon,
	rank,
	highlight: forceHighlight,
	rawValue,
	formatValue,
	delay,
}: StatCardProps) {
	const isTopTen = rank !== undefined && rank > 0 && rank <= 10;
	const isHighlighted = forceHighlight || isTopTen;
	const hasTabAnimated = useHasTabAnimated();
	// Lock in at mount time — tab switches don't re-trigger
	const animate = useRef(!hasTabAnimated && delay !== undefined).current;

	// Fade-up on the whole card
	const [visible, setVisible] = useState(!animate);
	useEffect(() => {
		if (!animate) return;
		const timeout = setTimeout(() => setVisible(true), delay);
		return () => clearTimeout(timeout);
	}, [animate, delay]);

	// Generate subtitle from rank if not provided directly
	const displaySubtitle =
		subtitle ??
		(rank && rank > 0 ? `${getOrdinalSuffix(rank)} in league` : undefined);

	return (
		<div
			className={cn(
				"group relative rounded-xl border bg-muted p-4 hover:shadow-md",
				isHighlighted && "bg-primary/5 border-primary/20",
				animate
					? cn(
							"transition-[opacity,transform,box-shadow] duration-700 ease-out",
							visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
						)
					: "transition-shadow duration-200",
			)}
		>
			{/* Icon badge */}
			{Icon && (
				<div
					className={cn(
						"absolute -top-2 -right-2 h-8 w-8 rounded-full border bg-background flex items-center justify-center overflow-hidden",
						isHighlighted && "border-primary/30",
					)}
				>
					{/* Primary overlay for highlighted */}
					{isHighlighted && (
						<div className="absolute inset-0 bg-primary/20" />
					)}
					<Icon
						className={cn(
							"h-4 w-4 relative",
							isHighlighted ? "text-primary" : "text-muted-foreground",
						)}
					/>
				</div>
			)}

			{/* Label */}
			<div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
				{label}
			</div>

			{/* Value */}
			<div className="text-2xl font-bold tabular-nums">
				{rawValue !== undefined && formatValue ? (
					<AnimatedValue value={rawValue} format={formatValue} delay={delay} />
				) : (
					value
				)}
			</div>

			{/* Subtitle (rank or custom) */}
			{displaySubtitle && (
				<div
					className={cn(
						"text-xs mt-1 tabular-nums",
						isTopTen ? "text-primary font-medium" : "text-muted-foreground",
					)}
				>
					{displaySubtitle}
				</div>
			)}

			{/* Detail line (e.g., made/attempted) */}
			{detail && (
				<div className="text-[11px] mt-1 tabular-nums text-muted-foreground">
					{detail}
				</div>
			)}

			{/* Tooltip on hover - description */}
			{description && (
				<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border z-10">
					{description}
				</div>
			)}
		</div>
	);
}

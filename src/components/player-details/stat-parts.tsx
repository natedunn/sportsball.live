import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Pieces shared by the Stats tab and the game performance dialog

export function fixed(value: number | null | undefined, decimals = 1, suffix = "") {
	return value === null || value === undefined ? "—" : `${value.toFixed(decimals)}${suffix}`;
}

export function signed(value: number | null | undefined, decimals = 1) {
	if (value === null || value === undefined) return "—";
	const text = value.toFixed(decimals);
	return value > 0 ? `+${text}` : text;
}

/** "20261030" → "Oct 30" */
export function shortDate(gameDate: string) {
	const date = new Date(
		Number(gameDate.slice(0, 4)),
		Number(gameDate.slice(4, 6)) - 1,
		Number(gameDate.slice(6, 8)),
	);
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// --- Change against the season ---

/** Which way is good: TOV down is good, minutes and usage are neither */
export type Better = "higher" | "lower" | "neither";

export function Delta({
	value,
	better = "higher",
	decimals = 1,
	suffix = "",
	against = "season",
	className,
}: {
	value: number | null;
	better?: Better;
	decimals?: number;
	suffix?: string;
	/** What the value is compared with, for the "same" text and screen readers */
	against?: string;
	className?: string;
}) {
	if (value === null) return null;
	if (Math.abs(value) < 0.5 * 10 ** -decimals) {
		return <span className={cn("text-xs text-muted-foreground", className)}>Same as {against}</span>;
	}
	const up = value > 0;
	const good = better === "neither" ? null : better === "higher" ? up : !up;
	const Icon = up ? ArrowUpRight : ArrowDownRight;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
				good === null
					? "text-muted-foreground"
					: good
						? "text-green-700 dark:text-green-400"
						: "text-red-700 dark:text-red-400",
				className,
			)}
		>
			<Icon className="size-3.5" aria-hidden />
			{Math.abs(value).toFixed(decimals)}
			{suffix}
			<span className="sr-only">
				{up ? " above" : " below"} {against}
			</span>
		</span>
	);
}

export function diff(value: number | null, baseline: number | null) {
	return value === null || baseline === null ? null : value - baseline;
}

export function HeadlineStat({
	label,
	value,
	delta,
	color,
}: {
	label: string;
	value: string;
	delta?: ReactNode;
	color: string;
}) {
	return (
		<div className="flex flex-col items-center gap-1 px-2 py-5 text-center md:py-6">
			<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				{label}
			</span>
			<span className="text-4xl font-bold tabular-nums tracking-tight md:text-5xl">{value}</span>
			<span className="h-1 w-8 rounded-full" style={{ backgroundColor: color }} aria-hidden />
			<span className="flex h-4 items-center">{delta}</span>
		</div>
	);
}

export function MinorStat({ label, value, delta }: { label: string; value: string; delta?: ReactNode }) {
	return (
		<div className="flex flex-col items-center gap-0.5 px-2 py-3 text-center">
			<span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
				{label}
			</span>
			<span className="text-xl font-semibold tabular-nums">{value}</span>
			{delta && <span className="flex h-4 items-center">{delta}</span>}
		</div>
	);
}

export function ShootingRow({
	label,
	detail,
	pct,
	seasonPct,
	color,
	against = "season",
}: {
	label: string;
	detail: string;
	pct: number | null;
	seasonPct: number | null | undefined;
	color: string;
	against?: string;
}) {
	return (
		<div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[6rem_1fr_7rem]">
			<div>
				<div className="font-semibold">{label}</div>
				<div className="text-xs tabular-nums text-muted-foreground">{detail}</div>
			</div>
			<div className="relative h-2.5 rounded-full bg-muted" role="presentation">
				<div
					className="h-full rounded-full transition-[width] duration-500 ease-out"
					style={{ width: `${Math.min(pct ?? 0, 100)}%`, backgroundColor: color }}
				/>
				{/* Season mark, so a filtered bar reads against the full season */}
				{seasonPct !== undefined && seasonPct !== null && (
					<div
						className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground"
						style={{ left: `calc(${Math.min(seasonPct, 100)}% - 1px)` }}
						title={`${against[0].toUpperCase()}${against.slice(1)} ${seasonPct.toFixed(1)}%`}
					/>
				)}
			</div>
			<div className="flex flex-col items-end">
				<span className="text-lg font-semibold tabular-nums">{fixed(pct, 1, "%")}</span>
				{seasonPct !== undefined && <Delta value={diff(pct, seasonPct)} suffix=" pts" against={against} />}
			</div>
		</div>
	);
}

import { useState, useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { parse, format } from "date-fns";
import { cn } from "@/lib/utils";
import { moveDate } from "@/lib/date";
import { getButtonClasses } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import type { League } from "@/lib/shared/league";

// Every short weekday and month name, from dates known to fall on each
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
	format(new Date(2026, 0, 4 + i), "EEE"),
);
const MONTHS = Array.from({ length: 12 }, (_, i) =>
	format(new Date(2026, i, 1), "MMM"),
);

/** Overlaps every option invisibly, so the cell is as wide as the widest */
function WidestOf({ options }: { options: string[] }) {
	return (
		<span className="inline-grid">
			{options.map((option) => (
				<span key={option} className="col-start-1 row-start-1">
					{option}
				</span>
			))}
		</span>
	);
}

/**
 * "Wed, Nov 4, 2026", drawn over an invisible copy built from the widest
 * weekday, the widest month and a two-digit day. The button keeps that width
 * on every date, so moving between days doesn't shift the toolbar.
 */
function FixedWidthDate({ date }: { date: Date }) {
	return (
		<span className="inline-grid justify-items-center">
			<span aria-hidden className="invisible col-start-1 row-start-1">
				<WidestOf options={WEEKDAYS} />, <WidestOf options={MONTHS} /> 00, 0000
			</span>
			<span className="col-start-1 row-start-1">
				{format(date, "EEE, MMM d, yyyy")}
			</span>
		</span>
	);
}

interface DatePaginationProps {
	date: string;
	className?: string;
	league?: League;
}

type NavigatingTo = "prev" | "next" | "today" | "picker" | null;

export function DatePagination({ date, className, league = "nba" }: DatePaginationProps) {
	const navigate = useNavigate();
	const [datePickerOpen, setDatePickerOpen] = useState(false);
	const [navigatingTo, setNavigatingTo] = useState<NavigatingTo>(null);

	const isRouterPending = useRouterState({
		select: (s) => s.status === "pending",
	});

	// Only consider "navigating" if WE initiated it (navigatingTo is set)
	const isNavigating = navigatingTo !== null && isRouterPending;

	// Reset navigatingTo when navigation completes
	useEffect(() => {
		if (!isRouterPending && navigatingTo !== null) {
			setNavigatingTo(null);
		}
	}, [isRouterPending, navigatingTo]);

	const isDisabled = isNavigating;

	const iconButtonClasses = cn(
		getButtonClasses("outline", "sm"),
		"w-9 px-0 focus-visible:z-10",
	);

	const prevDay = moveDate(date, "prev");
	const todayDay = moveDate(date, "today");
	const nextDay = moveDate(date, "next");

	const dateValue = date ? parse(date, "yyyy-MM-dd", new Date()) : undefined;

	const leaguePaths = {
		nba: "/nba/scores",
		wnba: "/wnba/scores",
		gleague: "/gleague/scores",
	};
	const leaguePath = leaguePaths[league];

	const handleNavigate = (targetDate: string, target: NavigatingTo) => {
		if (isDisabled) return;
		setNavigatingTo(target);
		navigate({ to: leaguePath, search: { date: targetDate } });
	};

	const handleDateChange = (newDate: Date | undefined) => {
		if (newDate && !isDisabled) {
			const formatted = format(newDate, "yyyy-MM-dd");
			setNavigatingTo("picker");
			navigate({ to: leaguePath, search: { date: formatted } });
			setDatePickerOpen(false);
		}
	};

	const isToday = date === todayDay;

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<div className="flex items-center">
				<button
					type="button"
					onClick={() => handleNavigate(prevDay, "prev")}
					disabled={isDisabled}
					aria-label="Previous day"
					className={cn(iconButtonClasses, "rounded-r-none")}
				>
					{navigatingTo === "prev" ? (
						<Loader2 className="animate-spin" />
					) : (
						<ChevronLeft />
					)}
				</button>
				<DatePicker
					value={dateValue}
					onChange={handleDateChange}
					open={datePickerOpen && !isDisabled}
					onOpenChange={(open) => !isDisabled && setDatePickerOpen(open)}
					disabled={isDisabled}
					renderValue={(value) => <FixedWidthDate date={value} />}
					className="-mx-px rounded-none tabular-nums focus-visible:z-10"
				/>
				<button
					type="button"
					onClick={() => handleNavigate(nextDay, "next")}
					disabled={isDisabled}
					aria-label="Next day"
					className={cn(iconButtonClasses, "rounded-l-none")}
				>
					{navigatingTo === "next" ? (
						<Loader2 className="animate-spin" />
					) : (
						<ChevronRight />
					)}
				</button>
			</div>
			<button
				type="button"
				onClick={() => handleNavigate(todayDay, "today")}
				disabled={isDisabled || isToday}
				className={getButtonClasses("outline", "sm")}
			>
				{navigatingTo === "today" && <Loader2 className="animate-spin" />}
				Today
			</button>
		</div>
	);
}

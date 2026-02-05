import { useState, useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ArrowDown, Loader2 } from "lucide-react";
import { parse, format } from "date-fns";
import { cn } from "@/lib/utils";
import { moveDate } from "@/lib/date";
import { getButtonClasses } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import type { League } from "@/lib/shared/league";

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

	const buttonClasses = cn(
		getButtonClasses("outline", "sm"),
		"flex items-center gap-2",
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

	return (
		<div className={cn("flex flex-wrap gap-2", className)}>
			<button
				type="button"
				onClick={() => handleNavigate(prevDay, "prev")}
				disabled={isDisabled}
				className={cn(buttonClasses, isDisabled && "opacity-50 cursor-not-allowed")}
			>
				{navigatingTo === "prev" ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<ArrowLeft className="h-4 w-4" />
				)}
				Previous
			</button>
			<DatePicker
				value={dateValue}
				onChange={handleDateChange}
				open={datePickerOpen && !isDisabled}
				onOpenChange={(open) => !isDisabled && setDatePickerOpen(open)}
				disabled={isDisabled}
			/>
			<button
				type="button"
				onClick={() => handleNavigate(todayDay, "today")}
				disabled={isDisabled}
				className={cn(buttonClasses, isDisabled && "opacity-50 cursor-not-allowed")}
			>
				{navigatingTo === "today" ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<ArrowDown className="h-4 w-4" />
				)}
				Today
			</button>
			<button
				type="button"
				onClick={() => handleNavigate(nextDay, "next")}
				disabled={isDisabled}
				className={cn(buttonClasses, isDisabled && "opacity-50 cursor-not-allowed")}
			>
				Next
				{navigatingTo === "next" ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<ArrowRight className="h-4 w-4" />
				)}
			</button>
		</div>
	);
}

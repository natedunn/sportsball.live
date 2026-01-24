import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ArrowDown } from "lucide-react";
import { parse, format } from "date-fns";
import { cn } from "@/lib/utils";
import { moveDate } from "@/lib/date";
import { getButtonClasses } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";

interface DatePaginationProps {
	date: string;
	className?: string;
}

export function DatePagination({ date, className }: DatePaginationProps) {
	const navigate = useNavigate();
	const [datePickerOpen, setDatePickerOpen] = useState(false);

	const buttonClasses = cn(
		getButtonClasses("outline", "sm"),
		"flex items-center gap-2",
	);

	const prevDay = moveDate(date, "prev");
	const todayDay = moveDate(date, "today");
	const nextDay = moveDate(date, "next");

	// Parse the date string to a Date object for the picker
	const dateValue = date ? parse(date, "yyyy-MM-dd", new Date()) : undefined;

	const handleDateChange = (newDate: Date | undefined) => {
		if (newDate) {
			const formatted = format(newDate, "yyyy-MM-dd");
			navigate({ to: "/nba", search: { date: formatted } });
			setDatePickerOpen(false);
		}
	};

	return (
		<div className={cn("flex flex-wrap gap-2", className)}>
			<Link
				to="/nba"
				search={{ date: prevDay }}
				className={buttonClasses}
				draggable="false"
			>
				<ArrowLeft className="h-4 w-4" />
				Previous
			</Link>
			<DatePicker
				value={dateValue}
				onChange={handleDateChange}
				open={datePickerOpen}
				onOpenChange={setDatePickerOpen}
			/>
			<Link
				to="/nba"
				search={{ date: todayDay }}
				className={buttonClasses}
				draggable="false"
			>
				<ArrowDown className="h-4 w-4" />
				Today
			</Link>
			<Link
				to="/nba"
				search={{ date: nextDay }}
				className={buttonClasses}
				draggable="false"
			>
				Next
				<ArrowRight className="h-4 w-4" />
			</Link>
		</div>
	);
}

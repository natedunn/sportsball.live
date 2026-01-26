import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerProps {
	value?: Date;
	onChange?: (date: Date | undefined) => void;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	disabled?: boolean;
}

export function DatePicker({
	value,
	onChange,
	open,
	onOpenChange,
	disabled,
}: DatePickerProps) {
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					disabled={disabled}
					className={cn(
						"justify-start text-left font-normal gap-2",
						!value && "text-muted-foreground",
						disabled && "opacity-50 cursor-not-allowed",
					)}
				>
					<CalendarIcon className="h-4 w-4" />
					{value ? format(value, "PPP") : "Pick a date"}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar mode="single" selected={value} onSelect={onChange} />
			</PopoverContent>
		</Popover>
	);
}

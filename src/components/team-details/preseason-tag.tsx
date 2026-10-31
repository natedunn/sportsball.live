import { cn } from "@/lib/utils";

// Marks a preseason game in team schedules (preseason never counts toward records)
export function PreseasonTag({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
				className,
			)}
		>
			Preseason
		</span>
	);
}

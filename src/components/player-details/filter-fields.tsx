import type { ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function FilterSelect<T extends string>({
	label,
	value,
	options,
	onChange,
	className,
}: {
	label: string;
	value: T;
	options: Array<{ value: T; label: string }>;
	onChange: (value: T) => void;
	className?: string;
}) {
	return (
		<Select value={value} onValueChange={(next) => onChange(next as T)}>
			<SelectTrigger
				size="default"
				className={cn("h-9 min-w-36 rounded-lg bg-background font-medium", className)}
				aria-label={label}
			>
				{options.find((option) => option.value === value)?.label}
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value} size="default">
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export function SidebarField({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="space-y-1.5">
			<div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
				{label}
			</div>
			{children}
		</div>
	);
}

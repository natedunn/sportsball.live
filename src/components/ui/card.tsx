import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
	children: ReactNode;
	classNames?: {
		wrapper?: string;
		inner?: string;
	};
}

export function Card({ children, classNames }: CardProps) {
	return (
		<div
			className={cn(
				"flex gap-2 rounded-xl border border-border/50 bg-muted/60 p-2",
				classNames?.wrapper,
			)}
		>
			<div
				className={cn(
					"relative flex w-full justify-between gap-2 overflow-hidden rounded-lg border border-border bg-card",
					classNames?.inner,
				)}
			>
				{children}
			</div>
		</div>
	);
}

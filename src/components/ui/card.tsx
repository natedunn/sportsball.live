import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
	children: ReactNode;
	classNames?: {
		wrapper?: string;
		inner?: string;
	};
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
	({ children, classNames }, ref) => {
		return (
			<div
				ref={ref}
				className={cn(
					"flex gap-2 rounded-xl border border-border/75 bg-accent p-2 dark:bg-muted",
					classNames?.wrapper,
				)}
			>
				<div
					className={cn(
						"relative flex w-full justify-between gap-2 overflow-hidden rounded-lg border border-border/75 bg-card",
						classNames?.inner,
					)}
				>
					{children}
				</div>
			</div>
		);
	},
);

Card.displayName = "Card";

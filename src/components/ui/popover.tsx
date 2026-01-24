import * as React from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

interface PopoverProps {
	children: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function Popover({ children, open, onOpenChange }: PopoverProps) {
	return (
		<BasePopover.Root open={open} onOpenChange={onOpenChange}>
			{children}
		</BasePopover.Root>
	);
}

interface PopoverTriggerProps {
	children: React.ReactNode;
	className?: string;
	asChild?: boolean;
}

export function PopoverTrigger({
	children,
	className,
	asChild,
}: PopoverTriggerProps) {
	if (asChild && React.isValidElement(children)) {
		return <BasePopover.Trigger render={children} className={className} />;
	}

	return (
		<BasePopover.Trigger className={className}>{children}</BasePopover.Trigger>
	);
}

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
	align?: "start" | "center" | "end";
	sideOffset?: number;
}

export function PopoverContent({
	children,
	className,
	align = "start",
	sideOffset = 4,
	...props
}: PopoverContentProps) {
	return (
		<BasePopover.Portal>
			<BasePopover.Positioner
				side="bottom"
				align={align}
				sideOffset={sideOffset}
			>
				<BasePopover.Popup
					className={cn(
						"z-50 rounded-md border bg-popover text-popover-foreground shadow-md outline-none",
						"origin-[var(--transform-origin)] will-change-[transform,opacity] transition-[transform,opacity] duration-150 ease-out",
						"data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
						"data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
						className,
					)}
					{...props}
				>
					{children}
				</BasePopover.Popup>
			</BasePopover.Positioner>
		</BasePopover.Portal>
	);
}

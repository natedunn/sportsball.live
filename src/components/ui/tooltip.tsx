import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

interface TooltipProps {
	children: React.ReactNode;
	content: React.ReactNode;
	side?: "top" | "bottom" | "left" | "right";
	className?: string;
	delay?: number;
	closeDelay?: number;
	hoverable?: boolean;
}

export function Tooltip({
	children,
	content,
	side = "top",
	className,
	delay = 100,
	closeDelay,
	hoverable = true,
}: TooltipProps) {
	return (
		<BaseTooltip.Provider delay={delay} closeDelay={closeDelay}>
			<BaseTooltip.Root disableHoverablePopup={!hoverable}>
				<BaseTooltip.Trigger className={className}>
					{children}
				</BaseTooltip.Trigger>
				<BaseTooltip.Portal>
					<BaseTooltip.Positioner side={side} sideOffset={8} className="z-50">
						<BaseTooltip.Popup
							className={cn(
								"relative rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow-lg border",
								"animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
							)}
						>
							{content}
						</BaseTooltip.Popup>
					</BaseTooltip.Positioner>
				</BaseTooltip.Portal>
			</BaseTooltip.Root>
		</BaseTooltip.Provider>
	);
}

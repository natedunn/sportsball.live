import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

interface TooltipProps {
	children: React.ReactNode;
	content: React.ReactNode;
	side?: "top" | "bottom" | "left" | "right";
	className?: string;
}

export function Tooltip({
	children,
	content,
	side = "top",
	className,
}: TooltipProps) {
	return (
		<BaseTooltip.Provider delay={100}>
			<BaseTooltip.Root>
				<BaseTooltip.Trigger className={className}>
					{children}
				</BaseTooltip.Trigger>
				<BaseTooltip.Portal>
					<BaseTooltip.Positioner side={side} sideOffset={8} className="z-50">
						<BaseTooltip.Popup
							className={cn(
								"relative rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md",
								"animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
							)}
						>
							<BaseTooltip.Arrow className="fill-foreground absolute -bottom-1.25 left-1/2 -translate-x-1/2">
								<svg width="10" height="5" viewBox="0 0 10 5">
									<polygon points="0,0 5,5 10,0" />
								</svg>
							</BaseTooltip.Arrow>
							{content}
						</BaseTooltip.Popup>
					</BaseTooltip.Positioner>
				</BaseTooltip.Portal>
			</BaseTooltip.Root>
		</BaseTooltip.Provider>
	);
}

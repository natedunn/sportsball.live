import type { ReactNode } from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";

/** A labelled on/off control */
export function Switch({
	checked,
	onCheckedChange,
	children,
}: {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	children: ReactNode;
}) {
	return (
		<label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-medium text-muted-foreground hover:text-foreground">
			<BaseSwitch.Root
				checked={checked}
				onCheckedChange={(next) => onCheckedChange(next)}
				className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-muted-foreground/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring data-checked:bg-foreground"
			>
				<BaseSwitch.Thumb className="absolute left-0.5 top-0.5 size-4 rounded-full bg-background shadow-sm transition-transform data-checked:translate-x-4" />
			</BaseSwitch.Root>
			{children}
		</label>
	);
}

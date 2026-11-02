import { FlickeringGrid, type FlickeringGridProps } from "./ui/flickering-grid";
import { cn } from "@/lib/utils";
import { useIsDarkMode } from "@/lib/use-is-dark-mode";

interface TeamFlickeringGridProps {
	dark: string;
	light: string;
	grid?: FlickeringGridProps;
	className?: string;
	/** Size the grid to its container instead of a fixed box */
	fill?: boolean;
}

export function TeamFlickeringGrid({
	dark,
	light,
	grid = {},
	className,
	fill = false,
}: TeamFlickeringGridProps) {
	const isDark = useIsDarkMode();
	const color = `#${isDark ? dark : light}`;

	return (
		<FlickeringGrid
			className={cn("", className)}
			color={color}
			squareSize={grid.squareSize ?? 4}
			gridGap={grid.gridGap ?? 6}
			maxOpacity={grid.maxOpacity ?? 0.7}
			flickerChance={grid.flickerChance ?? 0.1}
			height={fill ? undefined : (grid.height ?? 130)}
			width={fill ? undefined : (grid.width ?? 130)}
		/>
	);
}

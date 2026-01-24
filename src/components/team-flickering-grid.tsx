import { useEffect, useState } from "react";
import { FlickeringGrid, type FlickeringGridProps } from "./flickering-grid";
import { cn } from "@/lib/utils";

interface TeamFlickeringGridProps {
	dark: string;
	light: string;
	grid?: FlickeringGridProps;
	className?: string;
}

export function TeamFlickeringGrid({
	dark,
	light,
	grid = {},
	className,
}: TeamFlickeringGridProps) {
	const [isDark, setIsDark] = useState(false);

	useEffect(() => {
		const checkDarkMode = () => {
			setIsDark(document.documentElement.classList.contains("dark"));
		};

		checkDarkMode();

		const observer = new MutationObserver(checkDarkMode);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	const color = `#${isDark ? dark : light}`;

	return (
		<FlickeringGrid
			className={cn("absolute inset-0 z-0", className)}
			color={color}
			squareSize={grid.squareSize ?? 4}
			gridGap={grid.gridGap ?? 6}
			maxOpacity={grid.maxOpacity ?? 0.7}
			flickerChance={grid.flickerChance ?? 0.1}
			height={grid.height ?? 130}
			width={grid.width ?? 130}
		/>
	);
}

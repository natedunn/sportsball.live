import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useHasTabAnimated } from "@/components/team-details/animation-context";

interface TabContentMotionProps {
	children: ReactNode;
}

export function TabContentMotion({ children }: TabContentMotionProps) {
	const hasTabAnimated = useHasTabAnimated();
	const animate = useRef(!hasTabAnimated).current;
	const [visible, setVisible] = useState(!animate);

	useEffect(() => {
		if (!animate) return;
		const timeout = window.setTimeout(() => setVisible(true), 50);
		return () => window.clearTimeout(timeout);
	}, [animate]);

	return (
		<div
			className={cn(
				animate &&
					cn(
						"transition-[opacity,transform] duration-700 ease-out",
						visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
					),
			)}
		>
			{children}
		</div>
	);
}

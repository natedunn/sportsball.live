import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useHasTabAnimated } from "./animation-context";

interface AnimatedValueProps {
	value: number;
	format: (v: number) => string;
	delay?: number;
	duration?: number;
	className?: string;
}

export function AnimatedValue({
	value,
	format,
	delay = 0,
	duration = 800,
	className,
}: AnimatedValueProps) {
	const hasTabAnimated = useHasTabAnimated();
	// Lock in animation decision at mount time so context changes don't interrupt
	const shouldAnimate = useRef(!hasTabAnimated).current;

	const startValue = shouldAnimate ? Math.max(0, value - 20) : value;
	const [display, setDisplay] = useState(startValue);
	const [entered, setEntered] = useState(!shouldAnimate);
	const fromRef = useRef(startValue);
	const frameRef = useRef<number>(0);

	useEffect(() => {
		if (!shouldAnimate) {
			setDisplay(value);
			setEntered(true);
			return;
		}

		const timeout = setTimeout(() => {
			setEntered(true);
			const from = fromRef.current;
			const start = performance.now();

			if (frameRef.current) cancelAnimationFrame(frameRef.current);

			const tick = (now: number) => {
				const t = Math.min((now - start) / duration, 1);
				const eased = 1 - (1 - t) ** 3;
				const current = from + (value - from) * eased;
				fromRef.current = current;
				setDisplay(current);
				if (t < 1) frameRef.current = requestAnimationFrame(tick);
			};
			frameRef.current = requestAnimationFrame(tick);
		}, delay);

		return () => {
			clearTimeout(timeout);
			if (frameRef.current) cancelAnimationFrame(frameRef.current);
		};
	}, [value, delay, duration, shouldAnimate]);

	return (
		<span className={cn("inline-flex overflow-hidden", className)}>
			<span
				className={cn(
					"inline-block",
					shouldAnimate && "transition-transform duration-500 ease-out",
					entered ? "translate-y-0" : "translate-y-full",
				)}
			>
				{format(display)}
			</span>
		</span>
	);
}

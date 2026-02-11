import { cn } from "@/lib/utils";

interface ConferenceIconProps {
	className?: string;
}

export function EasternConferenceIcon({ className }: ConferenceIconProps) {
	return (
		<svg
			viewBox="0 0 20 20"
			aria-hidden="true"
			className={cn("h-4 w-4 text-muted-foreground", className)}
		>
			<circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" />
			<path d="M10 2.75A7.25 7.25 0 0 1 10 17.25Z" fill="currentColor" />
		</svg>
	);
}

export function WesternConferenceIcon({ className }: ConferenceIconProps) {
	return (
		<svg
			viewBox="0 0 20 20"
			aria-hidden="true"
			className={cn("h-4 w-4 text-muted-foreground", className)}
		>
			<circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" />
			<path d="M10 2.75A7.25 7.25 0 0 0 10 17.25Z" fill="currentColor" />
		</svg>
	);
}

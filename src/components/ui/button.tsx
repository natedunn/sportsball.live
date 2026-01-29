import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
	| "default"
	| "destructive"
	| "outline"
	| "secondary"
	| "ghost"
	| "link";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	asChild?: boolean;
}

const buttonVariants = {
	base: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	variant: {
		default: "bg-primary text-primary-foreground hover:bg-amber-700",
		destructive:
			"bg-destructive text-destructive-foreground hover:bg-destructive/90",
		outline:
			"border border-input bg-background hover:bg-accent hover:text-accent-foreground",
		secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
		ghost: "hover:bg-accent hover:text-accent-foreground",
		link: "text-primary underline-offset-4 hover:underline",
	},
	size: {
		default: "h-10 px-4 py-2",
		sm: "h-9 rounded-lg px-3",
		lg: "h-11 rounded-lg px-8",
		icon: "h-10 w-10",
	},
};

export function getButtonClasses(
	variant: ButtonVariant = "default",
	size: ButtonSize = "default",
) {
	return cn(
		buttonVariants.base,
		buttonVariants.variant[variant],
		buttonVariants.size[size],
	);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "default", size = "default", ...props }, ref) => {
		return (
			<button
				className={cn(getButtonClasses(variant, size), className)}
				ref={ref}
				{...props}
			/>
		);
	},
);

Button.displayName = "Button";

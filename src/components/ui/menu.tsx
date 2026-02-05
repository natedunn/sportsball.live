import * as React from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

interface MenuProps {
	children: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function Menu({ children, open, onOpenChange }: MenuProps) {
	return (
		<BaseMenu.Root open={open} onOpenChange={onOpenChange}>
			{children}
		</BaseMenu.Root>
	);
}

interface MenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	asChild?: boolean;
}

export const MenuTrigger = React.forwardRef<HTMLButtonElement, MenuTriggerProps>(
	({ children, className, asChild, ...props }, ref) => {
		if (asChild && React.isValidElement(children)) {
			return (
				<BaseMenu.Trigger ref={ref} render={children} className={className} />
			);
		}

		return (
			<BaseMenu.Trigger ref={ref} className={className} {...props}>
				{children}
			</BaseMenu.Trigger>
		);
	},
);
MenuTrigger.displayName = "MenuTrigger";

interface MenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
	align?: "start" | "center" | "end";
	sideOffset?: number;
}

export function MenuContent({
	children,
	className,
	align = "end",
	sideOffset = 8,
	...props
}: MenuContentProps) {
	return (
		<BaseMenu.Portal>
			<BaseMenu.Positioner side="bottom" align={align} sideOffset={sideOffset}>
				<BaseMenu.Popup
					className={cn(
						"z-50 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg outline-none",
						"origin-[var(--transform-origin)] will-change-[transform,opacity] transition-[transform,opacity] duration-150 ease-out",
						"data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
						"data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
						className,
					)}
					{...props}
				>
					{children}
				</BaseMenu.Popup>
			</BaseMenu.Positioner>
		</BaseMenu.Portal>
	);
}

interface MenuItemProps extends React.ComponentPropsWithoutRef<"div"> {
	disabled?: boolean;
	onSelect?: () => void;
}

export const MenuItem = React.forwardRef<HTMLDivElement, MenuItemProps>(
	({ children, className, disabled, onSelect, ...props }, ref) => {
		return (
			<BaseMenu.Item
				ref={ref}
				disabled={disabled}
				onClick={onSelect}
				className={cn(
					"relative flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors",
					"hover:bg-accent focus:bg-accent",
					"data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
					className,
				)}
				{...props}
			>
				{children}
			</BaseMenu.Item>
		);
	},
);
MenuItem.displayName = "MenuItem";

interface MenuLabelProps extends React.HTMLAttributes<HTMLDivElement> {}

export function MenuLabel({ children, className, ...props }: MenuLabelProps) {
	return (
		<div
			className={cn("px-3 py-1.5 text-xs font-medium text-muted-foreground", className)}
			{...props}
		>
			{children}
		</div>
	);
}

interface MenuSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}

export function MenuSeparator({ className, ...props }: MenuSeparatorProps) {
	return (
		<BaseMenu.Separator
			className={cn("-mx-1 my-1 h-px bg-border", className)}
			{...props}
		/>
	);
}

interface MenuGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

export function MenuGroup({ children, className, ...props }: MenuGroupProps) {
	return (
		<BaseMenu.Group className={cn("", className)} {...props}>
			{children}
		</BaseMenu.Group>
	);
}

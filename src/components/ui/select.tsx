import * as React from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

type SelectOption = { value: string; label: string; disabled?: boolean };

const SelectContext = React.createContext<{
	options: SelectOption[];
	registerOption: (option: SelectOption) => void;
	unregisterOption: (value: string) => void;
}>({
	options: [],
	registerOption: () => {},
	unregisterOption: () => {},
});

interface SelectProps {
	children: React.ReactNode;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
}

export function Select({
	children,
	value,
	defaultValue,
	onValueChange,
}: SelectProps) {
	const [options, setOptions] = React.useState<SelectOption[]>([]);

	const registerOption = React.useCallback((option: SelectOption) => {
		setOptions((prev) => {
			if (prev.some((o) => o.value === option.value)) return prev;
			return [...prev, option];
		});
	}, []);

	const unregisterOption = React.useCallback((value: string) => {
		setOptions((prev) => prev.filter((o) => o.value !== value));
	}, []);

	return (
		<SelectContext.Provider value={{ options, registerOption, unregisterOption }}>
			<BaseSelect.Root
				value={value}
				defaultValue={defaultValue}
				onValueChange={(val) => {
					if (val !== null && onValueChange) {
						onValueChange(val);
					}
				}}
			>
				{children}
			</BaseSelect.Root>
		</SelectContext.Provider>
	);
}

interface SelectTriggerProps {
	children?: React.ReactNode;
	className?: string;
	placeholder?: string;
	size?: "sm" | "default" | "lg";
}

const triggerSizeClasses = {
	sm: "px-2 py-1 text-xs gap-1.5",
	default: "px-3 py-1.5 text-sm gap-2",
	lg: "px-4 py-2 text-base gap-2.5",
};

const iconSizeClasses = {
	sm: "h-3 w-3",
	default: "h-4 w-4",
	lg: "h-5 w-5",
};

export function SelectTrigger({
	children,
	className,
	placeholder,
	size = "sm",
}: SelectTriggerProps) {
	const { options } = React.useContext(SelectContext);

	return (
		<BaseSelect.Trigger
			className={cn(
				"inline-flex items-center justify-between rounded border border-border bg-background",
				"hover:border-foreground/50 transition-colors cursor-pointer",
				"focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
				"overflow-hidden",
				triggerSizeClasses[size],
				className,
			)}
		>
			<span className="truncate">
				<BaseSelect.Value placeholder={placeholder}>
					{(value) => {
						const option = options.find((o) => o.value === value);
						if (option?.label) return option.label;
						// Fallback: capitalize first letter
						return typeof value === "string" ? value.charAt(0).toUpperCase() + value.slice(1) : value;
					}}
				</BaseSelect.Value>
			</span>
			<BaseSelect.Icon className="flex-shrink-0">
				<ChevronDown className={cn("text-muted-foreground", iconSizeClasses[size])} />
			</BaseSelect.Icon>
		</BaseSelect.Trigger>
	);
}

interface SelectContentProps {
	children: React.ReactNode;
	className?: string;
}

export function SelectContent({ children, className }: SelectContentProps) {
	return (
		<BaseSelect.Portal>
			<BaseSelect.Positioner sideOffset={4} className="z-50">
				<BaseSelect.Popup
					className={cn(
						"z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md",
						"data-[state=open]:animate-in data-[state=closed]:animate-out",
						"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
						"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
						className,
					)}
				>
					{children}
				</BaseSelect.Popup>
			</BaseSelect.Positioner>
		</BaseSelect.Portal>
	);
}

interface SelectItemProps {
	children: React.ReactNode;
	value: string;
	className?: string;
	disabled?: boolean;
	size?: "sm" | "default" | "lg";
}

const itemSizeClasses = {
	sm: "py-1.5 pl-6 pr-2 text-xs",
	default: "py-2 pl-8 pr-3 text-sm",
	lg: "py-2.5 pl-10 pr-4 text-base",
};

const itemIndicatorClasses = {
	sm: "left-1.5 h-3.5 w-3.5",
	default: "left-2 h-4 w-4",
	lg: "left-2.5 h-5 w-5",
};

const checkSizeClasses = {
	sm: "h-3 w-3",
	default: "h-4 w-4",
	lg: "h-5 w-5",
};

export function SelectItem({
	children,
	value,
	className,
	disabled,
	size = "sm",
}: SelectItemProps) {
	const { registerOption, unregisterOption } = React.useContext(SelectContext);
	const label = typeof children === "string" ? children : value;

	React.useEffect(() => {
		registerOption({ value, label, disabled });
		return () => unregisterOption(value);
	}, [value, label, disabled, registerOption, unregisterOption]);

	return (
		<BaseSelect.Item
			value={value}
			disabled={disabled}
			className={cn(
				"relative flex w-full cursor-pointer select-none items-center rounded-sm outline-none",
				"hover:bg-accent hover:text-accent-foreground",
				"focus:bg-accent focus:text-accent-foreground",
				"data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				itemSizeClasses[size],
				className,
			)}
		>
			<BaseSelect.ItemIndicator className={cn("absolute flex items-center justify-center", itemIndicatorClasses[size])}>
				<Check className={checkSizeClasses[size]} />
			</BaseSelect.ItemIndicator>
			<BaseSelect.ItemText>{children}</BaseSelect.ItemText>
		</BaseSelect.Item>
	);
}

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
}

export function SelectTrigger({
	children,
	className,
	placeholder,
}: SelectTriggerProps) {
	const { options } = React.useContext(SelectContext);

	return (
		<BaseSelect.Trigger
			className={cn(
				"inline-flex items-center justify-between gap-2 rounded border border-border bg-background px-2 py-1 text-xs",
				"hover:border-foreground/50 transition-colors cursor-pointer",
				"focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
				className,
			)}
		>
			<BaseSelect.Value placeholder={placeholder}>
				{(value) => {
					const option = options.find((o) => o.value === value);
					if (option?.label) return option.label;
					// Fallback: capitalize first letter
					return typeof value === "string" ? value.charAt(0).toUpperCase() + value.slice(1) : value;
				}}
			</BaseSelect.Value>
			<BaseSelect.Icon>
				<ChevronDown className="h-3 w-3 text-muted-foreground" />
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
			<BaseSelect.Positioner sideOffset={4}>
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
}

export function SelectItem({
	children,
	value,
	className,
	disabled,
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
				"relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-6 pr-2 text-xs outline-none",
				"hover:bg-accent hover:text-accent-foreground",
				"focus:bg-accent focus:text-accent-foreground",
				"data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				className,
			)}
		>
			<BaseSelect.ItemIndicator className="absolute left-1.5 flex h-3.5 w-3.5 items-center justify-center">
				<Check className="h-3 w-3" />
			</BaseSelect.ItemIndicator>
			<BaseSelect.ItemText>{children}</BaseSelect.ItemText>
		</BaseSelect.Item>
	);
}

import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

interface TabsProps {
	children: React.ReactNode;
	defaultValue?: string;
	value?: string;
	onValueChange?: (value: string) => void;
	className?: string;
}

export function Tabs({
	children,
	defaultValue,
	value,
	onValueChange,
	className,
}: TabsProps) {
	return (
		<BaseTabs.Root
			defaultValue={defaultValue}
			value={value}
			onValueChange={onValueChange}
			className={className}
		>
			{children}
		</BaseTabs.Root>
	);
}

interface TabsListProps {
	children: React.ReactNode;
	className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
	return (
		<BaseTabs.List
			className={cn(
				"relative inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground border",
				className,
			)}
		>
			{children}
			<TabsIndicator />
		</BaseTabs.List>
	);
}

interface TabsTriggerProps {
	children: React.ReactNode;
	value: string;
	className?: string;
	disabled?: boolean;
}

export function TabsTrigger({
	children,
	value,
	className,
	disabled,
}: TabsTriggerProps) {
	return (
		<BaseTabs.Tab
			value={value}
			disabled={disabled}
			className={cn(
				"relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				"disabled:pointer-events-none disabled:opacity-50",
				"data-active:text-foreground",
				className,
			)}
		>
			{children}
		</BaseTabs.Tab>
	);
}

function TabsIndicator() {
	return (
		<BaseTabs.Indicator
			className={cn(
				"absolute rounded-md bg-background shadow-sm transition-all duration-200",
				"top-[var(--active-tab-top)] left-[var(--active-tab-left)]",
				"h-[var(--active-tab-height)] w-[var(--active-tab-width)]",
			)}
		/>
	);
}

interface TabsContentProps {
	children: React.ReactNode;
	value: string;
	className?: string;
}

export function TabsContent({ children, value, className }: TabsContentProps) {
	return (
		<BaseTabs.Panel
			value={value}
			className={cn(
				"mt-2 ring-offset-background focus-visible:outline-none",
				className,
			)}
		>
			{children}
		</BaseTabs.Panel>
	);
}

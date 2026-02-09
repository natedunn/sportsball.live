import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

// Context to pass value/onValueChange from Tabs down to the responsive TabsMenu
const TabsContext = React.createContext<{
	value?: string;
	onValueChange?: (value: string) => void;
} | null>(null);

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
		<TabsContext.Provider value={{ value, onValueChange }}>
			<BaseTabs.Root
				defaultValue={defaultValue}
				value={value}
				onValueChange={onValueChange}
				className={className}
			>
				{children}
			</BaseTabs.Root>
		</TabsContext.Provider>
	);
}

interface TabsListProps {
	children: React.ReactNode;
	className?: string;
	/** When true, collapses to a dropdown menu on small screens. Default: true */
	responsive?: boolean;
}

export function TabsList({
	children,
	className,
	responsive = true,
}: TabsListProps) {
	if (!responsive) {
		return (
			<BaseTabs.List
				className={cn(
					"relative inline-flex h-11 items-center justify-center rounded-lg bg-muted p-1.5 text-muted-foreground border",
					className,
				)}
			>
				{children}
				<TabsIndicator />
			</BaseTabs.List>
		);
	}

	return (
		<>
			{/* Desktop: normal tabs */}
			<BaseTabs.List
				className={cn(
					"relative hidden sm:inline-flex h-11 items-center justify-center rounded-lg bg-muted p-1.5 text-muted-foreground border",
					className,
				)}
			>
				{children}
				<TabsIndicator />
			</BaseTabs.List>

			{/* Mobile: menu dropdown */}
			<div className="sm:hidden">
				<TabsMenu>{children}</TabsMenu>
			</div>
		</>
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
				"data-active:text-amber-50",
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
				"absolute rounded-md bg-foreground/10 shadow-sm transition-all duration-200",
				"top-(--active-tab-top) left-(--active-tab-left)",
				"h-(--active-tab-height) w-(--active-tab-width)",
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

// --- Responsive menu fallback (mobile) ---

/** Extracts tab info from TabsTrigger children */
function extractTabs(
	children: React.ReactNode,
): Array<{ value: string; label: React.ReactNode }> {
	const tabs: Array<{ value: string; label: React.ReactNode }> = [];
	React.Children.forEach(children, (child) => {
		if (React.isValidElement<TabsTriggerProps>(child) && child.props.value) {
			tabs.push({ value: child.props.value, label: child.props.children });
		}
	});
	return tabs;
}

function TabsMenu({ children }: { children: React.ReactNode }) {
	const context = React.useContext(TabsContext);
	const tabs = extractTabs(children);
	const activeTab = tabs.find((t) => t.value === context?.value);

	return (
		<BaseMenu.Root>
			<BaseMenu.Trigger
				className={cn(
					"inline-flex h-11 items-center justify-between gap-2 rounded-lg bg-muted px-4 py-1.5 text-sm font-medium text-amber-50 border min-w-40",
					"hover:bg-foreground/5 transition-colors cursor-pointer",
				)}
			>
				<span className="flex items-center gap-1.5">
					{activeTab?.label ?? "Select"}
				</span>
				<ChevronDown className="h-4 w-4 text-muted-foreground" />
			</BaseMenu.Trigger>
			<BaseMenu.Portal>
				<BaseMenu.Positioner
					side="bottom"
					align="start"
					sideOffset={4}
					className="z-50"
				>
					<BaseMenu.Popup
						className={cn(
							"z-50 min-w-40 rounded-lg border border-border bg-popover p-1 shadow-lg outline-none",
							"origin-(--transform-origin) will-change-[transform,opacity] transition-[transform,opacity] duration-150 ease-out",
							"data-ending-style:scale-95 data-ending-style:opacity-0",
							"data-starting-style:scale-95 data-starting-style:opacity-0",
						)}
					>
						{tabs.map((tab) => (
							<BaseMenu.Item
								key={tab.value}
								onClick={() => context?.onValueChange?.(tab.value)}
								className={cn(
									"relative flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none transition-colors",
									"hover:bg-accent focus:bg-accent",
									tab.value === context?.value &&
										"text-amber-50 bg-foreground/10",
								)}
							>
								{tab.label}
							</BaseMenu.Item>
						))}
					</BaseMenu.Popup>
				</BaseMenu.Positioner>
			</BaseMenu.Portal>
		</BaseMenu.Root>
	);
}

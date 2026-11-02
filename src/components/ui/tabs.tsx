import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export type TabsSize = "default" | "sm";

const tabsVariants = {
	list: {
		default: "h-11 p-1.5",
		sm: "h-9 p-1",
	},
	trigger: {
		default: "px-3 py-1.5",
		sm: "px-2.5 py-1",
	},
	menuTrigger: {
		default: "h-11",
		sm: "h-9",
	},
};

// Context to pass value/onValueChange and size from Tabs down to the list,
// triggers and the responsive TabsMenu
const TabsContext = React.createContext<{
	value?: string;
	onValueChange?: (value: string) => void;
	size: TabsSize;
} | null>(null);

function useTabsSize(): TabsSize {
	return React.useContext(TabsContext)?.size ?? "default";
}

interface TabsProps {
	children: React.ReactNode;
	defaultValue?: string;
	value?: string;
	onValueChange?: (value: string) => void;
	className?: string;
	size?: TabsSize;
}

export function Tabs({
	children,
	defaultValue,
	value,
	onValueChange,
	className,
	size = "default",
}: TabsProps) {
	return (
		<TabsContext.Provider value={{ value, onValueChange, size }}>
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
	/** Classes for the active-tab indicator, such as rounding to match `className` */
	indicatorClassName?: string;
}

export function TabsList({
	children,
	className,
	responsive = true,
	indicatorClassName,
}: TabsListProps) {
	const size = useTabsSize();

	if (!responsive) {
		return (
			<BaseTabs.List
				className={cn(
					"relative inline-flex items-center justify-center rounded-lg bg-muted text-muted-foreground border",
					tabsVariants.list[size],
					className,
				)}
			>
				{children}
				<TabsIndicator className={indicatorClassName} />
			</BaseTabs.List>
		);
	}

	return (
		<>
			{/* Desktop: normal tabs */}
			<BaseTabs.List
				className={cn(
					"relative hidden sm:inline-flex items-center justify-center rounded-lg bg-muted text-muted-foreground border",
					tabsVariants.list[size],
					className,
				)}
			>
				{children}
				<TabsIndicator className={indicatorClassName} />
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
	/** Render the tab as another element, such as a router `<Link>`, so it navigates */
	render?: React.ReactElement;
}

export function TabsTrigger({
	children,
	value,
	className,
	disabled,
	render,
}: TabsTriggerProps) {
	const size = useTabsSize();

	return (
		<BaseTabs.Tab
			value={value}
			disabled={disabled}
			render={render}
			nativeButton={!render}
			className={cn(
				"relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all",
				tabsVariants.trigger[size],
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				"disabled:pointer-events-none disabled:opacity-50",
				"hover:text-foreground data-active:text-amber-50 data-active:[&_svg]:text-amber-500",
				className,
			)}
		>
			{children}
		</BaseTabs.Tab>
	);
}

function TabsIndicator({ className }: { className?: string }) {
	return (
		<BaseTabs.Indicator
			className={cn(
				"absolute rounded-md border border-border bg-linear-to-b from-foreground/9 to-foreground/7 shadow-sm transition-all duration-200",
				"top-(--active-tab-top) left-(--active-tab-left)",
				"h-(--active-tab-height) w-(--active-tab-width)",
				className,
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
): Array<{ value: string; label: React.ReactNode; render?: React.ReactElement }> {
	const tabs: Array<{
		value: string;
		label: React.ReactNode;
		render?: React.ReactElement;
	}> = [];
	React.Children.forEach(children, (child) => {
		if (React.isValidElement<TabsTriggerProps>(child) && child.props.value) {
			tabs.push({
				value: child.props.value,
				label: child.props.children,
				render: child.props.render,
			});
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
					"inline-flex items-center justify-between gap-2 rounded-lg bg-muted px-4 py-1.5 text-sm font-medium text-amber-50 border min-w-40",
					tabsVariants.menuTrigger[context?.size ?? "default"],
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
								render={tab.render}
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

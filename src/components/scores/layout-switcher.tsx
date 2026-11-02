import { LayoutGrid, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	isScoresLayout,
	type ScoresLayout,
} from "@/lib/scores-layout";

const LAYOUT_OPTIONS: Array<{
	layout: ScoresLayout;
	label: string;
	icon: typeof Rows3;
}> = [
	{ layout: "list", label: "List", icon: Rows3 },
	{ layout: "grid", label: "Grid", icon: LayoutGrid },
];

interface LayoutSwitcherProps {
	value: ScoresLayout;
	onChange: (layout: ScoresLayout) => void;
	className?: string;
}

export function LayoutSwitcher({ value, onChange, className }: LayoutSwitcherProps) {
	return (
		<div className={cn("flex items-center", className)}>
			<Tabs
				value={value}
				onValueChange={(next) => isScoresLayout(next) && onChange(next)}
				size="sm"
			>
				<TabsList responsive={false}>
					{LAYOUT_OPTIONS.map(({ layout, label, icon: Icon }) => (
						<TabsTrigger key={layout} value={layout} className="gap-1.5">
							<Icon className="size-4" />
							{label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
		</div>
	);
}

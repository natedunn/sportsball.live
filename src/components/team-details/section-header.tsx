import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SectionHeaderProps {
	icon?: LucideIcon;
	title: string;
	badge?: ReactNode;
	action?: ReactNode;
}

export function SectionHeader({ icon: Icon, title, badge, action }: SectionHeaderProps) {
	return (
		<div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
			<h2 className="text-lg font-semibold flex items-center gap-2">
				{Icon && <Icon className="size-4.5 text-muted-foreground" />}
				{title}
				{badge}
			</h2>
			{action}
		</div>
	);
}

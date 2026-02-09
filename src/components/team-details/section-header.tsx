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
		<div className="flex items-center justify-between mb-4">
			<h2 className="text-lg font-semibold flex items-center gap-2">
				{Icon && <Icon className="size-4.5 text-muted-foreground" />}
				{title}
				{badge}
			</h2>
			{action}
		</div>
	);
}

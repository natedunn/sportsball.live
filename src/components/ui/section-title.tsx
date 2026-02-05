import { cn } from "@/lib/utils";

interface SectionTitleProps {
	children: React.ReactNode;
	icon?: React.ComponentType<{ className?: string }>;
	className?: string;
	id?: string;
}

export function SectionTitle({ children, icon: Icon, className, id }: SectionTitleProps) {
	return (
		<h2 id={id} className={cn("inline-flex items-center gap-2 text-lg font-semibold", className)}>
			{Icon && <Icon className="size-5 text-muted-foreground" aria-hidden="true" />}
			{children}
		</h2>
	);
}

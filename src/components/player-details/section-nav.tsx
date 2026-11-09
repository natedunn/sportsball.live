import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface PageSection {
	id: string;
	label: string;
}

/** The section nearest the top of the viewport */
function useActiveSection(ids: readonly string[]) {
	const [active, setActive] = useState<string>(ids[0]);
	useEffect(() => {
		const visible = new Set<string>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) visible.add(entry.target.id);
					else visible.delete(entry.target.id);
				}
				const first = ids.find((id) => visible.has(id));
				if (first) setActive(first);
			},
			// A band across the upper part of the screen
			{ rootMargin: "-10% 0px -55% 0px" },
		);
		for (const id of ids) {
			const element = document.getElementById(id);
			if (element) observer.observe(element);
		}
		// The last section can be too short to reach the band, so the bottom of
		// the page selects it
		const onScroll = () => {
			const atBottom =
				window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
			if (atBottom && ids.length > 0) setActive(ids[ids.length - 1]);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			observer.disconnect();
			window.removeEventListener("scroll", onScroll);
		};
	}, [ids]);
	return active;
}

/** "On this page" links for a sidebar. `sections` must be a stable array */
export function SectionNav({
	sections,
	color,
	label,
}: {
	sections: readonly PageSection[];
	/** The active link's accent */
	color: string;
	/** Names the nav for screen readers */
	label: string;
}) {
	const ids = useMemo(() => sections.map((section) => section.id), [sections]);
	const active = useActiveSection(ids);
	return (
		<nav aria-label={label} className="space-y-1.5">
			<h3 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
				On this page
			</h3>
			<ul className="flex flex-col">
				{sections.map((section) => {
					const isActive = section.id === active;
					return (
						<li key={section.id}>
							<a
								href={`#${section.id}`}
								aria-current={isActive ? "location" : undefined}
								onClick={(event) => {
									event.preventDefault();
									document
										.getElementById(section.id)
										?.scrollIntoView({ behavior: "smooth", block: "start" });
								}}
								className={cn(
									"relative block rounded-md px-3 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									isActive
										? "bg-muted font-medium text-foreground"
										: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
								)}
							>
								{isActive && (
									<span
										className="absolute inset-y-1.5 left-0 w-0.5 rounded-full"
										style={{ backgroundColor: color }}
										aria-hidden
									/>
								)}
								{section.label}
							</a>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

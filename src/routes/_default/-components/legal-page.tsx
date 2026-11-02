/** Shared layout for the privacy policy and cookies pages. */
export function LegalPage({
	title,
	updated,
	children,
}: {
	title: string;
	/** Shown as "Last updated …" */
	updated: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<div className="bg-gradient-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
				<div className="flex flex-col items-center justify-between gap-2">
					<h1 className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
						{title}
					</h1>
					<p className="text-sm text-muted-foreground">Last updated {updated}</p>
				</div>
			</div>
			<div className="container max-w-2xl">
				<div className="flex flex-col gap-8">{children}</div>
			</div>
		</div>
	);
}

export function LegalSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-xl font-semibold">{title}</h2>
			<div className="flex flex-col gap-3 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a:hover]:no-underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
				{children}
			</div>
		</section>
	);
}

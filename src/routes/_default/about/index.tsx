import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_default/about/")({
	component: AboutPage,
});

function AboutPage() {
	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<div className="bg-gradient-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
				<div className="flex flex-col items-center justify-between gap-4">
					<h1 className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
						About
					</h1>
				</div>
			</div>
			<div className="container max-w-2xl">
				<div className="flex flex-col gap-8">
					<section className="flex flex-col gap-3">
						<p className="text-muted-foreground">
							Sportsball™ is made by an indie developer.
						</p>
						<p>
							<a
								href="https://github.com/natedunn"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary underline hover:no-underline"
							>
								github.com/natedunn
							</a>
						</p>
					</section>

					<section className="flex flex-col gap-3">
						<h2 className="text-xl font-semibold">Support</h2>
						<p className="text-muted-foreground">
							If you enjoy using Sportsball, consider leaving a tip.
						</p>
						<p>
							<a
								href="https://ko-fi.com/natedunn"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary underline hover:no-underline"
							>
								Buy me a coffee on Ko-fi
							</a>
						</p>
					</section>

					<section className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
						<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
							Data Attribution
						</h2>
						<p className="text-sm text-muted-foreground">
							Data sourced from ESPN. This app is not affiliated with or
							endorsed by ESPN, the NBA, WNBA, or G League.
						</p>
					</section>
				</div>
			</div>
		</div>
	);
}

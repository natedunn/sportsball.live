import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DitheredBasketball } from "./-components/dithered-basketball";
import { useIsDarkMode } from "@/lib/use-is-dark-mode";
import { getButtonClasses } from "@/components/ui/button";

export const Route = createFileRoute("/_default/")({
	component: HomePage,
});

function BasketballBackground() {
	const [isClient, setIsClient] = useState(false);
	const isDarkMode = useIsDarkMode();

	useEffect(() => {
		setIsClient(true);
	}, []);

	if (!isClient) return null;

	// Use darker orange in light mode for better visibility
	const basketballColor = isDarkMode ? "#f97316" : "#9f2d00";

	return (
		<div className="pointer-events-none absolute -top-96 left-1/2 -translate-x-1/2 opacity-30 dark:opacity-40">
			<DitheredBasketball
				style={{ width: 800, height: 800 }}
				color={basketballColor}
			/>
		</div>
	);
}

function HomePage() {
	return (
		<div className="container relative flex flex-col items-center py-16 lg:py-24">
			<BasketballBackground />
			<div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
				<span className="mb-4 inline-flex items-center gap-2 rounded-full dark:bg-orange-500/50 bg-orange-500/50 px-3 py-1 text-sm font-medium text-orange-800 dark:text-orange-100">
					<span>•</span> Now in Beta
				</span>
				<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight sm:text-5xl">
					The home court
					<br />
					<span className="text-amber-700 dark:text-orange-500">
						for ball knowers
					</span>
				</h1>
				<p className="mt-6 max-w-lg text-muted-foreground">
					No ads. No paywall. No bullshit. Just league scores, stats, news, and
					more.
				</p>
				<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
					<Link to="/nba" className={getButtonClasses("default", "lg")}>
						NBA
					</Link>
					<Link to="/wnba" className={getButtonClasses("outline", "lg")}>
						WNBA
					</Link>
				</div>

				<div className="mt-16 border-t border-border pt-18">
					<p className="text-sm text-muted-foreground">
						Free and open source. Built by a solo dev who just loves hoops.
					</p>
					<div className="mt-4 flex flex-wrap items-center justify-center gap-4">
						<a
							href="https://github.com/sportsball-live"
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm text-muted-foreground hover:text-foreground hover:underline"
						>
							GitHub
						</a>
						<span className="text-muted-foreground/50">·</span>
						<a
							href="https://ko-fi.com/natedunn"
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm text-muted-foreground hover:text-foreground hover:underline"
						>
							Buy me a coffee
						</a>
					</div>
				</div>
			</div>
		</div>
	);
}

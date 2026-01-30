import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DitheredBasketball } from "./-components/dithered-basketball";
import { useIsDarkMode } from "@/lib/use-is-dark-mode";
import { getButtonClasses } from "@/components/ui/button";
import { Scoreboard } from "@/components/scores/scoreboard";
import { todayGamesQueryOptions } from "@/lib/all-leagues/today-games.queries";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

function useScrollEffects(
	ballRef: React.RefObject<HTMLDivElement | null>,
	headerRef: React.RefObject<HTMLDivElement | null>,
	cardRef: React.RefObject<HTMLDivElement | null>,
	isDarkMode: boolean,
) {
	useEffect(() => {
		let ticking = false;

		const updateStyles = () => {
			const scrollY = window.scrollY;
			const maxScroll = 400;
			const cardThreshold = 200;

			// Parallax for basketball (moves at 0.3x scroll speed)
			if (ballRef.current) {
				const parallaxY = scrollY * 0.3;
				ballRef.current.style.transform = `translateY(${parallaxY}px)`;
			}

			// Fade out header content
			if (headerRef.current) {
				const opacity = Math.max(0, 1 - scrollY / maxScroll);
				headerRef.current.style.opacity = String(opacity);
			}

			// Card shadow on scroll
			if (cardRef.current) {
				const linearProgress = Math.min(
					1,
					Math.max(0, (scrollY - 100) / cardThreshold),
				);
				const progress = linearProgress * linearProgress * linearProgress;

				// Dark mode needs much stronger shadows to be visible
				const multiplier = isDarkMode ? 3 : 1;
				const shadowOpacity1 = progress * 0.08 * multiplier;
				const shadowOpacity2 = progress * 0.12 * multiplier;
				const shadowOpacity3 = progress * 0.06 * multiplier;
				cardRef.current.style.boxShadow = `0 1px 2px rgba(0, 0, 0, ${shadowOpacity1}), 0 4px 12px rgba(0, 0, 0, ${shadowOpacity2}), 0 16px 40px rgba(0, 0, 0, ${shadowOpacity3})`;
			}
		};

		const handleScroll = () => {
			if (!ticking) {
				requestAnimationFrame(() => {
					updateStyles();
					ticking = false;
				});
				ticking = true;
			}
		};

		// Set initial state
		updateStyles();

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, [ballRef, headerRef, cardRef, isDarkMode]);
}

export const Route = createFileRoute("/_default/")({
	component: HomePage,
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(todayGamesQueryOptions()),
});

function BasketballBackground({
	ballRef,
}: {
	ballRef: React.RefObject<HTMLDivElement | null>;
}) {
	const [isClient, setIsClient] = useState(false);
	const isDarkMode = useIsDarkMode();

	useEffect(() => {
		setIsClient(true);
	}, []);

	if (!isClient) return null;

	// Use darker orange in light mode for better visibility
	const basketballColor = isDarkMode ? "#f97316" : "#7b3306";

	return (
		<div className="pointer-events-none absolute -top-96 left-1/2 -translate-x-1/2 opacity-30 dark:opacity-40">
			<div ref={ballRef} className="will-change-transform">
				<DitheredBasketball
					style={{ width: 800, height: 800 }}
					color={basketballColor}
				/>
			</div>
		</div>
	);
}

function TodayGames() {
	const { data } = useSuspenseQuery(todayGamesQueryOptions());

	if (data.totalGames === 0) {
		return (
			<div className="text-center">
				<p className="text-lg text-muted-foreground">
					No scheduled games today. I guess we have to go touch grass.
				</p>
			</div>
		);
	}

	// Flatten all games and sort by start time
	const allGames = data.leagues
		.flatMap((leagueData) =>
			leagueData.games.map((game) => ({
				game,
				league: leagueData.league,
			})),
		)
		.sort((a, b) => {
			const timeA = a.game.time.start
				? new Date(a.game.time.start).getTime()
				: 0;
			const timeB = b.game.time.start
				? new Date(b.game.time.start).getTime()
				: 0;
			return timeA - timeB;
		});

	return (
		<div className="w-full space-y-3">
			{allGames.map(({ game, league }) => (
				<Scoreboard key={game.id} game={game} league={league} showLeagueTag />
			))}
		</div>
	);
}

function HomePage() {
	const ballRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const isDarkMode = useIsDarkMode();

	useScrollEffects(ballRef, headerRef, cardRef, isDarkMode);

	return (
		<div className="container relative flex flex-col items-center py-16 lg:py-24">
			<BasketballBackground ballRef={ballRef} />
			<div className="relative mx-auto flex w-full max-w-2xl flex-col items-center text-center">
				<div
					ref={headerRef}
					className="w-full relative flex flex-col items-center text-center will-change-[opacity]"
				>
					<span className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-500/50 px-3 py-1 text-sm font-medium text-orange-800 dark:bg-orange-500/50 dark:text-orange-100">
						<span>•</span> Now in Beta
					</span>
					<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight sm:text-5xl">
						The home court
						<br />
						<span className="text-amber-700 dark:text-orange-500">
							for ball knowers
						</span>
					</h1>
					<p className="mt-6 max-w-lg">
						No ads. No paywall. No bullshit. Just league scores, stats, news,
						and more.
					</p>
					<div className="absolute bottom-0 w-full h-48 -mb-24 bg-gradient-to-b from-transparent to-background"></div>
				</div>
				<div className="sticky top-3 z-50 mt-8 flex justify-center">
					<Card
						ref={cardRef}
						classNames={{
							wrapper: "rounded-full will-change-[box-shadow]",
							inner: "px-3 py-2 rounded-full items-center gap-5",
						}}
					>
						<div className="ml-2 flex shrink-0 items-center gap-2 whitespace-nowrap text-muted-foreground">
							Choose a league <ArrowRight size={18} />
						</div>
						<div className="flex items-center gap-2">
							<Link
								className={cn(
									getButtonClasses("outline", "sm"),
									"rounded-full",
								)}
								to="/nba"
							>
								NBA
							</Link>
							<Link
								className={cn(
									getButtonClasses("outline", "sm"),
									"rounded-full",
								)}
								to="/wnba"
							>
								WNBA
							</Link>
							<Link
								className={cn(
									getButtonClasses("outline", "sm"),
									"rounded-full",
								)}
								to="/gleague"
							>
								G League
							</Link>
						</div>
					</Card>
				</div>

				<div className="mt-8 flex w-full items-center justify-center gap-4">
					<div className="hidden h-px flex-1 bg-border min-[480px]:block" />
					<span className="shrink-0 text-sm text-muted-foreground">
						Or view today's games
					</span>
					<div className="hidden h-px flex-1 bg-border min-[480px]:block" />
				</div>

				<div className="mt-8 w-full">
					<TodayGames />
				</div>

				<div className="px-4 text-left w-full mt-24">
					<h2>
						A project by
						<img
							className="mx-4 inline-block aspect-square size-12 -rotate-6 rounded-lg bg-center object-cover"
							src={`https://pbs.twimg.com/profile_images/1658990770299232260/lqSKQU6d_400x400.jpg`}
							alt=""
							height={150}
							width={150}
							aria-hidden
						/>
						Nate Dunn
					</h2>
					<div className="mt-2 space-y-2 text-muted-foreground">
						<p>
							Sportsball is a free and open source project maybe by a single
							indie developer.
						</p>
						<div className="flex items-center gap-2">
							<a
								href="https://github.com/sportsball-live"
								target="_blank"
								rel="noopener noreferrer"
								className="link-text"
							>
								GitHub
							</a>
							<span className="text-muted-foreground/50">·</span>
							<a
								href="https://ko-fi.com/natedunn"
								target="_blank"
								rel="noopener noreferrer"
								className="link-text"
							>
								Buy me a coffee
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

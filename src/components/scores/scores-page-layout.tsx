import { useEffect, useRef, useMemo, useState } from "react";
import { useQueryClient, type FetchQueryOptions } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { DatePagination } from "./date-pagination";
import { LayoutSwitcher } from "./layout-switcher";
import { Scoreboard } from "./scoreboard";
import { cn } from "@/lib/utils";
import { storeScoresLayout, type ScoresLayout } from "@/lib/scores-layout";
import { SeasonalNotice } from "./seasonal-notice";
import { formatDate, moveDate } from "@/lib/date";
import { useFavorites } from "@/lib/use-favorites";
import type { GameData } from "@/lib/types";
import type { League } from "@/lib/shared/league";

interface ScoresPageLayoutProps {
	games: GameData[];
	league: League;
	currentDate: string;
	formattedDate: string;
	title: string;
	description: string;
	queryOptions: (date: string) => FetchQueryOptions<any, any, any, any>;
	cacheKeyPrefix: string;
	/** Saved layout, read by the route loader so SSR matches the client */
	initialLayout: ScoresLayout;
}

export function ScoresPageLayout({
	games,
	league,
	currentDate,
	formattedDate,
	title,
	description,
	queryOptions,
	cacheKeyPrefix,
	initialLayout,
}: ScoresPageLayoutProps) {
	const { isFavorited } = useFavorites();
	const [layout, setLayout] = useState(initialLayout);

	const handleLayoutChange = (next: ScoresLayout) => {
		setLayout(next);
		storeScoresLayout(next);
	};
	const prevDateRef = useRef<string>(formattedDate);
	const directionRef = useRef<"next" | "previous">("next");

	if (prevDateRef.current !== formattedDate) {
		directionRef.current =
			formattedDate > prevDateRef.current ? "next" : "previous";
	}

	useEffect(() => {
		prevDateRef.current = formattedDate;
	}, [formattedDate]);

	const direction = directionRef.current;

	const queryClient = useQueryClient();

	// Sort games: favorites first, then others
	const { favoriteGames, otherGames } = useMemo(() => {
		const favGames: GameData[] = [];
		const other: GameData[] = [];

		for (const game of games) {
			const homeIsFavorite = isFavorited(league, game.home.id);
			const awayIsFavorite = isFavorited(league, game.away.id);

			if (homeIsFavorite || awayIsFavorite) {
				favGames.push(game);
			} else {
				other.push(game);
			}
		}

		return { favoriteGames: favGames, otherGames: other };
	}, [games, league, isFavorited]);

	useEffect(() => {
		const prefetchWithDelay = (date: string, delayMs: number) => {
			const formatted = formatDate(date, "YYYYMMDD");
			const cached = queryClient.getQueryData([
				cacheKeyPrefix,
				"games",
				formatted,
			]);
			if (!cached) {
				setTimeout(() => {
					queryClient.prefetchQuery(queryOptions(formatted));
				}, delayMs);
			}
		};

		let nextDate = currentDate;
		let prevDate = currentDate;

		for (let i = 0; i < 5; i++) {
			nextDate = moveDate(nextDate, "next");
			prevDate = moveDate(prevDate, "prev");
			const delay = (i + 1) * 100;
			prefetchWithDelay(nextDate, delay);
			prefetchWithDelay(prevDate, delay);
		}
	}, [currentDate, queryClient, queryOptions, cacheKeyPrefix]);

	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<div className="bg-linear-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
				<div className="flex flex-col items-center justify-between gap-2 px-4 text-center">
					<h1 className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
						{title}
					</h1>
					<p className="text-muted-foreground/50">{description}</p>
				</div>
			</div>
			<div className="container">
				<SeasonalNotice league={league} className="mb-4" />
				<div className="flex flex-col gap-4">
					<div className="flex flex-wrap items-center justify-center gap-2 border-b border-border pb-4 sm:justify-between">
						<DatePagination date={currentDate} league={league} />
						{/* Every layout is one column below md, so only offer it from md up */}
						<LayoutSwitcher
							value={layout}
							onChange={handleLayoutChange}
							className="max-md:hidden"
						/>
					</div>
					<AnimatePresence mode="wait" custom={direction} initial={false}>
						<motion.div
							key={formattedDate}
							custom={direction}
							variants={{
								initial: (dir: "next" | "previous") => ({
									opacity: 0,
									scale: dir === "next" ? 0.98 : 1.02,
									y: dir === "next" ? 12 : -12,
								}),
								animate: {
									opacity: 1,
									scale: 1,
									y: 0,
								},
								exit: (dir: "next" | "previous") => ({
									opacity: 0,
									scale: dir === "previous" ? 0.98 : 1.02,
									y: dir === "previous" ? 12 : -12,
								}),
							}}
							initial="initial"
							animate="animate"
							exit="exit"
							transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
						>
							{games.length > 0 ? (
								<div className="flex flex-col w-full gap-6">
									{/* Favorite teams' games */}
									<GameGroup
										games={favoriteGames}
										layout={layout}
										currentDate={currentDate}
										league={league}
									/>

									{/* Divider between favorites and others */}
									{favoriteGames.length > 0 && otherGames.length > 0 && (
										<div className="flex items-center gap-4 py-2">
											<div className="h-px flex-1 bg-border" />
											<span className="text-xs text-muted-foreground">
												Other games
											</span>
											<div className="h-px flex-1 bg-border" />
										</div>
									)}

									{/* Other games */}
									<GameGroup
										games={otherGames}
										layout={layout}
										currentDate={currentDate}
										league={league}
									/>
								</div>
							) : (
								<div className="flex flex-col items-center justify-center gap-4">
									<div className="mt-4 text-lg text-muted-foreground/50">
										No games scheduled
									</div>
								</div>
							)}
						</motion.div>
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}

function GameGroup({
	games,
	layout,
	currentDate,
	league,
}: {
	games: GameData[];
	layout: ScoresLayout;
	currentDate: string;
	league: League;
}) {
	if (games.length === 0) return null;

	return (
		<div
			className={cn(
				"grid gap-4",
				layout === "grid" ? "md:grid-cols-2" : "gap-6",
			)}
		>
			{games.map((game) => (
				<Scoreboard
					key={game.id}
					game={game}
					currentDate={currentDate}
					league={league}
					variant={layout === "grid" ? "compact" : "list"}
				/>
			))}
		</div>
	);
}

export function ScoresPagePending({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<div className="bg-linear-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
				<div className="flex flex-col items-center justify-between gap-2 px-4 text-center">
					<h1 className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
						{title}
					</h1>
					<p className="text-muted-foreground/50">{description}</p>
				</div>
			</div>
		</div>
	);
}

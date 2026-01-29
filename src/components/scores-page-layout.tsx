import { useEffect, useRef } from "react";
import { useQueryClient, type FetchQueryOptions } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { DatePagination } from "@/components/date-pagination";
import { Scoreboard } from "@/components/scoreboard";
import { formatDate, moveDate } from "@/lib/date";
import type { GameData } from "@/lib/types";

type League = "nba" | "wnba" | "gleague";

interface ScoresPageLayoutProps {
	games: GameData[];
	league: League;
	currentDate: string;
	formattedDate: string;
	title: string;
	description: string;
	queryOptions: (date: string) => FetchQueryOptions<any, any, any, any>;
	cacheKeyPrefix: string;
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
}: ScoresPageLayoutProps) {
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
				<div className="flex flex-col items-center justify-between gap-2">
					<h1 className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
						{title}
					</h1>
					<p className="text-muted-foreground/50">{description}</p>
				</div>
			</div>
			<div className="mx-auto w-full max-w-180">
				<div className="flex flex-col gap-4">
					<div className="flex justify-center">
						<DatePagination date={currentDate} league={league} />
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
									{games.map((game) => (
										<Scoreboard
											key={game.id}
											game={game}
											currentDate={currentDate}
											league={league}
										/>
									))}
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
				<div className="flex flex-col items-center justify-between gap-2">
					<h1 className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
						{title}
					</h1>
					<p className="text-muted-foreground/50">{description}</p>
				</div>
			</div>
		</div>
	);
}

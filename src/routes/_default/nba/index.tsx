import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { DatePagination } from "@/components/date-pagination";
import { Scoreboard } from "@/components/scoreboard";
import { formatDate } from "@/lib/date";
import { nbaGamesQueryOptions } from "@/lib/nba/games.queries";

interface NbaSearchParams {
	date?: string;
}

export const Route = createFileRoute("/_default/nba/")({
	validateSearch: (search: Record<string, unknown>): NbaSearchParams => {
		return {
			date: typeof search.date === "string" ? search.date : undefined,
		};
	},
	loaderDeps: ({ search: { date } }) => ({ date }),
	loader: async ({ context, deps }) => {
		const currentDate = deps.date ?? formatDate(new Date(), "YYYY-MM-DD");
		const formattedDate = formatDate(currentDate, "YYYYMMDD");

		await context.queryClient.ensureQueryData(
			nbaGamesQueryOptions(formattedDate)
		);
	},
	component: NbaPage,
});

function NbaPage() {
	const { date } = Route.useSearch();
	const currentDate = date ?? formatDate(new Date(), "YYYY-MM-DD");
	const formattedDate = formatDate(currentDate, "YYYYMMDD");

	const { data: games = [], isFetching } = useQuery(nbaGamesQueryOptions(formattedDate));

	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<div className="bg-gradient-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
				<div className="flex flex-col items-center justify-between gap-2">
					<h1 className="scroll-m-20 text-3xl font-extrabold tracking-tight lg:text-4xl">
						Daily NBA scores
					</h1>
					<p className="text-muted-foreground/50">
						View current, upcoming, and past games for the NBA.
					</p>
				</div>
			</div>
			<div className="container">
				<div className="flex flex-col gap-4">
					<div className="flex justify-center">
						<DatePagination date={currentDate} />
					</div>
					<AnimatePresence mode="wait">
						{!isFetching && (
							<motion.div
								key={formattedDate}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.15 }}
							>
								{games.length > 0 ? (
									<div className="flex w-full flex-col gap-4">
										{games.map((game) => (
											<Scoreboard key={game.id} game={game} />
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
						)}
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}

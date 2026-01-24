import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../convex/_generated/api";
import { DatePagination } from "@/components/date-pagination";
import { Scoreboard } from "@/components/scoreboard";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/date";
import type { GameData } from "@/lib/types";

interface NbaSearchParams {
	date?: string;
}

export const Route = createFileRoute("/_default/nba/")({
	validateSearch: (search: Record<string, unknown>): NbaSearchParams => {
		return {
			date: typeof search.date === "string" ? search.date : undefined,
		};
	},
	component: NbaPage,
});

function NbaPage() {
	const { date } = Route.useSearch();
	const currentDate = date ?? formatDate(new Date(), "YYYY-MM-DD");
	const formattedDate = formatDate(currentDate, "YYYYMMDD");

	const getGamesByDate = useAction(api.nba.games.getGamesByDate);

	const {
		data: games,
		isLoading,
		isError,
		error,
	} = useQuery({
		queryKey: ["nbaGamesByDate", formattedDate],
		queryFn: async () => {
			const result = await getGamesByDate({ date: formattedDate });
			return result as GameData[];
		},
		refetchInterval: 10 * 1000, // Refresh every 10 seconds for live games
	});

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
					{isLoading ? (
						<Card
							classNames={{
								wrapper:
									"text-2xl font-bold text-muted-foreground text-muted-foreground/50",
								inner: "p-6 justify-center",
							}}
						>
							Loading games...
						</Card>
					) : isError ? (
						<div className="flex flex-col items-center justify-center gap-4">
							<div className="text-red-500">Error loading games</div>
							<div className="text-gray-500">{error?.message}</div>
						</div>
					) : games && games.length > 0 ? (
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
				</div>
			</div>
		</div>
	);
}

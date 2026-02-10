import { createFileRoute } from "@tanstack/react-router";
import { useQuery, type FetchQueryOptions } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { formatDate } from "@/lib/date";
import { convexScoreboardToGameData } from "@/lib/shared/convex-adapters";
import { syncGamesForView } from "@/lib/shared/sync.server";
import {
	ScoresPageLayout,
	ScoresPagePending,
} from "@/components/scores/scores-page-layout";

const TITLE = "NBA Scores & Schedule";
const DESCRIPTION = "Live scores, results, and upcoming games for the NBA.";

interface NbaSearchParams {
	date?: string;
}

const LIVE_REFRESH_INTERVAL_MS = 30_000;

const scoreboardQuery = (date: string) =>
	convexQuery(api.nba.queries.getScoreboard, { gameDate: date });

export const Route = createFileRoute("/_default/nba/scores")({
	validateSearch: (search: Record<string, unknown>): NbaSearchParams => {
		return {
			date: typeof search.date === "string" ? search.date : undefined,
		};
	},
	loaderDeps: ({ search: { date } }) => ({ date }),
	loader: async ({ context, deps }) => {
		const currentDate = deps.date ?? formatDate(new Date(), "YYYY-MM-DD");
		const formattedDate = formatDate(currentDate, "YYYYMMDD");
		const today = formatDate(new Date(), "YYYYMMDD");

		const rawGames = await context.queryClient.ensureQueryData(
			scoreboardQuery(formattedDate),
		);
		const gamesForSync = (rawGames ?? []) as Array<{
			espnGameId: string;
			eventStatus?: string;
			scheduledStart?: number;
			lastFetchedAt?: number;
		}>;

		if (formattedDate === today) {
			await syncGamesForView({
				data: {
					league: "nba",
					games: gamesForSync.map((game) => ({
						espnGameId: game.espnGameId,
						eventStatus: game.eventStatus,
						scheduledStart: game.scheduledStart,
						lastFetchedAt: game.lastFetchedAt,
					})),
				},
			});
			await context.queryClient.ensureQueryData(scoreboardQuery(formattedDate));
		}
	},
	pendingComponent: () => (
		<ScoresPagePending title={TITLE} description={DESCRIPTION} />
	),
	component: NbaScoresPage,
});

function NbaScoresPage() {
	const { date } = Route.useSearch();
	const currentDate = date ?? formatDate(new Date(), "YYYY-MM-DD");
	const formattedDate = formatDate(currentDate, "YYYYMMDD");
	const today = formatDate(new Date(), "YYYYMMDD");

	const { data: rawGames, refetch } = useQuery(scoreboardQuery(formattedDate));

	useEffect(() => {
		if (formattedDate !== today) return;

		const syncNow = async () => {
			if (document.visibilityState !== "visible") return;

			const gamesForSync = (rawGames ?? []) as Array<{
				espnGameId: string;
				eventStatus?: string;
				scheduledStart?: number;
				lastFetchedAt?: number;
			}>;

			if (gamesForSync.length === 0) return;

			await syncGamesForView({
				data: {
					league: "nba",
					games: gamesForSync.map((game) => ({
						espnGameId: game.espnGameId,
						eventStatus: game.eventStatus,
						scheduledStart: game.scheduledStart,
						lastFetchedAt: game.lastFetchedAt,
					})),
				},
			});

			await refetch();
		};

		const intervalId = window.setInterval(() => {
			void syncNow();
		}, LIVE_REFRESH_INTERVAL_MS);

		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void syncNow();
			}
		};

		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [formattedDate, today, rawGames, refetch]);

	const games = useMemo(
		() => convexScoreboardToGameData(rawGames ?? [], "nba"),
		[rawGames],
	);

	return (
		<ScoresPageLayout
			games={games}
			league="nba"
			currentDate={currentDate}
			formattedDate={formattedDate}
			title={TITLE}
			description={DESCRIPTION}
			queryOptions={scoreboardQuery as (date: string) => FetchQueryOptions<any, any, any, any>}
			cacheKeyPrefix="nba"
		/>
	);
}

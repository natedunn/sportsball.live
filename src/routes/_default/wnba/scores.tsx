import { createFileRoute } from "@tanstack/react-router";
import { useQuery, type FetchQueryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { formatDate } from "@/lib/date";
import { convexScoreboardToGameData } from "@/lib/shared/convex-adapters";
import {
	syncLeagueGamesForView,
	useLiveScoreSync,
	type RawSyncableGame,
} from "@/lib/shared/live-score-sync";
import {
	ScoresPageLayout,
	ScoresPagePending,
} from "@/components/scores/scores-page-layout";

const TITLE = "WNBA Scores & Schedule";
const DESCRIPTION = "Live scores, results, and upcoming games for the WNBA.";

interface WnbaSearchParams {
	date?: string;
}

const scoreboardQuery = (date: string) =>
	convexQuery(api.wnba.queries.getScoreboard, { gameDate: date });

export const Route = createFileRoute("/_default/wnba/scores")({
	validateSearch: (search: Record<string, unknown>): WnbaSearchParams => {
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

		if (formattedDate === today) {
			await syncLeagueGamesForView(
				"wnba",
				(rawGames ?? []) as RawSyncableGame[],
			);
			await context.queryClient.ensureQueryData(scoreboardQuery(formattedDate));
		}
	},
	pendingComponent: () => (
		<ScoresPagePending title={TITLE} description={DESCRIPTION} />
	),
	component: WnbaScoresPage,
});

function WnbaScoresPage() {
	const { date } = Route.useSearch();
	const currentDate = date ?? formatDate(new Date(), "YYYY-MM-DD");
	const formattedDate = formatDate(currentDate, "YYYYMMDD");
	const today = formatDate(new Date(), "YYYYMMDD");
	const isToday = formattedDate === today;

	const { data: rawGames, refetch } = useQuery(scoreboardQuery(formattedDate));

	useLiveScoreSync({
		league: "wnba",
		rawGames: (rawGames ?? []) as RawSyncableGame[],
		refetch,
		enabled: isToday,
	});

	const games = useMemo(
		() => convexScoreboardToGameData(rawGames ?? [], "wnba"),
		[rawGames],
	);

	return (
		<ScoresPageLayout
			games={games}
			league="wnba"
			currentDate={currentDate}
			formattedDate={formattedDate}
			title={TITLE}
			description={DESCRIPTION}
			queryOptions={scoreboardQuery as (date: string) => FetchQueryOptions<any, any, any, any>}
			cacheKeyPrefix="wnba"
		/>
	);
}

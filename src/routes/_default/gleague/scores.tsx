import { createFileRoute } from "@tanstack/react-router";
import { useQuery, type FetchQueryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { formatDate } from "@/lib/date";
import { convexScoreboardToGameData } from "@/lib/shared/convex-adapters";
import {
	ScoresPageLayout,
	ScoresPagePending,
} from "@/components/scores/scores-page-layout";

const TITLE = "Daily G League scores";
const DESCRIPTION = "View current, upcoming, and past games for the G League.";

interface GLeagueSearchParams {
	date?: string;
}

const scoreboardQuery = (date: string) =>
	convexQuery(api.gleague.queries.getScoreboard, { gameDate: date });

export const Route = createFileRoute("/_default/gleague/scores")({
	validateSearch: (search: Record<string, unknown>): GLeagueSearchParams => {
		return {
			date: typeof search.date === "string" ? search.date : undefined,
		};
	},
	loaderDeps: ({ search: { date } }) => ({ date }),
	loader: async ({ context, deps }) => {
		const currentDate = deps.date ?? formatDate(new Date(), "YYYY-MM-DD");
		const formattedDate = formatDate(currentDate, "YYYYMMDD");

		await context.queryClient.ensureQueryData(
			scoreboardQuery(formattedDate),
		);
	},
	pendingComponent: () => (
		<ScoresPagePending title={TITLE} description={DESCRIPTION} />
	),
	component: GLeagueScoresPage,
});

function GLeagueScoresPage() {
	const { date } = Route.useSearch();
	const currentDate = date ?? formatDate(new Date(), "YYYY-MM-DD");
	const formattedDate = formatDate(currentDate, "YYYYMMDD");

	const { data: rawGames } = useQuery(scoreboardQuery(formattedDate));

	const games = useMemo(
		() => convexScoreboardToGameData(rawGames ?? [], "gleague"),
		[rawGames],
	);

	return (
		<ScoresPageLayout
			games={games}
			league="gleague"
			currentDate={currentDate}
			formattedDate={formattedDate}
			title={TITLE}
			description={DESCRIPTION}
			queryOptions={scoreboardQuery as (date: string) => FetchQueryOptions<any, any, any, any>}
			cacheKeyPrefix="gleague"
		/>
	);
}

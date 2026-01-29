import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/date";
import { nbaGamesQueryOptions } from "@/lib/nba/games.queries";
import {
	ScoresPageLayout,
	ScoresPagePending,
} from "@/components/scores-page-layout";

const TITLE = "Daily NBA scores";
const DESCRIPTION = "View current, upcoming, and past games for the NBA.";

interface NbaSearchParams {
	date?: string;
}

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

		await context.queryClient.ensureQueryData(
			nbaGamesQueryOptions(formattedDate),
		);
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

	const { data: games = [] } = useQuery(nbaGamesQueryOptions(formattedDate));

	return (
		<ScoresPageLayout
			games={games}
			league="nba"
			currentDate={currentDate}
			formattedDate={formattedDate}
			title={TITLE}
			description={DESCRIPTION}
			queryOptions={nbaGamesQueryOptions}
			cacheKeyPrefix="nba"
		/>
	);
}

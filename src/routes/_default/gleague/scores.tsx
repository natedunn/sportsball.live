import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/date";
import { gleagueGamesQueryOptions } from "@/lib/gleague/games.queries";
import {
	ScoresPageLayout,
	ScoresPagePending,
} from "@/components/scores-page-layout";

const TITLE = "Daily G League scores";
const DESCRIPTION = "View current, upcoming, and past games for the G League.";

interface GLeagueSearchParams {
	date?: string;
}

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
			gleagueGamesQueryOptions(formattedDate),
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

	const { data: games = [] } = useQuery(gleagueGamesQueryOptions(formattedDate));

	return (
		<ScoresPageLayout
			games={games}
			league="gleague"
			currentDate={currentDate}
			formattedDate={formattedDate}
			title={TITLE}
			description={DESCRIPTION}
			queryOptions={gleagueGamesQueryOptions}
			cacheKeyPrefix="gleague"
		/>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/date";
import { wnbaGamesQueryOptions } from "@/lib/wnba/games.queries";
import {
	ScoresPageLayout,
	ScoresPagePending,
} from "@/components/scores-page-layout";

const TITLE = "Daily WNBA scores";
const DESCRIPTION = "View current, upcoming, and past games for the WNBA.";

interface WnbaSearchParams {
	date?: string;
}

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

		await context.queryClient.ensureQueryData(
			wnbaGamesQueryOptions(formattedDate),
		);
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

	const { data: games = [] } = useQuery(wnbaGamesQueryOptions(formattedDate));

	return (
		<ScoresPageLayout
			games={games}
			league="wnba"
			currentDate={currentDate}
			formattedDate={formattedDate}
			title={TITLE}
			description={DESCRIPTION}
			queryOptions={wnbaGamesQueryOptions}
			cacheKeyPrefix="wnba"
		/>
	);
}

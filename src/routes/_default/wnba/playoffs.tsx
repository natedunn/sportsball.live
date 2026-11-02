import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { seo } from "@/lib/seo";
import {
	PlayoffBracket,
	type PlayoffBracketData,
} from "@/components/playoffs/playoff-bracket";

const TITLE = "WNBA Playoffs";

const DESCRIPTION = "WNBA Playoff Bracket";
const seasonQuery = () => convexQuery(api.seasons.getCurrentName, { league: "wnba" });
const bracketQuery = (season: string) =>
	convexQuery(api.wnba.queries.getPlayoffBracket, { season });

function PlayoffsHeader({ season }: { season?: string | null }) {
	return (
		<div className="bg-gradient-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
			<div className="flex flex-col items-center justify-between gap-4">
				<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
					{TITLE}
				</h1>
				<p className="text-center text-muted-foreground/50">
					{season ? `${season} ${DESCRIPTION}` : DESCRIPTION}
				</p>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/_default/wnba/playoffs")({
	loader: async ({ context }) => {
		const season = await context.queryClient.ensureQueryData(seasonQuery());
		if (season) {
			await context.queryClient.ensureQueryData(bracketQuery(season));
		}
	},
	head: () => ({
		meta: seo({
			title: TITLE,
			description: "The WNBA playoff bracket: every series from the first round to the Finals.",
		}),
	}),
	pendingComponent: () => (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<PlayoffsHeader />
			<div className="container">
				<div className="animate-pulse space-y-4">
					<div className="h-24 w-56 mx-auto rounded-xl bg-muted" />
					<div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="h-24 rounded-xl bg-muted" />
						))}
					</div>
				</div>
			</div>
		</div>
	),
	component: WnbaPlayoffsPage,
});

function WnbaPlayoffsPage() {
	const { data: season } = useQuery(seasonQuery());
	const { data } = useQuery({
		...bracketQuery(season ?? ""),
		enabled: !!season,
	});

	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			{/* The bracket may be last season's, until this season's playoffs begin */}
			<PlayoffsHeader season={data?.season ?? season} />
			<div className="container">
				{data ? (
					<PlayoffBracket
						data={data as PlayoffBracketData}
						league="wnba"
						view="league"
					/>
				) : null}
			</div>
		</div>
	);
}

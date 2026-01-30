import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { wnbaGamesQueryOptions } from "@/lib/wnba/games.queries";
import { wnbaNewsQueryOptions } from "@/lib/wnba/news.queries";
import { wnbaLeadersQueryOptions } from "@/lib/leaders/leaders.queries";
import { formatDate } from "@/lib/date";
import { ScoreTicker } from "@/components/score-ticker";
import { NewsCard } from "@/components/news-card";
import { LeagueLeaders } from "@/components/leaders/league-leaders";

export const Route = createFileRoute("/_default/wnba/")({
	loader: async ({ context }) => {
		const today = formatDate(new Date(), "YYYYMMDD");
		await Promise.all([
			context.queryClient.ensureQueryData(wnbaGamesQueryOptions(today)),
			context.queryClient.ensureQueryData(wnbaNewsQueryOptions()),
			context.queryClient.ensureQueryData(wnbaLeadersQueryOptions()),
		]);
	},
	component: WnbaHomePage,
});

function WnbaHomePage() {
	const today = formatDate(new Date(), "YYYYMMDD");
	const { data: games = [] } = useQuery(wnbaGamesQueryOptions(today));
	const { data: news = [] } = useQuery(wnbaNewsQueryOptions());
	const { data: leaders } = useQuery(wnbaLeadersQueryOptions());

	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<div className="bg-gradient-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
				<div className="flex flex-col items-center justify-between gap-4">
					<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
						WNBA
					</h1>
					<p className="text-center text-muted-foreground/50">
						News, scores, and stats for the Women's National Basketball Association
					</p>
				</div>
			</div>

			<div className="container">
				<div className="flex flex-col gap-8">
					{/* Today's Games */}
					<section className="flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<h2 className="text-xl font-bold">Today's Games</h2>
							<Link
								to="/wnba/scores"
								className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
							>
								All scores <ArrowRight className="h-4 w-4" />
							</Link>
						</div>
						<ScoreTicker games={games} league="wnba" />
					</section>

					{/* News Section */}
					<section className="flex flex-col gap-4">
						<h2 className="text-xl font-bold">Latest News</h2>
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{news.slice(0, 6).map((article) => (
								<NewsCard key={article.id} article={article} />
							))}
							{news.length === 0 && (
								<p className="text-sm text-muted-foreground">No news available</p>
							)}
						</div>
					</section>

					{/* League Leaders */}
					{leaders && (
						<section className="flex flex-col gap-4">
							<h2 className="text-xl font-bold">League Leaders</h2>
							<LeagueLeaders
								points={leaders.points}
								assists={leaders.assists}
								rebounds={leaders.rebounds}
								stocks={leaders.stocks}
							/>
						</section>
					)}
				</div>
			</div>
		</div>
	);
}

import { Link, useNavigate } from "@tanstack/react-router";
import { Gauge, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { leaguePlayerRoutes } from "@/lib/league-routes";
import { leagueLabels } from "@/lib/teams";
import type { League } from "@/lib/shared/league";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { useCurrentSeasonName } from "@/lib/use-current-season";
import { PlayerSearch } from "./player-search";

export type RankingView = "scoring" | "playmaking" | "efficiency";
const PAGE_SIZE = 25;

interface PlayerRow {
	id: string;
	name: string;
	team: string;
	position: string;
	games: number;
	points: number;
	rebounds: number;
	assists: number;
	fieldGoalPct: number;
	minutes: number;
	steals: number;
}

interface PlayersPageLayoutProps {
	league: League;
	view: RankingView;
	onViewChange: (view: RankingView) => void;
}

function LeagueRankingsLabel({ league }: { league: League }) {
	if (league === "gleague") {
		return <span>G League Rankings</span>;
	}
	return <span>{leagueLabels[league]} Rankings</span>;
}

export function PlayersPageLayout({
	league,
	view,
	onViewChange,
}: PlayersPageLayoutProps) {
	const season = useCurrentSeasonName(league);
	const navigate = useNavigate();
	const queryRef = useMemo(() => {
		const queryMap = {
			nba: (api as any).nba.queries.getPlayersPaginated,
			wnba: (api as any).wnba.queries.getPlayersPaginated,
			gleague: (api as any).gleague.queries.getPlayersPaginated,
		};
		return queryMap[league];
	}, [league]);

	const [cursor, setCursor] = useState<string | null>(null);
	const [players, setPlayers] = useState<PlayerRow[]>([]);
	const [seenCursors, setSeenCursors] = useState<Set<string>>(new Set());
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [isDone, setIsDone] = useState(false);
	const cursorKey = cursor ?? "__start__";

	const { data: pageData, isLoading, isFetching } = useQuery({
		...convexQuery(queryRef, {
			season: season ?? "",
			sortBy: view,
			paginationOpts: {
				cursor,
				numItems: PAGE_SIZE,
			},
		}),
		enabled: !!season,
	});

	useEffect(() => {
		setCursor(null);
		setPlayers([]);
		setSeenCursors(new Set());
		setNextCursor(null);
		setIsDone(false);
	}, [league, view, season]);

	useEffect(() => {
		if (!pageData || seenCursors.has(cursorKey)) {
			return;
		}
		setSeenCursors((prev) => new Set(prev).add(cursorKey));
		setNextCursor(pageData.continueCursor ?? null);
		setIsDone(pageData.isDone);

		setPlayers((prev) => {
			const seenIds = new Set(prev.map((player) => player.id));
			const incoming = pageData.page.filter(
				(player: PlayerRow) => !seenIds.has(player.id),
			);
			return [...prev, ...incoming];
		});
	}, [cursorKey, pageData, seenCursors]);

	const playerRoute = leaguePlayerRoutes[league];

	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<div className="relative overflow-hidden border-b bg-card">
				<div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
				<div className="container relative z-10 py-8 md:py-10">
					<div className="flex flex-col items-center justify-between gap-4">
						<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
							<LeagueRankingsLabel league={league} />
						</span>
						<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
							Players
						</h1>
						<p className="text-center text-muted-foreground/70">
							League-wide player rankings and quick links to detailed player
							profiles.
						</p>
					</div>
				</div>
			</div>

			<div className="container space-y-6">
				<Tabs
					value={view}
					onValueChange={(next) => onViewChange(next as RankingView)}
					className="w-full"
				>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<TabsList>
							<TabsTrigger value="scoring">
								<Target className="h-3.5 w-3.5 mr-1.5" />
								Scoring
							</TabsTrigger>
							<TabsTrigger value="playmaking">
								<Sparkles className="h-3.5 w-3.5 mr-1.5" />
								Playmaking
							</TabsTrigger>
							<TabsTrigger value="efficiency">
								<Gauge className="h-3.5 w-3.5 mr-1.5" />
								Efficiency
							</TabsTrigger>
						</TabsList>
						<PlayerSearch
							league={league}
							season={season ?? ""}
							value={null}
							onValueChange={(player) => {
								if (player) navigate({ to: playerRoute, params: { id: player.id } });
							}}
							placeholder="Search players"
							className="w-full sm:w-72"
						/>
					</div>
					<TabsContent value="scoring">
						<span className="sr-only">Scoring rankings</span>
					</TabsContent>
					<TabsContent value="playmaking">
						<span className="sr-only">Playmaking rankings</span>
					</TabsContent>
					<TabsContent value="efficiency">
						<span className="sr-only">Efficiency rankings</span>
					</TabsContent>
				</Tabs>

				<Card classNames={{ inner: "flex-col p-0" }}>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[940px] text-left text-sm">
							<thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
								<tr>
									<th className="px-3 py-2">Rank</th>
									<th className="px-3 py-2">Player</th>
									<th className="px-3 py-2">Team</th>
									<th className="px-3 py-2">Pos</th>
									<th className="px-3 py-2">GP</th>
									<th className="px-3 py-2">PTS</th>
									<th className="px-3 py-2">REB</th>
									<th className="px-3 py-2">AST</th>
									<th className="px-3 py-2">FG%</th>
									<th className="px-3 py-2">MIN</th>
									<th className="px-3 py-2">STL</th>
								</tr>
							</thead>
							<tbody>
								{players.map((player, index) => (
									<tr
										key={player.id}
										className="border-t border-border/70 hover:bg-muted/40"
									>
										<td className="px-3 py-2 font-semibold">{index + 1}</td>
										<td className="px-3 py-2">
											<Link
												to={playerRoute}
												params={{ id: player.id }}
												className="font-medium hover:underline"
											>
												{player.name}
											</Link>
										</td>
										<td className="px-3 py-2 text-muted-foreground">
											{player.team}
										</td>
										<td className="px-3 py-2">{player.position}</td>
										<td className="px-3 py-2">{player.games}</td>
										<td className="px-3 py-2 font-semibold">
											{player.points.toFixed(1)}
										</td>
										<td className="px-3 py-2">{player.rebounds.toFixed(1)}</td>
										<td className="px-3 py-2">{player.assists.toFixed(1)}</td>
										<td className="px-3 py-2">{player.fieldGoalPct.toFixed(1)}%</td>
										<td className="px-3 py-2">{player.minutes.toFixed(1)}</td>
										<td className="px-3 py-2">{player.steals.toFixed(1)}</td>
									</tr>
								))}
								{isLoading && (
									<tr>
										<td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">
											Loading players...
										</td>
									</tr>
								)}
								{!isLoading && players.length === 0 && (
									<tr>
										<td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">
											No players found for this view yet.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</Card>

				<div className="flex justify-center">
					{!isDone && nextCursor ? (
						<button
							type="button"
							onClick={() => setCursor(nextCursor)}
							disabled={isFetching}
							className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isFetching ? "Loading..." : "Load more players"}
						</button>
					) : (
						!isLoading &&
						players.length > 0 && (
							<p className="text-sm text-muted-foreground">All loaded</p>
						)
					)}
				</div>

			</div>
		</div>
	);
}

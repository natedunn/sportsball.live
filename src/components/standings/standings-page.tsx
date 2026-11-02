import { Link } from "@tanstack/react-router";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { convexQuery } from "@convex-dev/react-query";
import type { FunctionReference } from "convex/server";
import { api } from "~api";
import { convexStandingsToResponse } from "@/lib/shared/convex-adapters";
import { combineStandings, pctRanks } from "@/lib/shared/combined-standings";
import type { League } from "@/lib/shared/league";
import { storeStandingsView, type StandingsView } from "@/lib/standings-view";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StandingsTable } from "@/components/standings/standings-table";
import {
	EasternConferenceIcon,
	LeagueIcon,
	WesternConferenceIcon,
} from "@/components/ui/conference-tab-icons";

const TITLES: Record<League, string> = {
	nba: "NBA Standings",
	wnba: "WNBA Standings",
	gleague: "G-League Standings",
};

const DESCRIPTIONS: Record<League, string> = {
	nba: "Current NBA standings by conference.",
	wnba: "Current WNBA standings by conference.",
	gleague: "Current NBA G-League standings by conference.",
};

// Each league's rows have their own ID types, which the adapter doesn't need
type StandingsQuery = FunctionReference<
	"query",
	"public",
	{ season: string },
	{ eastern: unknown[]; western: unknown[] }
>;

const STANDINGS_QUERIES: Record<League, StandingsQuery> = {
	nba: api.nba.queries.getStandings,
	wnba: api.wnba.queries.getStandings,
	gleague: api.gleague.queries.getStandings,
};

const standingsQuery = (league: League, season: string) =>
	convexQuery(STANDINGS_QUERIES[league], { season });

const seasonQuery = (league: League) =>
	convexQuery(api.seasons.getCurrentName, { league });

/** Route loader for every standings page. */
export async function loadStandings(queryClient: QueryClient, league: League) {
	const season = await queryClient.ensureQueryData(seasonQuery(league));
	if (season) {
		await queryClient.ensureQueryData(standingsQuery(league, season));
	}
}

function StandingsHeader({ league }: { league: League }) {
	return (
		<div className="bg-gradient-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
			<div className="flex flex-col items-center justify-between gap-4">
				<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
					{TITLES[league]}
				</h1>
				<p className="text-center text-muted-foreground/50">
					{DESCRIPTIONS[league]}
				</p>
			</div>
		</div>
	);
}

export function StandingsPending({ league }: { league: League }) {
	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<StandingsHeader league={league} />
			<div className="container">
				<div className="animate-pulse space-y-4">
					<div className="h-10 w-64 mx-auto rounded bg-muted" />
					<div className="h-96 rounded bg-muted" />
				</div>
			</div>
		</div>
	);
}

/**
 * One standings page: a conference, or the whole league in one list. The
 * WNBA ranks its league list like the league does, with a playoff cut; the
 * NBA and G League lists are just for fun, ranked by win percentage with ties.
 */
export function StandingsPage({
	league,
	view,
}: {
	league: League;
	view: StandingsView;
}) {
	const { data: season } = useQuery(seasonQuery(league));
	const { data: rawStandings } = useQuery({
		...standingsQuery(league, season ?? ""),
		enabled: !!season,
	});

	const standings = useMemo(
		() => (rawStandings ? convexStandingsToResponse(rawStandings, league) : null),
		[rawStandings, league],
	);
	const leagueTeams = useMemo(
		() => (standings ? combineStandings(standings) : []),
		[standings],
	);
	const leagueRanks = useMemo(() => pctRanks(leagueTeams), [leagueTeams]);

	// `/{league}/standings` opens the page last viewed, in any league
	useEffect(() => {
		storeStandingsView(view);
	}, [view]);

	if (!standings) {
		return null;
	}

	const tabLink = (target: StandingsView) => (
		<Link to={`/${league}/standings/${target}` as string} />
	);

	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<StandingsHeader league={league} />

			<div className="container">
				<Tabs value={view} className="w-full">
					<div className="flex justify-center mb-6">
						<TabsList responsive={false}>
							<TabsTrigger value="west" render={tabLink("west")}>
								<span className="inline-flex items-center gap-1.5">
									<WesternConferenceIcon />
									Western
								</span>
							</TabsTrigger>
							<TabsTrigger value="east" render={tabLink("east")}>
								<span className="inline-flex items-center gap-1.5">
									<EasternConferenceIcon />
									Eastern
								</span>
							</TabsTrigger>
							<TabsTrigger value="league" render={tabLink("league")}>
								<span className="inline-flex items-center gap-1.5">
									<LeagueIcon />
									League
								</span>
							</TabsTrigger>
						</TabsList>
					</div>

					{view === "league" ? (
						league === "wnba" ? (
							<StandingsTable teams={leagueTeams} league={league} showSections />
						) : (
							<StandingsTable
								teams={leagueTeams}
								league={league}
								showSections={false}
								ranks={leagueRanks}
							/>
						)
					) : (
						<StandingsTable
							teams={view === "east" ? standings.eastern.teams : standings.western.teams}
							league={league}
							showSections={league !== "wnba"}
						/>
					)}
				</Tabs>
			</div>
		</div>
	);
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { seo } from "@/lib/seo";
import { fetchGLeaguePlayoffSeeds } from "@/lib/gleague/playoffs.server";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
	EasternConferenceIcon,
	WesternConferenceIcon,
} from "@/components/ui/conference-tab-icons";
import { AnimationProvider } from "@/components/team-details/animation-context";
import {
	PlayoffBracket,
	type PlayoffBracketData,
	type PlayoffView,
} from "@/components/playoffs/playoff-bracket";

const TITLE = "G League Playoffs";

const DESCRIPTION = "G League Playoff Bracket";
const seasonQuery = () => convexQuery(api.seasons.getCurrentName, { league: "gleague" });
const bracketQuery = (season: string) =>
	convexQuery(api.gleague.queries.getPlayoffBracket, { season });
// Seeds are set when the regular season ends
const seedsQuery = (season: string) =>
	queryOptions({
		queryKey: ["gleague", "playoff-seeds", season],
		queryFn: () => fetchGLeaguePlayoffSeeds({ data: season }),
		staleTime: 60 * 60 * 1000,
	});

type PlayoffTab = Exclude<PlayoffView, "league">;
const TABS: PlayoffTab[] = ["western", "eastern", "finals"];

interface PlayoffSearchParams {
	tab?: PlayoffTab;
}

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

export const Route = createFileRoute("/_default/gleague/playoffs")({
	validateSearch: (search: Record<string, unknown>): PlayoffSearchParams => ({
		tab: TABS.find((tab) => tab === search.tab),
	}),
	loader: async ({ context }) => {
		const season = await context.queryClient.ensureQueryData(seasonQuery());
		if (season) {
			const bracket = await context.queryClient.ensureQueryData(bracketQuery(season));
			await context.queryClient.ensureQueryData(seedsQuery(bracket.season));
		}
	},
	head: () => ({
		meta: seo({
			title: TITLE,
			description:
				"The NBA G League playoff bracket: both conferences and the Finals.",
		}),
	}),
	pendingComponent: () => (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<PlayoffsHeader />
			<div className="container">
				<div className="animate-pulse space-y-4">
					<div className="h-10 w-72 mx-auto rounded bg-muted" />
					<div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="h-24 rounded-xl bg-muted" />
						))}
					</div>
				</div>
			</div>
		</div>
	),
	component: GLeaguePlayoffsPage,
});

function GLeaguePlayoffsPage() {
	const { tab = "finals" } = Route.useSearch();
	const navigate = useNavigate();
	const { data: season } = useQuery(seasonQuery());
	const { data: bracket } = useQuery({
		...bracketQuery(season ?? ""),
		enabled: !!season,
	});
	const { data: seeds } = useQuery({
		...seedsQuery(bracket?.season ?? ""),
		enabled: !!bracket,
	});

	// The bracket splits the league East and West by the stats API's seeds
	const data = useMemo((): PlayoffBracketData | null => {
		if (!bracket || !seeds) return null;
		const seedByTeam = new Map(seeds.map((seed) => [seed.espnTeamId, seed]));
		return {
			games: bracket.games,
			teams: bracket.teams.flatMap((team) => {
				const seed = seedByTeam.get(team.espnTeamId);
				return seed
					? [{ ...team, conference: seed.conference, conferenceRank: seed.rank }]
					: [];
			}),
		};
	}, [bracket, seeds]);

	const handleTabChange = (value: string) => {
		navigate({
			to: "/gleague/playoffs",
			search: { tab: value as PlayoffTab },
			replace: true,
		});
	};

	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			{/* The bracket may be last season's, until this season's playoffs begin */}
			<PlayoffsHeader season={bracket?.season ?? season} />

			<div className="container">
				{data && data.teams.length === 0 && bracket?.games.length ? (
					<p className="py-20 text-center text-muted-foreground">
						Playoff seeds couldn't be loaded. Try again in a few minutes.
					</p>
				) : data ? (
					<AnimationProvider activeTab={tab}>
						<Tabs value={tab} onValueChange={handleTabChange} className="w-full">
							<div className="flex justify-center mb-6">
								<TabsList>
									<TabsTrigger value="western">
										<span className="inline-flex items-center gap-1.5">
											<WesternConferenceIcon />
											Western
										</span>
									</TabsTrigger>
									<TabsTrigger value="eastern">
										<span className="inline-flex items-center gap-1.5">
											<EasternConferenceIcon />
											Eastern
										</span>
									</TabsTrigger>
									<TabsTrigger value="finals">
										<span className="inline-flex items-center gap-1.5">
											<Trophy className="size-4" />
											Finals
										</span>
									</TabsTrigger>
								</TabsList>
							</div>

							{TABS.map((view) => (
								<TabsContent key={view} value={view}>
									<PlayoffBracket data={data} league="gleague" view={view} />
								</TabsContent>
							))}
						</Tabs>
					</AnimationProvider>
				) : null}
			</div>
		</div>
	);
}

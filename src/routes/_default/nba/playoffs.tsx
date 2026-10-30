import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
	EasternConferenceIcon,
	WesternConferenceIcon,
} from "@/components/ui/conference-tab-icons";
import { AnimationProvider } from "@/components/team-details/animation-context";
import {
	PlayoffBracket,
	type PlayoffBracketData,
} from "@/components/playoffs/playoff-bracket";

const TITLE = "NBA Playoffs";

const DESCRIPTION = "NBA Playoff Bracket";
const seasonQuery = () => convexQuery(api.seasons.getCurrentName, { league: "nba" });
const bracketQuery = (season: string) =>
	convexQuery(api.nba.queries.getPlayoffBracket, { season });

type PlayoffTab = "western" | "eastern" | "finals";

interface PlayoffSearchParams {
	tab?: string;
}

export const Route = createFileRoute("/_default/nba/playoffs")({
	validateSearch: (search: Record<string, unknown>): PlayoffSearchParams => {
		return {
			tab: typeof search.tab === "string" ? search.tab : undefined,
		};
	},
	loader: async ({ context }) => {
		const season = await context.queryClient.ensureQueryData(seasonQuery());
		if (season) {
			await context.queryClient.ensureQueryData(bracketQuery(season));
		}
	},
	pendingComponent: () => (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<div className="bg-gradient-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
				<div className="flex flex-col items-center justify-between gap-4">
					<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
						{TITLE}
					</h1>
					<p className="text-center text-muted-foreground/50">{DESCRIPTION}</p>
				</div>
			</div>
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
	component: NbaPlayoffsPage,
});

function getInitialTab(searchParam?: string): PlayoffTab {
	if (
		searchParam === "western" ||
		searchParam === "eastern" ||
		searchParam === "finals"
	) {
		return searchParam;
	}
	return "western";
}

function NbaPlayoffsPage() {
	const { tab: searchTab } = Route.useSearch();
	const navigate = useNavigate();
	const { data: season } = useQuery(seasonQuery());
	const { data } = useQuery({
		...bracketQuery(season ?? ""),
		enabled: !!season,
	});

	const [activeTab, setActiveTab] = useState<PlayoffTab>(() =>
		getInitialTab(searchTab),
	);

	useEffect(() => {
		if (
			searchTab === "western" ||
			searchTab === "eastern" ||
			searchTab === "finals"
		) {
			setActiveTab(searchTab);
		}
	}, [searchTab]);

	const handleTabChange = (value: string) => {
		const newTab = value as PlayoffTab;
		setActiveTab(newTab);
		navigate({
			to: "/nba/playoffs",
			search: { tab: newTab },
			replace: true,
		});
	};

	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
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

			<div className="container">
				{data ? (
					<AnimationProvider activeTab={activeTab}>
					<Tabs
						value={activeTab}
						onValueChange={handleTabChange}
						className="w-full"
					>
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

						<TabsContent value="western">
							<PlayoffBracket
								data={data as PlayoffBracketData}
								league="nba"
								view="western"
							/>
						</TabsContent>

						<TabsContent value="eastern">
							<PlayoffBracket
								data={data as PlayoffBracketData}
								league="nba"
								view="eastern"
							/>
						</TabsContent>

						<TabsContent value="finals">
							<PlayoffBracket
								data={data as PlayoffBracketData}
								league="nba"
								view="finals"
							/>
						</TabsContent>
					</Tabs>
					</AnimationProvider>
				) : null}
			</div>
		</div>
	);
}

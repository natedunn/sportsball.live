import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { getCurrentSeason } from "@/lib/shared/season";
import { convexStandingsToResponse } from "@/lib/shared/convex-adapters";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StandingsTable } from "@/components/standings/standings-table";
import {
	EasternConferenceIcon,
	WesternConferenceIcon,
} from "@/components/ui/conference-tab-icons";

const TITLE = "G-League Standings";
const DESCRIPTION = "Current NBA G-League standings by conference.";

type Conference = "eastern" | "western";

interface StandingsSearchParams {
	conference?: string;
}

const season = getCurrentSeason();
const standingsQuery = () =>
	convexQuery(api.gleague.queries.getStandings, { season });

export const Route = createFileRoute("/_default/gleague/standings")({
	validateSearch: (search: Record<string, unknown>): StandingsSearchParams => {
		return {
			conference:
				typeof search.conference === "string" ? search.conference : undefined,
		};
	},
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(standingsQuery());
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
					<div className="h-10 w-64 mx-auto rounded bg-muted" />
					<div className="h-96 rounded bg-muted" />
				</div>
			</div>
		</div>
	),
	component: GLeagueStandingsPage,
});

function getInitialConference(searchParam?: string): Conference {
	if (searchParam === "eastern" || searchParam === "western") {
		return searchParam;
	}
	return "eastern";
}

function GLeagueStandingsPage() {
	const { conference: searchConference } = Route.useSearch();
	const navigate = useNavigate();
	const { data: rawStandings } = useQuery(standingsQuery());

	const standings = useMemo(
		() => rawStandings ? convexStandingsToResponse(rawStandings, "gleague") : null,
		[rawStandings],
	);

	// Local state for immediate UI feedback
	const [activeConference, setActiveConference] = useState<Conference>(() =>
		getInitialConference(searchConference),
	);

	// Sync local state when URL changes (e.g., browser back/forward)
	useEffect(() => {
		if (searchConference === "eastern" || searchConference === "western") {
			setActiveConference(searchConference);
		}
	}, [searchConference]);

	const handleConferenceChange = (value: string) => {
		const newConference = value as Conference;
		setActiveConference(newConference);
		navigate({
			to: "/gleague/standings",
			search: { conference: newConference },
			replace: true,
		});
	};

	if (!standings) {
		return null;
	}

	return (
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
				<Tabs
					value={activeConference}
					onValueChange={handleConferenceChange}
					className="w-full"
				>
					<div className="flex justify-center mb-6">
						<TabsList responsive={false}>
							<TabsTrigger value="eastern">
								<span className="inline-flex items-center gap-1.5">
									<EasternConferenceIcon />
									Eastern
								</span>
							</TabsTrigger>
							<TabsTrigger value="western">
								<span className="inline-flex items-center gap-1.5">
									<WesternConferenceIcon />
									Western
								</span>
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="eastern">
						<StandingsTable
							teams={standings.eastern.teams}
							league="gleague"
							showSections={true}
						/>
					</TabsContent>

					<TabsContent value="western">
						<StandingsTable
							teams={standings.western.teams}
							league="gleague"
							showSections={true}
						/>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

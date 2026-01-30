import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { nbaStandingsQueryOptions } from "@/lib/nba/standings.queries";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StandingsTable } from "@/components/standings/standings-table";

const TITLE = "NBA Standings";
const DESCRIPTION = "Current NBA standings by conference.";

type Conference = "eastern" | "western";

interface StandingsSearchParams {
	conference?: string;
}

export const Route = createFileRoute("/_default/nba/standings")({
	validateSearch: (search: Record<string, unknown>): StandingsSearchParams => {
		return {
			conference:
				typeof search.conference === "string" ? search.conference : undefined,
		};
	},
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(nbaStandingsQueryOptions());
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
	component: NbaStandingsPage,
});

function getInitialConference(searchParam?: string): Conference {
	if (searchParam === "eastern" || searchParam === "western") {
		return searchParam;
	}
	return "eastern";
}

function NbaStandingsPage() {
	const { conference: searchConference } = Route.useSearch();
	const navigate = useNavigate();
	const { data: standings } = useQuery(nbaStandingsQueryOptions());

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
			to: "/nba/standings",
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
						<TabsList>
							<TabsTrigger value="eastern">Eastern</TabsTrigger>
							<TabsTrigger value="western">Western</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="eastern">
						<StandingsTable teams={standings.eastern.teams} league="nba" />
					</TabsContent>

					<TabsContent value="western">
						<StandingsTable teams={standings.western.teams} league="nba" />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { getCurrentSeason } from "@/lib/shared/season";
import { convexStandingsToResponse } from "@/lib/shared/convex-adapters";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StandingsTable } from "@/components/standings/standings-table";

const TITLE = "WNBA Standings";
const DESCRIPTION = "Current WNBA standings by conference.";

type ViewType = "combined" | "eastern" | "western";

interface StandingsSearchParams {
	conference?: string;
}

const season = getCurrentSeason();
const standingsQuery = () =>
	convexQuery(api.wnba.queries.getStandings, { season });

export const Route = createFileRoute("/_default/wnba/standings")({
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
	component: WnbaStandingsPage,
});

function getInitialView(searchParam?: string): ViewType {
	if (
		searchParam === "combined" ||
		searchParam === "eastern" ||
		searchParam === "western"
	) {
		return searchParam;
	}
	return "combined";
}

function WnbaStandingsPage() {
	const { conference: searchConference } = Route.useSearch();
	const navigate = useNavigate();
	const { data: rawStandings } = useQuery(standingsQuery());

	const standings = useMemo(
		() => rawStandings ? convexStandingsToResponse(rawStandings, "wnba") : null,
		[rawStandings],
	);

	// Local state for immediate UI feedback
	const [activeView, setActiveView] = useState<ViewType>(() =>
		getInitialView(searchConference),
	);

	// Sync local state when URL changes (e.g., browser back/forward)
	useEffect(() => {
		if (
			searchConference === "combined" ||
			searchConference === "eastern" ||
			searchConference === "western"
		) {
			setActiveView(searchConference);
		}
	}, [searchConference]);

	const handleViewChange = (value: string) => {
		const newView = value as ViewType;
		setActiveView(newView);
		navigate({
			to: "/wnba/standings",
			search: { conference: newView },
			replace: true,
		});
	};

	if (!standings) {
		return null;
	}

	// Combine and sort all teams by wins/winPct for the combined view
	const combinedTeams = [
		...standings.eastern.teams,
		...standings.western.teams,
	].sort((a, b) => {
		if (b.wins !== a.wins) return b.wins - a.wins;
		return b.winPct - a.winPct;
	});

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
					value={activeView}
					onValueChange={handleViewChange}
					className="w-full"
				>
					<div className="flex justify-center mb-6">
						<TabsList responsive={false}>
							<TabsTrigger value="combined">League</TabsTrigger>
							<TabsTrigger value="eastern">Eastern</TabsTrigger>
							<TabsTrigger value="western">Western</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="combined">
						<StandingsTable
							teams={combinedTeams}
							league="wnba"
							showSections={true}
						/>
					</TabsContent>

					<TabsContent value="eastern">
						<StandingsTable
							teams={standings.eastern.teams}
							league="wnba"
							showSections={false}
						/>
					</TabsContent>

					<TabsContent value="western">
						<StandingsTable
							teams={standings.western.teams}
							league="wnba"
							showSections={false}
						/>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { useState, useEffect, useMemo } from "react";
import { getTeamStaticData } from "@/lib/teams";
import { getCurrentSeason } from "@/lib/shared/season";
import {
	convexTeamToOverview,
	convexTeamToStats,
	convexRosterToPlayers,
	convexScheduleToGames,
	deriveTeamLeaders,
	convexGameLogToTrendData,
} from "@/lib/shared/convex-adapters";
import { teamInjuriesQueryOptions } from "@/lib/gleague/team.queries";
import {
	TeamDetailsLayout,
	TeamDetailsPending,
} from "@/components/team-details/team-details-layout";
import type { Id } from "@convex/_generated/dataModel";

interface TeamSearchParams {
	tab?: string;
}

const season = getCurrentSeason();

export const Route = createFileRoute("/_default/gleague/team/$teamId")({
	validateSearch: (search: Record<string, unknown>): TeamSearchParams => {
		return {
			tab: typeof search.tab === "string" ? search.tab : undefined,
		};
	},
	loader: async ({ context, params }) => {
		// Look up ESPN team ID from static registry (params.teamId is the slug)
		const staticData = getTeamStaticData("gleague", params.teamId);
		const espnTeamId = staticData?.api.id;

		if (espnTeamId) {
			// Fetch team data from Convex (this gives us the Convex _id for subsequent queries)
			const team = await context.queryClient.ensureQueryData(
				convexQuery(api.gleague.queries.getTeam, { espnTeamId, season }),
			);

			if (team) {
				// Fetch roster and schedule in parallel
				await Promise.all([
					context.queryClient.ensureQueryData(
						convexQuery(api.gleague.queries.getTeamRoster, { teamId: team._id as Id<"gleagueTeam"> }),
					),
					context.queryClient.ensureQueryData(
						convexQuery(api.gleague.queries.getTeamSchedule, { teamId: team._id as Id<"gleagueTeam"> }),
					),
				]);
			}
		}
	},
	pendingComponent: TeamDetailsPending,
	component: GleagueTeamPage,
});

function GleagueTeamPage() {
	const { teamId: teamSlug } = Route.useParams();
	const { tab } = Route.useSearch();
	const navigate = useNavigate();

	// Resolve slug → ESPN team ID
	const staticData = getTeamStaticData("gleague", teamSlug);
	const espnTeamId = staticData?.api.id ?? "";

	// Fetch team data from Convex
	const { data: rawTeam } = useQuery(
		convexQuery(api.gleague.queries.getTeam, { espnTeamId, season }),
	);

	// Use team._id for related queries
	const teamId = rawTeam?._id as Id<"gleagueTeam"> | undefined;

	const { data: rawRoster } = useQuery({
		...convexQuery(api.gleague.queries.getTeamRoster, { teamId: teamId! }),
		enabled: !!teamId,
	});

	const { data: rawSchedule } = useQuery({
		...convexQuery(api.gleague.queries.getTeamSchedule, { teamId: teamId! }),
		enabled: !!teamId,
	});

	const { data: rawGameLog } = useQuery({
		...convexQuery(api.gleague.queries.getTeamGameLog, { teamId: teamId! }),
		enabled: !!teamId,
	});

	// Injuries still from ESPN
	const { data: injuries } = useQuery(teamInjuriesQueryOptions(teamSlug));

	// Transform Convex data to component types
	const overview = useMemo(
		() => rawTeam ? convexTeamToOverview(rawTeam, "gleague") : null,
		[rawTeam],
	);

	const stats = useMemo(
		() => rawTeam ? convexTeamToStats(rawTeam) : undefined,
		[rawTeam],
	);

	const roster = useMemo(
		() => convexRosterToPlayers(rawRoster ?? []),
		[rawRoster],
	);

	const schedule = useMemo(
		() => convexScheduleToGames(rawSchedule ?? [], "gleague"),
		[rawSchedule],
	);

	const leaders = useMemo(
		() => deriveTeamLeaders(roster),
		[roster],
	);

	const gameLog = useMemo(
		() => convexGameLogToTrendData(rawGameLog ?? []),
		[rawGameLog],
	);

	// Local state for immediate UI feedback
	const [activeTab, setActiveTab] = useState(tab || "overview");

	// Sync local state when URL changes
	useEffect(() => {
		setActiveTab(tab || "overview");
	}, [tab]);

	const handleTabChange = (newTab: string) => {
		setActiveTab(newTab);
		navigate({
			to: "/gleague/team/$teamId",
			params: { teamId: teamSlug },
			search: { tab: newTab },
			replace: true,
		});
	};

	if (!overview) {
		return (
			<div className="container py-12">
				<p className="text-center text-muted-foreground">Team not found</p>
			</div>
		);
	}

	return (
		<TeamDetailsLayout
			overview={overview}
			providerRoster={roster}
			schedule={schedule}
			providerStats={stats}
			leaders={leaders}
			injuries={injuries ?? []}
			gameLog={gameLog}
			league="gleague"
			activeTab={activeTab}
			onTabChange={handleTabChange}
		/>
	);
}

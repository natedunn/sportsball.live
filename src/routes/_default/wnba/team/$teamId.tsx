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
import { syncGamesForView } from "@/lib/shared/sync.server";
import { teamInjuriesQueryOptions } from "@/lib/wnba/team.queries";
import {
	TeamDetailsLayout,
	TeamDetailsPending,
} from "@/components/team-details/team-details-layout";
import type { Id } from "@convex/_generated/dataModel";

interface TeamSearchParams {
	tab?: string;
}

const season = getCurrentSeason();
const LIVE_REFRESH_INTERVAL_MS = 30_000;

export const Route = createFileRoute("/_default/wnba/team/$teamId")({
	validateSearch: (search: Record<string, unknown>): TeamSearchParams => {
		return {
			tab: typeof search.tab === "string" ? search.tab : undefined,
		};
	},
	loader: async ({ context, params }) => {
		// Look up ESPN team ID from static registry (params.teamId is the slug)
		const staticData = getTeamStaticData("wnba", params.teamId);
		const espnTeamId = staticData?.api.id;

		if (espnTeamId) {
			// Fetch team data from Convex (this gives us the Convex _id for subsequent queries)
			const team = await context.queryClient.ensureQueryData(
				convexQuery(api.wnba.queries.getTeam, { espnTeamId, season }),
			);

			if (team) {
				const nowMs = Date.now();
				// Fetch roster and schedule in parallel
				const [, rawSchedule] = await Promise.all([
					context.queryClient.ensureQueryData(
						convexQuery(api.wnba.queries.getTeamRoster, { teamId: team._id as Id<"wnbaTeam"> }),
					),
					context.queryClient.ensureQueryData(
						convexQuery(api.wnba.queries.getTeamSchedule, { teamId: team._id as Id<"wnbaTeam"> }),
					),
				]);
				const scheduleForSync = (rawSchedule ?? []) as Array<{
					espnGameId: string;
					eventStatus?: string;
					scheduledStart?: number;
					lastFetchedAt?: number;
				}>;

				await syncGamesForView({
					data: {
						league: "wnba",
						games: scheduleForSync
							.filter((game) => {
								if (
									game.eventStatus === "completed" ||
									game.eventStatus === "postponed" ||
									game.eventStatus === "cancelled"
								) {
									return false;
								}
								if (typeof game.scheduledStart !== "number") return false;
								const minutesFromTipoff = (nowMs - game.scheduledStart) / 60_000;
								return minutesFromTipoff >= -90 && minutesFromTipoff <= 360;
							})
							.map((game) => ({
								espnGameId: game.espnGameId,
								eventStatus: game.eventStatus,
								scheduledStart: game.scheduledStart,
								lastFetchedAt: game.lastFetchedAt,
							})),
					},
				});

				await context.queryClient.ensureQueryData(
					convexQuery(api.wnba.queries.getTeamSchedule, { teamId: team._id as Id<"wnbaTeam"> }),
				);
			}
		}
	},
	pendingComponent: TeamDetailsPending,
	component: WnbaTeamPage,
});

function WnbaTeamPage() {
	const { teamId: teamSlug } = Route.useParams();
	const { tab } = Route.useSearch();
	const navigate = useNavigate();

	// Resolve slug → ESPN team ID
	const staticData = getTeamStaticData("wnba", teamSlug);
	const espnTeamId = staticData?.api.id ?? "";

	// Fetch team data from Convex
	const { data: rawTeam } = useQuery(
		convexQuery(api.wnba.queries.getTeam, { espnTeamId, season }),
	);

	// Use team._id for related queries
	const teamId = rawTeam?._id as Id<"wnbaTeam"> | undefined;

	const { data: rawRoster } = useQuery({
		...convexQuery(api.wnba.queries.getTeamRoster, { teamId: teamId! }),
		enabled: !!teamId,
	});

	const { data: rawSchedule, refetch: refetchSchedule } = useQuery({
		...convexQuery(api.wnba.queries.getTeamSchedule, { teamId: teamId! }),
		enabled: !!teamId,
	});

	const { data: rawGameLog } = useQuery({
		...convexQuery(api.wnba.queries.getTeamGameLog, { teamId: teamId! }),
		enabled: !!teamId,
	});

	// Injuries still from ESPN
	const { data: injuries } = useQuery(teamInjuriesQueryOptions(teamSlug));

	// Transform Convex data to component types
	const overview = useMemo(
		() => rawTeam ? convexTeamToOverview(rawTeam, "wnba") : null,
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
		() => convexScheduleToGames(rawSchedule ?? [], "wnba"),
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

	useEffect(() => {
		if (!teamId) return;
		if (activeTab !== "overview" && activeTab !== "games") return;

		const syncNow = async () => {
			if (document.visibilityState !== "visible") return;

			const nowMs = Date.now();
			const scheduleForSync = (rawSchedule ?? []) as Array<{
				espnGameId: string;
				eventStatus?: string;
				scheduledStart?: number;
				lastFetchedAt?: number;
			}>;
			const games = scheduleForSync
				.filter((game) => {
					if (
						game.eventStatus === "completed" ||
						game.eventStatus === "postponed" ||
						game.eventStatus === "cancelled"
					) {
						return false;
					}
					if (typeof game.scheduledStart !== "number") return false;
					const minutesFromTipoff = (nowMs - game.scheduledStart) / 60_000;
					return minutesFromTipoff >= -90 && minutesFromTipoff <= 360;
				})
				.map((game) => ({
					espnGameId: game.espnGameId,
					eventStatus: game.eventStatus,
					scheduledStart: game.scheduledStart,
					lastFetchedAt: game.lastFetchedAt,
				}));

			if (games.length === 0) return;

			await syncGamesForView({
				data: {
					league: "wnba",
					games,
				},
			});

			await refetchSchedule();
		};

		const intervalId = window.setInterval(() => {
			void syncNow();
		}, LIVE_REFRESH_INTERVAL_MS);

		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void syncNow();
			}
		};

		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [activeTab, rawSchedule, refetchSchedule, teamId]);

	const handleTabChange = (newTab: string) => {
		setActiveTab(newTab);
		navigate({
			to: "/wnba/team/$teamId",
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
			league="wnba"
			teamSlug={teamSlug}
			activeTab={activeTab}
			onTabChange={handleTabChange}
		/>
	);
}

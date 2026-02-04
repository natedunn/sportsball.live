import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import {
  teamOverviewQueryOptions,
  teamRosterQueryOptions,
  teamScheduleQueryOptions,
  teamStatsQueryOptions,
  teamLeadersQueryOptions,
  teamInjuriesQueryOptions,
} from "@/lib/wnba/team.queries";
import { teamStatsQueryOptions as convexTeamStatsQueryOptions, teamRecentGamesQueryOptions } from "@/lib/team-stats.queries";
import { playerStatsByTeamQueryOptions } from "@/lib/player-stats.queries";
import { TeamDetailsLayout, TeamDetailsPending } from "@/components/team-details/team-details-layout";
import type { RosterPlayer } from "@/lib/types/team";

interface TeamSearchParams {
  tab?: string;
}

export const Route = createFileRoute("/_default/wnba/team/$teamId")({
  validateSearch: (search: Record<string, unknown>): TeamSearchParams => {
    return {
      tab: typeof search.tab === "string" ? search.tab : undefined,
    };
  },
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      teamOverviewQueryOptions(params.teamId)
    );
  },
  pendingComponent: TeamDetailsPending,
  component: WnbaTeamPage,
});

function WnbaTeamPage() {
  const { teamId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  const { data: overview } = useQuery(teamOverviewQueryOptions(teamId));
  const { data: espnRoster } = useQuery(teamRosterQueryOptions(teamId));
  const { data: schedule } = useQuery(teamScheduleQueryOptions(teamId));
  const { data: espnStats } = useQuery(teamStatsQueryOptions(teamId));
  const { data: leaders } = useQuery(teamLeadersQueryOptions(teamId));
  const { data: injuries } = useQuery(teamInjuriesQueryOptions(teamId));

  // Fetch Convex team stats (has computed ratings)
  const { data: convexTeamStats = [] } = useQuery(convexTeamStatsQueryOptions("wnba"));

  // Fetch all games for rolling averages and season trends
  const { data: recentGames = [] } = useQuery({
    ...teamRecentGamesQueryOptions("wnba", overview?.id ?? "", 100),
    enabled: !!overview?.id,
  });

  // Fetch Convex player stats (has GP, 3P%, etc. not available from roster endpoint)
  const { data: convexPlayerStats = [] } = useQuery({
    ...playerStatsByTeamQueryOptions("wnba", overview?.id ?? ""),
    enabled: !!overview?.id,
  });

  // Merge ESPN roster with Convex player stats
  const roster = useMemo((): RosterPlayer[] => {
    if (!espnRoster) return [];

    return espnRoster.map((player): RosterPlayer => {
      // Find matching player in Convex data
      const convexPlayer = convexPlayerStats.find((p) => p.playerId === player.id);

      if (convexPlayer) {
        // Use Convex stats for fields not available from ESPN roster endpoint
        return {
          ...player,
          stats: {
            gp: convexPlayer.gamesPlayed || player.stats.gp,
            gs: convexPlayer.gamesStarted || player.stats.gs,
            mpg: convexPlayer.minutesPerGame || player.stats.mpg,
            ppg: convexPlayer.pointsPerGame || player.stats.ppg,
            rpg: convexPlayer.reboundsPerGame || player.stats.rpg,
            apg: convexPlayer.assistsPerGame || player.stats.apg,
            spg: convexPlayer.stealsPerGame || player.stats.spg,
            bpg: convexPlayer.blocksPerGame || player.stats.bpg,
            topg: convexPlayer.turnoversPerGame || player.stats.topg,
            fgPct: convexPlayer.fieldGoalPct / 100 || player.stats.fgPct,
            threePct: convexPlayer.threePointPct / 100 || player.stats.threePct,
            ftPct: convexPlayer.freeThrowPct / 100 || player.stats.ftPct,
          },
        };
      }

      return player;
    });
  }, [espnRoster, convexPlayerStats]);

  // Merge ESPN stats with Convex stats for ratings (ranks come from Convex DB)
  const stats = useMemo(() => {
    if (!espnStats) return undefined;

    // Find matching team in Convex data by ESPN ID
    const convexTeam = overview?.id
      ? convexTeamStats.find((t) => t.teamId === overview.id)
      : undefined;

    // If we have Convex data with valid ratings, use it for the scoring stats
    if (convexTeam && convexTeam.offensiveRating > 0) {
      return {
        ...espnStats,
        scoring: {
          ...espnStats.scoring,
          ppg: convexTeam.pointsFor || espnStats.scoring.ppg,
          oppPpg: convexTeam.pointsAgainst || espnStats.scoring.oppPpg,
          pace: convexTeam.pace || espnStats.scoring.pace,
          ortg: convexTeam.offensiveRating,
          drtg: convexTeam.defensiveRating,
          netRtg: convexTeam.netRating,
        },
        // Use ranks from Convex database (calculated during cron job)
        ranks: {
          // Scoring ranks
          rankPpg: convexTeam.rankPpg,
          rankOppPpg: convexTeam.rankOppPpg,
          rankMargin: convexTeam.rankMargin,
          rankPace: convexTeam.rankPace,
          rankOrtg: convexTeam.rankOrtg,
          rankDrtg: convexTeam.rankDrtg,
          rankNetRtg: convexTeam.rankNetRtg,
          // Shooting ranks
          rankFgPct: convexTeam.rankFgPct,
          rankThreePct: convexTeam.rankThreePct,
          rankFtPct: convexTeam.rankFtPct,
          rankEfgPct: convexTeam.rankEfgPct,
          rankTsPct: convexTeam.rankTsPct,
          // Rebounding ranks
          rankRpg: convexTeam.rankRpg,
          rankOrpg: convexTeam.rankOrpg,
          rankDrpg: convexTeam.rankDrpg,
          // Playmaking ranks
          rankApg: convexTeam.rankApg,
          rankTov: convexTeam.rankTov,
          rankAstToRatio: convexTeam.rankAstToRatio,
          // Defense ranks
          rankSpg: convexTeam.rankSpg,
          rankBpg: convexTeam.rankBpg,
        },
      };
    }

    return espnStats;
  }, [espnStats, convexTeamStats, overview?.id]);

  const [activeTab, setActiveTab] = useState(tab || "overview");

  useEffect(() => {
    setActiveTab(tab || "overview");
  }, [tab]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    navigate({
      to: "/wnba/team/$teamId",
      params: { teamId },
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
      roster={roster ?? []}
      schedule={schedule ?? []}
      stats={stats}
      recentGames={recentGames}
      leaders={leaders ?? []}
      injuries={injuries ?? []}
      league="wnba"
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  );
}

import { OverviewTab } from "./overview/overview-tab";
import { RosterTab } from "./roster/roster-tab";
import { GamesTab } from "./games/games-tab";
import { StatsTab } from "./stats/stats-tab";
import { TrendsCard } from "./stats/trends-card";
import { useTeamDetails } from "./team-details-layout";

// Team tab pages. Each league's team child routes render these; the data
// comes from the team layout route.

export function TeamOverviewPage() {
	const { overview, stats, leaders, injuries, schedule, league, teamSlug } =
		useTeamDetails();

	const recentGames = schedule
		.filter((g) => g.state === "post")
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, 3);
	const upcomingGames = schedule
		.filter((g) => g.state === "pre" || g.state === "in")
		.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
		.slice(0, 3);

	return (
		<OverviewTab
			overview={overview}
			stats={stats}
			leaders={leaders}
			injuries={injuries}
			recentGames={recentGames}
			upcomingGames={upcomingGames}
			league={league}
			teamSlug={teamSlug}
		/>
	);
}

export function TeamRosterPage() {
	const { roster, league } = useTeamDetails();
	return <RosterTab roster={roster} league={league} />;
}

export function TeamGamesPage() {
	const { schedule, overview, league } = useTeamDetails();
	return <GamesTab games={schedule} teamId={overview.id} league={league} />;
}

export function TeamStatsPage() {
	const { stats } = useTeamDetails();
	return <StatsTab stats={stats} />;
}

export function TeamTrendsPage() {
	const { gameLog } = useTeamDetails();

	if (gameLog.length < 2) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<h3 className="text-lg font-semibold mb-1">Trends Unavailable</h3>
				<p className="text-sm text-muted-foreground max-w-sm">
					Need at least 2 games of data to show trends.
				</p>
			</div>
		);
	}

	return <TrendsCard gameData={gameLog} />;
}

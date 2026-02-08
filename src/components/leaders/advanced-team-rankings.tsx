import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { getCurrentSeason } from "@/lib/shared/season";
import { Card } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import { FavoriteStar } from "@/components/ui/favorite-star";
import { useIsDarkMode } from "@/lib/use-is-dark-mode";
import { useFavorites } from "@/lib/use-favorites";
import type { League } from "@/lib/shared/league";
import { getTeamStaticData } from "@/lib/teams";

interface AdvancedTeamRankingsProps {
	league: League;
}

interface TeamStat {
	_id: string;
	espnTeamId: string;
	name: string;
	abbreviation: string;
	wins: number;
	losses: number;
	offensiveRating?: number;
	defensiveRating?: number;
	netRating?: number;
	pace?: number;
}

interface RankedTeam extends TeamStat {
	rank: number;
	statDisplay: string;
	// Looked up from static registry
	logoUrl: string;
	darkColor: string;
	lightColor: string;
}

const season = getCurrentSeason();

function getTeamStatsQuery(league: League): any {
	switch (league) {
		case "nba":
			return convexQuery(api.nba.queries.getAllTeamStats, { season });
		case "wnba":
			return convexQuery(api.wnba.queries.getAllTeamStats, { season });
		case "gleague":
			return convexQuery(api.gleague.queries.getAllTeamStats, { season });
	}
}

function TopTeam({
	team,
	category,
	statLabel,
	isFavorited,
}: {
	team: RankedTeam;
	category: string;
	statLabel: string;
	isFavorited: boolean;
}) {
	const isDarkMode = useIsDarkMode();
	const teamColor = isDarkMode ? team.darkColor : team.lightColor;

	return (
		<div className="flex items-start gap-4">
			<div
				className="flex size-16 items-center justify-center rounded-lg p-2"
				style={{ backgroundColor: `#${teamColor}15` }}
			>
				<Image
					src={team.logoUrl}
					alt={team.name}
					width={48}
					height={48}
					className="size-12 object-contain"
				/>
			</div>
			<div className="flex flex-col gap-0.5">
				<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					{category}
				</span>
				<div className="flex items-center gap-1">
					<span className="text-lg font-bold leading-tight">{team.name}</span>
					<FavoriteStar isFavorited={isFavorited} size="sm" showOnlyWhenFavorited />
				</div>
				<span className="text-sm text-muted-foreground">
					{team.wins}-{team.losses}
				</span>
				<div className="mt-1 flex items-baseline gap-1">
					<span className="text-2xl font-bold tabular-nums">
						{team.statDisplay}
					</span>
					<span className="text-sm text-muted-foreground">{statLabel}</span>
				</div>
			</div>
		</div>
	);
}

function RunnerUpTeam({
	team,
	statLabel,
	isFavorited,
}: {
	team: RankedTeam;
	statLabel: string;
	isFavorited: boolean;
}) {
	const isDarkMode = useIsDarkMode();
	const teamColor = isDarkMode ? team.darkColor : team.lightColor;

	return (
		<div className="flex items-center gap-3 py-1.5">
			<span className="w-4 text-center text-sm text-muted-foreground tabular-nums">
				{team.rank}
			</span>
			<div
				className="flex size-8 items-center justify-center rounded p-1"
				style={{ backgroundColor: `#${teamColor}15` }}
			>
				<Image
					src={team.logoUrl}
					alt={team.name}
					width={24}
					height={24}
					className="size-6 object-contain"
				/>
			</div>
			<div className="flex flex-1 flex-col">
				<div className="flex items-center gap-1">
					<span className="text-sm font-medium leading-tight">
						{team.abbreviation}
					</span>
					<FavoriteStar isFavorited={isFavorited} size="sm" showOnlyWhenFavorited />
				</div>
				<span className="text-xs text-muted-foreground">
					{team.wins}-{team.losses}
				</span>
			</div>
			<div className="flex items-baseline gap-1">
				<span className="font-semibold tabular-nums">{team.statDisplay}</span>
				<span className="text-xs text-muted-foreground">{statLabel}</span>
			</div>
		</div>
	);
}

function RankingCard({
	teams,
	category,
	statLabel,
	isFavorited,
}: {
	teams: RankedTeam[];
	category: string;
	statLabel: string;
	isFavorited: (teamId: string) => boolean;
}) {
	if (teams.length === 0) {
		return null;
	}

	const [topTeam, ...runnerUps] = teams;

	return (
		<Card classNames={{ inner: "flex-col overflow-hidden h-full" }}>
			<div className="relative flex-1 px-4 py-4 overflow-hidden">
				<div className="pointer-events-none absolute -left-12 -top-12 size-48 rounded-full bg-primary/10 blur-3xl" />
				<TopTeam team={topTeam} category={category} statLabel={statLabel} isFavorited={isFavorited(topTeam.espnTeamId)} />
			</div>

			{runnerUps.length > 0 && (
				<div className="flex flex-col border-t border-border px-4 py-4 mt-auto">
					{runnerUps.map((team) => (
						<RunnerUpTeam
							key={team._id}
							team={team}
							statLabel={statLabel}
							isFavorited={isFavorited(team.espnTeamId)}
						/>
					))}
				</div>
			)}
		</Card>
	);
}

export function AdvancedTeamRankings({ league }: AdvancedTeamRankingsProps) {
	const { isFavorited } = useFavorites();
	const { data: teams = [], isLoading } = useQuery(
		getTeamStatsQuery(league),
	) as {
		data: TeamStat[] | undefined;
		isLoading: boolean;
	};

	// Helper to check if a team is favorited
	const checkFavorited = (teamId: string) => isFavorited(league, teamId);

	if (isLoading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{[1, 2, 3].map((i) => (
					<div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
				))}
			</div>
		);
	}

	if (teams.length === 0) {
		return (
			<p className="text-sm text-destructive">
				Error loading team stats. Please try again later.
			</p>
		);
	}

	// Filter to only teams with valid ratings data (non-zero offensive rating)
	const teamsWithRatings = teams.filter((t) => (t.offensiveRating ?? 0) > 0);

	if (teamsWithRatings.length === 0) {
		return (
			<p className="text-sm text-destructive">
				Error loading team ratings data. Stats may not be available for this league.
			</p>
		);
	}

	// Helper to enrich team with static data from registry
	const enrichTeam = (team: TeamStat, rank: number, statDisplay: string): RankedTeam => {
		const staticData = getTeamStaticData(league, [team.espnTeamId, team.abbreviation]);
		return {
			...team,
			rank,
			statDisplay,
			logoUrl: staticData ? `/api/${league}/logo/${staticData.logoSlug}` : "",
			darkColor: staticData?.colors.display.dark ?? "000000",
			lightColor: staticData?.colors.display.light ?? "000000",
		};
	};

	// Sort and rank teams by offensive rating (higher is better)
	const topOffense: RankedTeam[] = [...teamsWithRatings]
		.sort((a, b) => (b.offensiveRating ?? 0) - (a.offensiveRating ?? 0))
		.slice(0, 5)
		.map((team, index) => enrichTeam(team, index + 1, (team.offensiveRating ?? 0).toFixed(1)));

	// Sort and rank teams by defensive rating (lower is better)
	const topDefense: RankedTeam[] = [...teamsWithRatings]
		.sort((a, b) => (a.defensiveRating ?? 0) - (b.defensiveRating ?? 0))
		.slice(0, 5)
		.map((team, index) => enrichTeam(team, index + 1, (team.defensiveRating ?? 0).toFixed(1)));

	// Sort and rank teams by net rating (higher is better)
	const topNetRating: RankedTeam[] = [...teamsWithRatings]
		.sort((a, b) => (b.netRating ?? 0) - (a.netRating ?? 0))
		.slice(0, 5)
		.map((team, index) => {
			const nr = team.netRating ?? 0;
			return enrichTeam(
				team,
				index + 1,
				nr > 0 ? `+${nr.toFixed(1)}` : nr.toFixed(1),
			);
		});

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<RankingCard teams={topOffense} category="Offense" statLabel="ORTG" isFavorited={checkFavorited} />
			<RankingCard teams={topDefense} category="Defense" statLabel="DRTG" isFavorited={checkFavorited} />
			<RankingCard
				teams={topNetRating}
				category="Net Rating"
				statLabel="NET"
				isFavorited={checkFavorited}
			/>
		</div>
	);
}

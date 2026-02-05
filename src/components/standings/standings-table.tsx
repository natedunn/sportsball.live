import { Link } from "@tanstack/react-router";
import { Image } from "@/components/ui/image";
import { Card } from "@/components/ui/card";
import { FavoriteStar } from "@/components/ui/favorite-star";
import { cn } from "@/lib/utils";
import { getTeamStaticData } from "@/lib/teams";
import { useFavorites } from "@/lib/use-favorites";
import type { StandingTeam } from "@/lib/types/standings";
import type { League } from "@/lib/shared/league";

interface StandingsTableProps {
	teams: StandingTeam[];
	league?: League;
	showSections?: boolean;
}

function SectionHeader({
	title,
	isFirst,
}: {
	title: string;
	isFirst?: boolean;
}) {
	return (
		<tr>
			<td
				colSpan={10}
				className={cn(
					"px-3 py-1.5 bg-muted/30 border-border/50",
					isFirst ? "border-b" : "border-y",
				)}
			>
				<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
					{title}
				</span>
			</td>
		</tr>
	);
}

const teamRoutes: Record<League, string> = {
	nba: "/nba/team/$teamId",
	wnba: "/wnba/team/$teamId",
	gleague: "/gleague/team/$teamId",
};

function TeamRow({
	team,
	rank,
	league,
	isFavorited,
}: {
	team: StandingTeam;
	rank: number;
	league: League;
	isFavorited: boolean;
}) {
	// Look up the team slug from the static registry
	const teamData = getTeamStaticData(league, team.id);
	const teamSlug = teamData?.api.slug;

	return (
		<tr className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors">
			<td className="px-3 py-2 text-center text-muted-foreground tabular-nums">
				{rank}
			</td>
			<td className="px-3 py-2">
				{teamSlug ? (
					<Link
						to={teamRoutes[league]}
						params={{ teamId: teamSlug }}
						className="flex items-center gap-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
					>
						<FavoriteStar isFavorited={isFavorited} size="sm" showOnlyWhenFavorited />
						<Image
							src={team.logo}
							alt={team.name}
							width={20}
							height={20}
							className="size-5 shrink-0 object-contain"
						/>
						<span className="w-10 shrink-0 font-medium">{team.abbreviation}</span>
						<span className="hidden truncate text-muted-foreground lg:inline">
							{team.name}
						</span>
					</Link>
				) : (
					<div className="flex items-center gap-2">
						<FavoriteStar isFavorited={isFavorited} size="sm" showOnlyWhenFavorited />
						<Image
							src={team.logo}
							alt={team.name}
							width={20}
							height={20}
							className="size-5 shrink-0 object-contain"
						/>
						<span className="w-10 shrink-0 font-medium">{team.abbreviation}</span>
						<span className="hidden truncate text-muted-foreground lg:inline">
							{team.name}
						</span>
					</div>
				)}
			</td>
			<td className="px-3 py-2 text-center tabular-nums">{team.wins}</td>
			<td className="px-3 py-2 text-center tabular-nums">{team.losses}</td>
			<td className="px-3 py-2 text-center tabular-nums">
				{team.winPct.toFixed(3).replace(/^0/, "")}
			</td>
			<td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
				{team.gamesBack === 0 ? "-" : team.gamesBack}
			</td>
			<td className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-muted-foreground">
				{team.homeRecord}
			</td>
			<td className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-muted-foreground">
				{team.awayRecord}
			</td>
			<td className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-muted-foreground">
				{team.last10}
			</td>
			<td className="px-3 py-2 text-center">
				<span
					className={
						team.streak.startsWith("W")
							? "text-green-600 dark:text-green-400"
							: team.streak.startsWith("L")
								? "text-red-600 dark:text-red-400"
								: "text-muted-foreground"
					}
				>
					{team.streak}
				</span>
			</td>
		</tr>
	);
}

export function StandingsTable({
	teams,
	league = "nba",
	showSections = true,
}: StandingsTableProps) {
	const { isFavorited } = useFavorites();

	// Determine if we should show sections based on league and override
	const shouldShowSections = showSections && league !== "wnba";

	const renderNbaSections = () => {
		const playoffTeams = teams.slice(0, 6);
		const playInTeams = teams.slice(6, 10);
		const outTeams = teams.slice(10);

		return (
			<>
				{playoffTeams.map((team, index) => (
					<TeamRow key={team.id} team={team} rank={index + 1} league={league} isFavorited={isFavorited(league, team.id)} />
				))}
				{playInTeams.length > 0 && (
					<>
						<SectionHeader title="Play-In Tournament" />
						{playInTeams.map((team, index) => (
							<TeamRow key={team.id} team={team} rank={index + 7} league={league} isFavorited={isFavorited(league, team.id)} />
						))}
					</>
				)}
				{outTeams.length > 0 && (
					<>
						<SectionHeader title="Out of Playoffs" />
						{outTeams.map((team, index) => (
							<TeamRow key={team.id} team={team} rank={index + 11} league={league} isFavorited={isFavorited(league, team.id)} />
						))}
					</>
				)}
			</>
		);
	};

	const renderGLeagueSections = () => {
		const byeTeams = teams.slice(0, 2);
		const playoffTeams = teams.slice(2, 8);
		const outTeams = teams.slice(8);

		return (
			<>
				<SectionHeader title="First Round Bye" isFirst />
				{byeTeams.map((team, index) => (
					<TeamRow key={team.id} team={team} rank={index + 1} league={league} isFavorited={isFavorited(league, team.id)} />
				))}
				{playoffTeams.length > 0 && (
					<>
						<SectionHeader title="Playoff Bound" />
						{playoffTeams.map((team, index) => (
							<TeamRow key={team.id} team={team} rank={index + 3} league={league} isFavorited={isFavorited(league, team.id)} />
						))}
					</>
				)}
				{outTeams.length > 0 && (
					<>
						<SectionHeader title="Out of Playoffs" />
						{outTeams.map((team, index) => (
							<TeamRow key={team.id} team={team} rank={index + 9} league={league} isFavorited={isFavorited(league, team.id)} />
						))}
					</>
				)}
			</>
		);
	};

	const renderWnbaCombinedSections = () => {
		const playoffTeams = teams.slice(0, 8);
		const outTeams = teams.slice(8);

		return (
			<>
				{playoffTeams.map((team, index) => (
					<TeamRow key={team.id} team={team} rank={index + 1} league={league} isFavorited={isFavorited(league, team.id)} />
				))}
				{outTeams.length > 0 && (
					<>
						<SectionHeader title="Out of Playoffs" />
						{outTeams.map((team, index) => (
							<TeamRow key={team.id} team={team} rank={index + 9} league={league} isFavorited={isFavorited(league, team.id)} />
						))}
					</>
				)}
			</>
		);
	};

	const renderSimpleList = () =>
		teams.map((team, index) => (
			<TeamRow key={team.id} team={team} rank={index + 1} league={league} isFavorited={isFavorited(league, team.id)} />
		));

	const renderBody = () => {
		// WNBA with showSections=true means combined view
		if (league === "wnba" && showSections) {
			return renderWnbaCombinedSections();
		}

		if (!shouldShowSections) {
			return renderSimpleList();
		}

		if (league === "nba") {
			return renderNbaSections();
		}

		if (league === "gleague") {
			return renderGLeagueSections();
		}

		return renderSimpleList();
	};

	return (
		<Card classNames={{ inner: "flex-col p-0" }}>
			<div className="overflow-x-auto">
				<table className="w-full text-sm table-fixed">
					<thead>
						<tr className="border-b border-border bg-muted/50">
							<th className="w-10 px-3 py-2 text-center font-medium text-muted-foreground">
								#
							</th>
							<th className="w-[140px] px-3 py-2 text-left font-medium text-muted-foreground lg:w-auto">
								Team
							</th>
							<th className="w-12 px-3 py-2 text-center font-medium text-muted-foreground">
								W
							</th>
							<th className="w-12 px-3 py-2 text-center font-medium text-muted-foreground">
								L
							</th>
							<th className="w-14 px-3 py-2 text-center font-medium text-muted-foreground">
								PCT
							</th>
							<th className="w-12 px-3 py-2 text-center font-medium text-muted-foreground">
								GB
							</th>
							<th className="w-16 px-3 py-2 text-center font-medium text-muted-foreground">
								Home
							</th>
							<th className="w-16 px-3 py-2 text-center font-medium text-muted-foreground">
								Away
							</th>
							<th className="w-14 px-3 py-2 text-center font-medium text-muted-foreground">
								L10
							</th>
							<th className="w-14 px-3 py-2 text-center font-medium text-muted-foreground">
								Strk
							</th>
						</tr>
					</thead>
					<tbody>{renderBody()}</tbody>
				</table>
			</div>
		</Card>
	);
}

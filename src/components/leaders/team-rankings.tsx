import { Card } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import type { StandingTeam } from "@/lib/types/standings";
import { useIsDarkMode } from "@/lib/use-is-dark-mode";

interface TeamRankingsProps {
	teams: StandingTeam[];
}

interface RankedTeam extends StandingTeam {
	rank: number;
	statValue: number;
	statDisplay: string;
}

function TopTeam({
	team,
	category,
	statLabel,
}: {
	team: RankedTeam;
	category: string;
	statLabel: string;
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
					src={team.logo}
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
				<span className="text-lg font-bold leading-tight">{team.name}</span>
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
}: {
	team: RankedTeam;
	statLabel: string;
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
					src={team.logo}
					alt={team.name}
					width={24}
					height={24}
					className="size-6 object-contain"
				/>
			</div>
			<div className="flex flex-1 flex-col">
				<span className="text-sm font-medium leading-tight">
					{team.abbreviation}
				</span>
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
}: {
	teams: RankedTeam[];
	category: string;
	statLabel: string;
}) {
	if (teams.length === 0) {
		return null;
	}

	const [topTeam, ...runnerUps] = teams;

	return (
		<Card classNames={{ inner: "flex-col overflow-hidden h-full" }}>
			<div className="relative flex-1 px-4 py-4 overflow-hidden">
				<div className="pointer-events-none absolute -left-12 -top-12 size-48 rounded-full bg-primary/10 blur-3xl" />
				<TopTeam team={topTeam} category={category} statLabel={statLabel} />
			</div>

			{runnerUps.length > 0 && (
				<div className="flex flex-col border-t border-border px-4 py-4 mt-auto">
					{runnerUps.map((team) => (
						<RunnerUpTeam key={team.id} team={team} statLabel={statLabel} />
					))}
				</div>
			)}
		</Card>
	);
}

export function TeamRankings({ teams }: TeamRankingsProps) {
	// Sort and rank teams by different metrics
	const topOffense: RankedTeam[] = [...teams]
		.sort((a, b) => b.pointsFor - a.pointsFor)
		.slice(0, 5)
		.map((team, index) => ({
			...team,
			rank: index + 1,
			statValue: team.pointsFor,
			statDisplay: team.pointsFor.toFixed(1),
		}));

	const topDefense: RankedTeam[] = [...teams]
		.sort((a, b) => a.pointsAgainst - b.pointsAgainst) // Lower is better
		.slice(0, 5)
		.map((team, index) => ({
			...team,
			rank: index + 1,
			statValue: team.pointsAgainst,
			statDisplay: team.pointsAgainst.toFixed(1),
		}));

	const topNetRating: RankedTeam[] = [...teams]
		.sort((a, b) => b.differential - a.differential)
		.slice(0, 5)
		.map((team, index) => ({
			...team,
			rank: index + 1,
			statValue: team.differential,
			statDisplay:
				team.differential > 0
					? `+${team.differential.toFixed(1)}`
					: team.differential.toFixed(1),
		}));

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<RankingCard teams={topOffense} category="Offense" statLabel="PPG" />
			<RankingCard
				teams={topDefense}
				category="Defense"
				statLabel="OPP PPG"
			/>
			<RankingCard
				teams={topNetRating}
				category="Net Rating"
				statLabel="DIFF"
			/>
		</div>
	);
}

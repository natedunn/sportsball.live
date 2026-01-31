import { Card } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import type { CategoryLeaders, LeaderEntry } from "@/lib/leaders/types";

interface LeagueLeadersProps {
	points: CategoryLeaders;
	assists: CategoryLeaders;
	rebounds: CategoryLeaders;
	stocks: CategoryLeaders;
}

function TopLeader({
	leader,
	category,
	showBreakdown = false,
}: {
	leader: LeaderEntry;
	category: CategoryLeaders;
	showBreakdown?: boolean;
}) {
	return (
		<div className="flex items-start gap-4 ">
			<Image
				src={leader.player.headshot}
				alt={leader.player.name}
				width={80}
				height={80}
				className="size-18 rounded-full bg-muted object-cover border"
			/>
			<div className="flex flex-col gap-0.5">
				<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					{category.displayName}
				</span>
				<span className="text-lg font-bold leading-tight">
					{leader.player.name}
				</span>
				<span className="text-sm text-muted-foreground">
					{leader.player.team.abbreviation}
				</span>
				<div className="mt-1 flex items-baseline gap-1">
					<span className="text-2xl font-bold tabular-nums">
						{leader.displayValue}
					</span>
					<span className="text-sm text-muted-foreground">
						{category.abbreviation}
					</span>
				</div>
				{showBreakdown && leader.breakdown && (
					<span className="text-xs text-muted-foreground">
						{leader.breakdown.steals.toFixed(1)} STL +{" "}
						{leader.breakdown.blocks.toFixed(1)} BLK
					</span>
				)}
			</div>
		</div>
	);
}

function RunnerUp({
	leader,
	rank,
	abbreviation,
	showBreakdown = false,
}: {
	leader: LeaderEntry;
	rank: number;
	abbreviation: string;
	showBreakdown?: boolean;
}) {
	return (
		<div className="flex items-center gap-3 py-1.5">
			<span className="w-4 text-center text-sm text-muted-foreground tabular-nums">
				{rank}
			</span>
			<Image
				src={leader.player.headshot}
				alt={leader.player.name}
				width={32}
				height={32}
				className="size-8 rounded-full bg-muted object-cover border"
			/>
			<div className="flex flex-1 flex-col">
				<span className="text-sm font-medium leading-tight">
					{leader.player.name}
				</span>
				<span className="text-xs text-muted-foreground">
					{leader.player.team.abbreviation}
				</span>
			</div>
			<div className="flex items-baseline gap-1">
				<span className="font-semibold tabular-nums">
					{leader.displayValue}
				</span>
				{showBreakdown && leader.breakdown ? (
					<span className="text-xs text-muted-foreground">
						({leader.breakdown.steals.toFixed(1)}s +{" "}
						{leader.breakdown.blocks.toFixed(1)}b)
					</span>
				) : (
					<span className="text-xs text-muted-foreground">{abbreviation}</span>
				)}
			</div>
		</div>
	);
}

function CategoryCard({
	category,
	showBreakdown = false,
}: {
	category: CategoryLeaders;
	showBreakdown?: boolean;
}) {
	if (category.leaders.length === 0) {
		return null;
	}

	const [topLeader, ...runnerUps] = category.leaders;

	return (
		<Card classNames={{ inner: "flex-col overflow-hidden h-full" }}>
			<div className="relative flex-1 px-4 py-4 overflow-hidden">
				<div className="pointer-events-none absolute -left-12 -top-12 size-48 rounded-full bg-primary/10 blur-3xl" />
				<TopLeader
					leader={topLeader}
					category={category}
					showBreakdown={showBreakdown}
				/>
			</div>

			{runnerUps.length > 0 && (
				<div className="flex flex-col border-t border-border px-4 py-4 mt-auto">
					{runnerUps.map((leader, index) => (
						<RunnerUp
							key={leader.player.id}
							leader={leader}
							rank={index + 2}
							abbreviation={category.abbreviation}
							showBreakdown={showBreakdown}
						/>
					))}
				</div>
			)}
		</Card>
	);
}

export function PlayerLeaders({
	points,
	assists,
	rebounds,
	stocks,
}: LeagueLeadersProps) {
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<CategoryCard category={points} />
			<CategoryCard category={assists} />
			<CategoryCard category={rebounds} />
			<CategoryCard category={stocks} showBreakdown />
		</div>
	);
}

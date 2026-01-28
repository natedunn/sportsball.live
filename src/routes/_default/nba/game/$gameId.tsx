import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { gameDetailsQueryOptions } from "@/lib/nba/game-details.queries";
import {
	StatComparison,
	StatComparisonGroup,
} from "@/components/stat-comparison";
import { formatGameDate } from "@/lib/date";
import { Image } from "@/components/ui/image";
import { Card } from "@/components/ui/card";
import { PaddedScore } from "@/components/score";
import { TeamFlickeringGrid } from "@/components/team-flickering-grid";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlayerBoxScore } from "@/components/player-box-score";
import { cn } from "@/lib/utils";

interface GameSearchParams {
	fromDate?: string;
}

export const Route = createFileRoute("/_default/nba/game/$gameId")({
	validateSearch: (search: Record<string, unknown>): GameSearchParams => {
		return {
			fromDate:
				typeof search.fromDate === "string" ? search.fromDate : undefined,
		};
	},
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			gameDetailsQueryOptions(params.gameId),
		);
	},
	pendingComponent: () => (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<div className="bg-linear-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
				<div className="flex flex-col items-center justify-center gap-2">
					<p className="text-muted-foreground">Loading game details...</p>
				</div>
			</div>
		</div>
	),
	component: GameDetailsPage,
});

function GameDetailsPage() {
	const { gameId } = Route.useParams();
	const { fromDate } = Route.useSearch();
	const { data: game } = useQuery(gameDetailsQueryOptions(gameId));

	if (!game) {
		return (
			<div className="container py-12">
				<p className="text-center text-muted-foreground">Game not found</p>
			</div>
		);
	}

	const awayColor = game.away.lightColor;
	const homeColor = game.home.lightColor;
	const maxDigits = Math.max(
		game.away.score.toString().length,
		game.home.score.toString().length,
	);

	const formatMadeAttempted = (made: number, attempted: number) =>
		`${made}-${attempted}`;

	return (
		<div className="flex flex-col pb-12 lg:pb-20">
			{/* Header with score */}
			<div className="pt-6 pb-10 border-b overflow-hidden bg-card">
				<div className="container">
					{/* Teams and Score */}
					<div className="flex items-center justify-center gap-4 md:gap-8">
						{/* Away Team */}
						<div
							className="flex flex-1 flex-col items-center gap-2 relative"
							id={game.away.uid}
						>
							<Image
								src={game.away.logo}
								alt={game.away.name ?? "Away team"}
								className="h-16 w-16 z-20 relative object-contain md:h-20 md:w-20"
							/>
							<span className="text-lg relative z-20 font-semibold md:text-xl">
								{game.away.name}
							</span>
							{game.away.record && (
								<span className="relative z-20 font-mono font-bold text-foreground/75 md:text-lg">
									{game.away.record}
								</span>
							)}
							<div className="flex items-center absolute -bottom-13">
								<div className="relative">
									<div
										className={
											"absolute inset-0 z-10 from-card from-40% to-transparent bg-linear-to-br"
										}
									/>
									<TeamFlickeringGrid
										dark={game.away.darkColor}
										light={game.away.lightColor}
									/>
								</div>
								<div className="relative">
									<div
										className={
											"absolute inset-0 z-10 from-card from-40% to-transparent bg-linear-to-bl"
										}
									/>
									<TeamFlickeringGrid
										dark={game.away.darkColor}
										light={game.away.lightColor}
									/>
								</div>
							</div>
						</div>

						{/* Score */}
						<div className="flex flex-col items-center gap-1 relative z-20">
							<div className="flex items-center gap-2 md:gap-4">
								<span
									className={`text-4xl font-bold tabular-nums md:text-5xl ${
										game.away.winner ? "" : "text-muted-foreground"
									}`}
								>
									<PaddedScore score={game.away.score} maxDigits={maxDigits} />
								</span>
								<span className="text-2xl text-muted-foreground md:text-3xl">
									—
								</span>
								<span
									className={`text-4xl font-bold tabular-nums md:text-5xl ${
										game.home.winner ? "" : "text-muted-foreground"
									}`}
								>
									<PaddedScore score={game.home.score} maxDigits={maxDigits} />
								</span>
							</div>
							<span className="text-sm text-muted-foreground">
								{game.statusDetail}
							</span>
							{game.venue && (
								<span className="text-xs text-muted-foreground">
									{game.venue}
								</span>
							)}
							{game.date && (
								<span className="text-xs text-muted-foreground">
									{formatGameDate(new Date(game.date))}
								</span>
							)}
						</div>

						{/* Home Team */}
						<div
							className="flex flex-1 flex-col items-center gap-2 relative"
							id={game.home.uid}
						>
							<Image
								src={game.home.logo}
								alt={game.home.name ?? "Home team"}
								className="h-16 w-16 z-20 relative object-contain md:h-20 md:w-20"
							/>
							<span className="text-lg relative z-20 font-semibold md:text-xl">
								{game.home.name}
							</span>
							{game.home.record && (
								<span className="relative z-20 font-mono font-bold text-foreground/75 md:text-lg">
									{game.home.record}
								</span>
							)}
							<div className="flex items-center absolute -bottom-13">
								<div className="relative">
									<div
										className={
											"absolute inset-0 z-10 from-card from-40% to-transparent bg-linear-to-br"
										}
									/>
									<TeamFlickeringGrid
										dark={game.home.darkColor}
										light={game.home.lightColor}
									/>
								</div>
								<div className="relative">
									<div
										className={
											"absolute inset-0 z-10 from-card from-40% to-transparent bg-linear-to-bl"
										}
									/>
									<TeamFlickeringGrid
										dark={game.home.darkColor}
										light={game.home.lightColor}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Tabbed Content */}
			<div className="relative bg-background">
				<div className="container py-8">
					<Tabs defaultValue="box-score" className="w-full">
						<div className="flex items-center mb-8">
							<Link
								to="/nba"
								search={fromDate ? { date: fromDate } : undefined}
								className="flex-1 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
							>
								<ArrowLeft className="h-4 w-4" />
								Back to scores
							</Link>
							<TabsList>
								<TabsTrigger value="box-score">Box Score</TabsTrigger>
								<TabsTrigger value="team-stats">Team Stats</TabsTrigger>
							</TabsList>
							<div className="flex-1" />
						</div>

						<TabsContent value="box-score">
							<div className="flex flex-col gap-6">
								<PlayerBoxScore
									team={game.away}
									accentColor={game.away.darkColor}
									isLive={game.state === "in"}
								/>
								<PlayerBoxScore
									team={game.home}
									accentColor={game.home.darkColor}
									isLive={game.state === "in"}
								/>
							</div>
						</TabsContent>

						<TabsContent value="team-stats">
							<div className="mx-auto">
								<Card classNames={{ inner: "flex-col" }}>
									<StatComparisonGroup title="Scoring" isFirst>
										<StatComparison
											label="Points in Paint"
											awayValue={game.away.stats.pointsInPaint}
											homeValue={game.home.stats.pointsInPaint}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
										/>
										<StatComparison
											label="Fast Break Pts"
											awayValue={game.away.stats.fastBreakPoints}
											homeValue={game.home.stats.fastBreakPoints}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
										/>
										<StatComparison
											label="Largest Lead"
											awayValue={game.away.stats.largestLead}
											homeValue={game.home.stats.largestLead}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
										/>
									</StatComparisonGroup>

									<StatComparisonGroup title="Shooting">
										<StatComparison
											label="FG%"
											awayValue={game.away.stats.fieldGoalPct}
											homeValue={game.home.stats.fieldGoalPct}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
											format="percent"
											awaySubValue={formatMadeAttempted(
												game.away.stats.fieldGoalsMade,
												game.away.stats.fieldGoalsAttempted,
											)}
											homeSubValue={formatMadeAttempted(
												game.home.stats.fieldGoalsMade,
												game.home.stats.fieldGoalsAttempted,
											)}
										/>
										<StatComparison
											label="3P%"
											awayValue={game.away.stats.threePointPct}
											homeValue={game.home.stats.threePointPct}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
											format="percent"
											awaySubValue={formatMadeAttempted(
												game.away.stats.threePointMade,
												game.away.stats.threePointAttempted,
											)}
											homeSubValue={formatMadeAttempted(
												game.home.stats.threePointMade,
												game.home.stats.threePointAttempted,
											)}
										/>
										<StatComparison
											label="FT%"
											awayValue={game.away.stats.freeThrowPct}
											homeValue={game.home.stats.freeThrowPct}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
											format="percent"
											awaySubValue={formatMadeAttempted(
												game.away.stats.freeThrowsMade,
												game.away.stats.freeThrowsAttempted,
											)}
											homeSubValue={formatMadeAttempted(
												game.home.stats.freeThrowsMade,
												game.home.stats.freeThrowsAttempted,
											)}
										/>
									</StatComparisonGroup>

									<StatComparisonGroup title="Rebounding">
										<StatComparison
											label="Total Rebounds"
											awayValue={game.away.stats.totalRebounds}
											homeValue={game.home.stats.totalRebounds}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
										/>
										<StatComparison
											label="Offensive Reb"
											awayValue={game.away.stats.offensiveRebounds}
											homeValue={game.home.stats.offensiveRebounds}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
										/>
										<StatComparison
											label="Defensive Reb"
											awayValue={game.away.stats.defensiveRebounds}
											homeValue={game.home.stats.defensiveRebounds}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
										/>
									</StatComparisonGroup>

									<StatComparisonGroup title="Playmaking">
										<StatComparison
											label="Assists"
											awayValue={game.away.stats.assists}
											homeValue={game.home.stats.assists}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
										/>
										<StatComparison
											label="Turnovers"
											awayValue={game.away.stats.turnovers}
											homeValue={game.home.stats.turnovers}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
											higherIsBetter={false}
										/>
									</StatComparisonGroup>

									<StatComparisonGroup title="Defense">
										<StatComparison
											label="Steals"
											awayValue={game.away.stats.steals}
											homeValue={game.home.stats.steals}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
										/>
										<StatComparison
											label="Blocks"
											awayValue={game.away.stats.blocks}
											homeValue={game.home.stats.blocks}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
										/>
										<StatComparison
											label="Fouls"
											awayValue={game.away.stats.fouls}
											homeValue={game.home.stats.fouls}
											awayColor={game.away.darkColor}
											homeColor={game.home.darkColor}
											higherIsBetter={false}
										/>
									</StatComparisonGroup>
								</Card>
							</div>
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	);
}

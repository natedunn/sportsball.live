import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { formatGameDate } from "@/lib/date";
import { PaddedScore } from "@/components/score";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { PlayerBoxScore } from "@/components/player-box-score";
import { GameTeamHeader } from "@/components/game-team-header";
import { TeamStatsCard } from "@/components/team-stats-card";
import type { GameDetails } from "@/lib/nba/game-details.server";

type League = "nba" | "wnba" | "gleague";

const leagueScoresRoutes: Record<League, string> = {
	nba: "/nba/scores",
	wnba: "/wnba/scores",
	gleague: "/gleague/scores",
};

interface GameDetailsLayoutProps {
	game: GameDetails;
	league: League;
	fromDate: string | undefined;
}

export function GameDetailsLayout({
	game,
	league,
	fromDate,
}: GameDetailsLayoutProps) {
	const maxDigits = Math.max(
		game.away.score.toString().length,
		game.home.score.toString().length,
	);

	return (
		<div className="flex flex-col pb-12 lg:pb-20">
			{/* Header with score */}
			<div className="pt-6 pb-6 border-b overflow-hidden bg-card">
				<div className="container">
					{/* Teams and Score */}
					<div className="flex items-center justify-center gap-4 md:gap-8">
						<GameTeamHeader team={game.away} />

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
							{game.date ? (
								<Tooltip content={formatGameDate(new Date(game.date))}>
									<span className="text-muted-foreground cursor-default border-b border-dashed border-muted-foreground/50">
										{game.statusDetail}
									</span>
								</Tooltip>
							) : (
								<span className="text-sm text-muted-foreground">
									{game.statusDetail}
								</span>
							)}
							{game.venue && (
								<span className="text-xs text-muted-foreground">
									{game.venue}
								</span>
							)}
						</div>

						<GameTeamHeader team={game.home} />
					</div>
				</div>
			</div>

			{/* Tabbed Content */}
			<div className="relative bg-background">
				<div className="container py-8">
					<Tabs defaultValue="box-score" className="w-full">
						<div className="flex items-center justify-between mb-8">
							<Link
								to={leagueScoresRoutes[league]}
								search={fromDate ? { date: fromDate } : undefined}
								className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
							>
								<ArrowLeft className="h-4 w-4" />
								Back to scores
							</Link>
							<TabsList>
								<TabsTrigger value="box-score">Box Score</TabsTrigger>
								<TabsTrigger value="team-stats">Team Stats</TabsTrigger>
							</TabsList>
							<div className="w-[108px]" />
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
								<TeamStatsCard away={game.away} home={game.home} />
							</div>
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	);
}

export function GameDetailsPending() {
	return (
		<div className="flex flex-col gap-8 pb-12 lg:pb-20">
			<div className="bg-linear-to-b from-muted/70 to-transparent pt-12 dark:from-muted/30">
				<div className="flex flex-col items-center justify-center gap-2">
					<p className="text-muted-foreground">Loading game details...</p>
				</div>
			</div>
		</div>
	);
}

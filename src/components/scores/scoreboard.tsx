import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Competitor } from "./competitor";
import { Score } from "./score";
import { cn } from "@/lib/utils";
import { formatGameDate } from "@/lib/date";
import { useFavorites } from "@/lib/use-favorites";
import { leagueLabels, type League } from "@/lib/teams";
import { leagueGameRoutes } from "@/lib/league-routes";
import type { GameData } from "@/lib/types";

/**
 * - `card`: its own card, status and box score link on one line
 * - `list`: `card` with each logo beside its team name and record (from sm up)
 * - `compact`: its own card, sized for half the page
 */
export type ScoreboardVariant = "card" | "list" | "compact";

interface ScoreboardProps {
	game: GameData;
	currentDate?: string;
	league?: League;
	showLeagueTag?: boolean;
	variant?: ScoreboardVariant;
}

export function Scoreboard({
	game,
	currentDate,
	league = "nba",
	showLeagueTag = false,
	variant = "card",
}: ScoreboardProps) {
	const { isFavorited } = useFavorites();
	const homeTeam = game.home;
	const awayTeam = game.away;
	const isCompact = variant === "compact";
	const hasScore = game.state === "in" || game.state === "post";

	const classes = isCompact
		? { wrapper: "w-28 shrink-0 p-3 sm:w-32", logo: "sm:w-8 md:w-8" }
		: variant === "list"
			? {
					wrapper: "p-4 sm:min-w-44 sm:items-stretch sm:px-6 sm:py-6 md:min-w-52",
					content: "sm:flex-row sm:items-start sm:justify-start sm:gap-3",
					logo: "sm:w-11 md:w-13",
					info: "sm:items-start",
					team: "sm:text-base",
				}
			: { wrapper: "p-4 md:min-w-32.5 lg:min-w-44" };

	// In the list the home side mirrors the away side: logo at the outer edge
	const homeClasses =
		variant === "list"
			? {
					...classes,
					content: cn(classes.content, "sm:flex-row-reverse"),
					info: "sm:items-end",
				}
			: classes;

	const status = game.time.detail && (
		<span className="text-muted-foreground">
			{game.state === "pre" && game.time.start
				? `Starts ${formatGameDate(new Date(game.time.start), true)}`
				: game.time.detail}
		</span>
	);

	const boxScoreLink = hasScore && (
		<Link
			to={leagueGameRoutes[league]}
			params={{ gameId: game.id }}
			search={currentDate ? { fromDate: currentDate } : undefined}
			className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground hover:underline focus:text-foreground focus:underline"
		>
			<span>Box score</span>
		</Link>
	);

	const content = (
		<>
			{showLeagueTag && (
				<span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-b bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
					{leagueLabels[league]}
				</span>
			)}
			<Competitor homeAway="away" league={league} classes={classes} showLocation={variant === "list"} team={awayTeam} isFavorited={isFavorited(league, awayTeam.id)} />
			<div
				className={cn(
					"flex min-w-0 flex-col items-center justify-center gap-2",
					isCompact && "gap-1 px-1 py-3 text-center text-sm",
					variant === "list" && "py-4",
				)}
			>
				<div>
					{hasScore && (
						<Score
							awayScore={Number(awayTeam.score)}
							homeScore={Number(homeTeam.score)}
							gameState={game.state}
							classes={isCompact ? { score: "md:text-2xl" } : undefined}
						/>
					)}
				</div>
				{isCompact ? (
					<>
						{status}
						{boxScoreLink}
					</>
				) : (
					<div className="flex items-center justify-center gap-2">
						{status}
						{boxScoreLink && (
							<>
								<span aria-hidden className="text-muted-foreground">·</span>
								{boxScoreLink}
							</>
						)}
					</div>
				)}
			</div>
			<Competitor homeAway="home" league={league} classes={homeClasses} showLocation={variant === "list"} team={homeTeam} isFavorited={isFavorited(league, homeTeam.id)} />
		</>
	);

	return <Card>{content}</Card>;
}

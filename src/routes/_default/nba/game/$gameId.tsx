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

export const Route = createFileRoute("/_default/nba/game/$gameId")({
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
  const { data: game } = useQuery(gameDetailsQueryOptions(gameId));

  console.log(game);

  if (!game) {
    return (
      <div className="container py-12">
        <p className="text-center text-muted-foreground">Game not found</p>
      </div>
    );
  }

  const awayColor = game.away.lightColor;
  const homeColor = game.home.lightColor;

  return (
    <div className="flex flex-col gap-8 pb-12 lg:pb-20">
      {/* Header with score */}
      <div
        className="pt-8 pb-6"
        style={{
          background: `linear-gradient(135deg, #${awayColor}15 0%, transparent 50%, #${homeColor}15 100%)`,
        }}
      >
        <div className="container">
          <Link
            to="/nba"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to scores
          </Link>

          {/* Teams and Score */}
          <div className="flex items-center justify-center gap-4 md:gap-8">
            {/* Away Team */}
            <div className="flex flex-1 flex-col items-center gap-2 md:flex-row md:justify-end md:gap-4">
              <div className="flex flex-col items-center md:items-end">
                <span className="text-lg font-semibold md:text-xl">
                  {game.away.name}
                </span>
                <span className="text-xs text-muted-foreground md:text-sm">
                  {game.away.abbreviation}
                </span>
              </div>
              <Image
                src={game.away.logo}
                alt={game.away.name ?? "Away team"}
                className="h-16 w-16 object-contain md:h-20 md:w-20"
              />
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 md:gap-4">
                <span
                  className={`text-4xl font-bold tabular-nums md:text-5xl ${
                    game.away.winner ? "" : "text-muted-foreground"
                  }`}
                >
                  {game.away.score}
                </span>
                <span className="text-2xl text-muted-foreground md:text-3xl">
                  -
                </span>
                <span
                  className={`text-4xl font-bold tabular-nums md:text-5xl ${
                    game.home.winner ? "" : "text-muted-foreground"
                  }`}
                >
                  {game.home.score}
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
            <div className="flex flex-1 flex-col items-center gap-2 md:flex-row md:justify-start md:gap-4">
              <Image
                src={game.home.logo}
                alt={game.home.name ?? "Home team"}
                className="h-16 w-16 object-contain md:h-20 md:w-20"
              />
              <div className="flex flex-col items-center md:items-start">
                <span className="text-lg font-semibold md:text-xl">
                  {game.home.name}
                </span>
                <span className="text-xs text-muted-foreground md:text-sm">
                  {game.home.abbreviation}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Comparison */}
      <div className="container">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-6 text-center text-xl font-semibold">Team Stats</h2>

          <div className="flex flex-col gap-8">
            <StatComparisonGroup title="Scoring">
              <StatComparison
                label="Points in Paint"
                awayValue={game.away.stats.pointsInPaint}
                homeValue={game.home.stats.pointsInPaint}
                awayColor={awayColor}
                homeColor={homeColor}
              />
              <StatComparison
                label="Fast Break Pts"
                awayValue={game.away.stats.fastBreakPoints}
                homeValue={game.home.stats.fastBreakPoints}
                awayColor={awayColor}
                homeColor={homeColor}
              />
              <StatComparison
                label="Largest Lead"
                awayValue={game.away.stats.largestLead}
                homeValue={game.home.stats.largestLead}
                awayColor={awayColor}
                homeColor={homeColor}
              />
            </StatComparisonGroup>

            <StatComparisonGroup title="Shooting">
              <StatComparison
                label="FG%"
                awayValue={game.away.stats.fieldGoalPct}
                homeValue={game.home.stats.fieldGoalPct}
                awayColor={awayColor}
                homeColor={homeColor}
                format="percent"
              />
              <StatComparison
                label="3P%"
                awayValue={game.away.stats.threePointPct}
                homeValue={game.home.stats.threePointPct}
                awayColor={awayColor}
                homeColor={homeColor}
                format="percent"
              />
              <StatComparison
                label="FT%"
                awayValue={game.away.stats.freeThrowPct}
                homeValue={game.home.stats.freeThrowPct}
                awayColor={awayColor}
                homeColor={homeColor}
                format="percent"
              />
            </StatComparisonGroup>

            <StatComparisonGroup title="Rebounding">
              <StatComparison
                label="Total Rebounds"
                awayValue={game.away.stats.totalRebounds}
                homeValue={game.home.stats.totalRebounds}
                awayColor={awayColor}
                homeColor={homeColor}
              />
              <StatComparison
                label="Offensive Reb"
                awayValue={game.away.stats.offensiveRebounds}
                homeValue={game.home.stats.offensiveRebounds}
                awayColor={awayColor}
                homeColor={homeColor}
              />
              <StatComparison
                label="Defensive Reb"
                awayValue={game.away.stats.defensiveRebounds}
                homeValue={game.home.stats.defensiveRebounds}
                awayColor={awayColor}
                homeColor={homeColor}
              />
            </StatComparisonGroup>

            <StatComparisonGroup title="Playmaking">
              <StatComparison
                label="Assists"
                awayValue={game.away.stats.assists}
                homeValue={game.home.stats.assists}
                awayColor={awayColor}
                homeColor={homeColor}
              />
              <StatComparison
                label="Turnovers"
                awayValue={game.away.stats.turnovers}
                homeValue={game.home.stats.turnovers}
                awayColor={awayColor}
                homeColor={homeColor}
                higherIsBetter={false}
              />
            </StatComparisonGroup>

            <StatComparisonGroup title="Defense">
              <StatComparison
                label="Steals"
                awayValue={game.away.stats.steals}
                homeValue={game.home.stats.steals}
                awayColor={awayColor}
                homeColor={homeColor}
              />
              <StatComparison
                label="Blocks"
                awayValue={game.away.stats.blocks}
                homeValue={game.home.stats.blocks}
                awayColor={awayColor}
                homeColor={homeColor}
              />
              <StatComparison
                label="Fouls"
                awayValue={game.away.stats.fouls}
                homeValue={game.home.stats.fouls}
                awayColor={awayColor}
                homeColor={homeColor}
                higherIsBetter={false}
              />
            </StatComparisonGroup>
          </div>
        </div>
      </div>
    </div>
  );
}

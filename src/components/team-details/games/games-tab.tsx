import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Image } from "@/components/ui/image";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MarginBar } from "./margin-bar";
import { StatCard } from "../stat-card";
import { useHasTabAnimated } from "../animation-context";
import { Home, Plane, TrendingUp, Trophy, ChevronDown } from "lucide-react";
import type { ScheduleGame } from "@/lib/types/team";
import type { League } from "@/lib/shared/league";
import { leagueGameRoutes } from "@/lib/league-routes";
type Filter = "all" | "home" | "away";
type TimeFilter = "all" | "upcoming";

interface GamesTabProps {
  games: ScheduleGame[];
  teamId: string;
  league: League;
}


function formatScheduleDate(dateStr: string, isCompleted: boolean): { date: string; time?: string } {
  const date = new Date(dateStr);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatOptions = { timeZone };

  const weekday = date.toLocaleString("en-US", { ...formatOptions, weekday: "short" });
  const month = date.toLocaleString("en-US", { ...formatOptions, month: "short" });
  const day = date.toLocaleString("en-US", { ...formatOptions, day: "numeric" });

  const dateFormatted = `${weekday}, ${month} ${day}`;

  if (isCompleted) {
    return { date: dateFormatted };
  }

  const time = date.toLocaleString("en-US", {
    ...formatOptions,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const tz = date
    .toLocaleTimeString("en-us", { timeZoneName: "short" })
    .split(" ")[2];

  return { date: dateFormatted, time: `${time} ${tz}` };
}

export function GamesTab({ games, teamId, league }: GamesTabProps) {
  const [locationFilter, setLocationFilter] = useState<Filter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const nextGameRef = useRef<HTMLTableRowElement>(null);

  // Fade-up animation (only on first tab visit)
  const hasTabAnimated = useHasTabAnimated();
  const animate = useRef(!hasTabAnimated).current;
  const [contentVisible, setContentVisible] = useState(!animate);
  const [visibleRows, setVisibleRows] = useState(!animate ? Infinity : 0);

  // Compute records with safe defaults
  const records = useMemo(() => {
    const completed = games.filter((g) => g.result && g.state === "post");

    const overall = {
      wins: completed.filter((g) => g.result?.isWin === true).length,
      losses: completed.filter((g) => g.result?.isWin === false).length,
    };

    const home = {
      wins: completed.filter((g) => g.isHome && g.result?.isWin === true).length,
      losses: completed.filter((g) => g.isHome && g.result?.isWin === false).length,
    };

    const away = {
      wins: completed.filter((g) => !g.isHome && g.result?.isWin === true).length,
      losses: completed.filter((g) => !g.isHome && g.result?.isWin === false).length,
    };

    // Last 10 completed games
    const last10 = completed.slice(-10);
    const last10Record = {
      wins: last10.filter((g) => g.result?.isWin === true).length,
      losses: last10.filter((g) => g.result?.isWin === false).length,
    };

    return { overall, home, away, last10: last10Record };
  }, [games]);

  // Filter games
  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      // Location filter
      if (locationFilter === "home" && !game.isHome) return false;
      if (locationFilter === "away" && game.isHome) return false;

      // Time filter
      if (timeFilter === "upcoming" && game.state === "post") return false;

      return true;
    });
  }, [games, locationFilter, timeFilter]);

  // Sort chronologically (oldest first)
  const sortedGames = useMemo(() => {
    return [...filteredGames].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [filteredGames]);

  // Find the next game ID in the sorted list
  const nextGameId = useMemo(() => {
    const nextGame = sortedGames.find((g) => g.state !== "post");
    return nextGame?.id;
  }, [sortedGames]);

  // Animation effects (after sortedGames is available)
  useEffect(() => {
    if (!animate) return;
    const timeout = setTimeout(() => setContentVisible(true), 150);
    return () => clearTimeout(timeout);
  }, [animate]);
  useEffect(() => {
    if (!animate || !contentVisible) return;
    if (visibleRows >= sortedGames.length) return;
    const timeout = setTimeout(() => setVisibleRows((v) => v + 5), 10);
    return () => clearTimeout(timeout);
  }, [animate, contentVisible, visibleRows, sortedGames.length]);

  const scrollToNextGame = useCallback(() => {
    if (nextGameRef.current) {
      nextGameRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const formatRecord = (wins: number, losses: number): string => {
    if (isNaN(wins) || isNaN(losses)) return "0-0";
    return `${wins}-${losses}`;
  };

  const formatWinPct = (wins: number, losses: number): string | undefined => {
    const total = wins + losses;
    if (total === 0) return undefined;
    const pct = (wins / total) * 100;
    return `${pct.toFixed(0)}% win rate`;
  };

  return (
    <div className="space-y-6">
      {/* Record Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Overall"
          value={formatRecord(records.overall.wins, records.overall.losses)}
          subtitle={formatWinPct(records.overall.wins, records.overall.losses)}
          icon={Trophy}
          delay={0}
        />
        <StatCard
          label="Home"
          value={formatRecord(records.home.wins, records.home.losses)}
          subtitle={formatWinPct(records.home.wins, records.home.losses)}
          icon={Home}
          delay={50}
        />
        <StatCard
          label="Away"
          value={formatRecord(records.away.wins, records.away.losses)}
          subtitle={formatWinPct(records.away.wins, records.away.losses)}
          icon={Plane}
          delay={100}
        />
        <StatCard
          label="Last 10"
          value={formatRecord(records.last10.wins, records.last10.losses)}
          subtitle={formatWinPct(records.last10.wins, records.last10.losses)}
          icon={TrendingUp}
          delay={150}
        />
      </div>

      {/* Filters and Actions */}
      <div className={cn(
        "flex flex-wrap items-center justify-between gap-4",
        animate
          ? cn(
              "transition-[opacity,transform] duration-400 ease-out",
              contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
            )
          : "",
      )}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Location</span>
            <Tabs value={locationFilter} onValueChange={(v) => setLocationFilter(v as Filter)}>
              <TabsList responsive={false}>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="home">Home</TabsTrigger>
                <TabsTrigger value="away">Away</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Show</span>
            <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
              <TabsList responsive={false}>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {nextGameId && timeFilter === "all" && (
          <button
            onClick={scrollToNextGame}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-input bg-background rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors self-end"
          >
            <ChevronDown className="h-4 w-4" />
            Go to latest
          </button>
        )}
      </div>

      {/* Games Table */}
      <Card classNames={{
        wrapper: animate
          ? cn(
              "transition-[opacity,transform] duration-400 ease-out",
              contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
            )
          : undefined,
        inner: "flex-col p-0",
      }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Opponent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Result
                </th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-36 hidden sm:table-cell">
                  Margin
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGames.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No games match your filters
                  </td>
                </tr>
              ) : (
                sortedGames.map((game, index) => {
                  const isCompleted = game.state === "post";
                  const { date, time } = formatScheduleDate(game.date, isCompleted);
                  const isNextGame = game.id === nextGameId;

                  return (
                    <tr
                      key={game.id}
                      ref={isNextGame ? nextGameRef : null}
                      className={cn(
                        "border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors",
                        animate && cn(
                          "transition-opacity duration-150 ease-out",
                          index < visibleRows ? "opacity-100" : "opacity-0",
                        ),
                      )}
                    >
                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-muted-foreground">
                          {date}
                          {time && (
                            <div className="text-xs text-muted-foreground/70 mt-0.5">
                              {time}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Opponent */}
                      <td className="px-4 py-3">
                        <Link
                          to={leagueGameRoutes[league]}
                          params={{ gameId: game.id }}
                          className="flex items-center gap-3 hover:underline"
                        >
                          <div className="relative h-8 w-8 flex-shrink-0 rounded-md bg-muted/50 p-1">
                            <Image
                              src={game.opponent.logo}
                              alt={game.opponent.name}
                              className="h-full w-full object-contain"
                            />
                          </div>
                          <span className="font-medium">
                            <span className="text-muted-foreground text-xs mr-1.5">
                              {game.isHome ? "vs" : "@"}
                            </span>
                            {game.opponent.name}
                          </span>
                        </Link>
                      </td>

                      {/* Result */}
                      <td className="px-4 py-3 text-left">
                        {game.result ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 font-bold",
                              game.result.isWin
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            )}
                          >
                            <span className="w-4">{game.result.isWin ? "W" : "L"}</span>
                            <span className="tabular-nums text-foreground font-normal">
                              {game.result.score}-{game.result.opponentScore}
                            </span>
                          </span>
                        ) : null}
                      </td>

                      {/* Margin Bar */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {game.result && !isNaN(game.result.margin) ? (
                          <MarginBar margin={game.result.margin} maxMargin={30} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

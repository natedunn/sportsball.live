import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// === Convex-First Architecture: Game Discovery ===

// Discover today's NBA games at 3 PM UTC (10 AM EST / 7 AM PST)
// Creates game events and schedules per-game status checks
crons.daily(
	"discover-nba-games",
	{ hourUTC: 15, minuteUTC: 0 },
	internal.nba.actions.discoverTodaysGames,
);

// Discover today's WNBA games at 3:05 PM UTC
crons.daily(
	"discover-wnba-games",
	{ hourUTC: 15, minuteUTC: 5 },
	internal.wnba.actions.discoverTodaysGames,
);

// Discover today's G-League games at 3:10 PM UTC
crons.daily(
	"discover-gleague-games",
	{ hourUTC: 15, minuteUTC: 10 },
	internal.gleague.actions.discoverTodaysGames,
);

// Reconcile season player stats from ESPN Core to keep non-live stats accurate.
crons.daily(
	"reconcile-nba-player-stats",
	{ hourUTC: 18, minuteUTC: 0 },
	internal.nba.actions.backfillPlayerStatsFromCoreInternal,
	{},
);

crons.daily(
	"reconcile-wnba-player-stats",
	{ hourUTC: 18, minuteUTC: 20 },
	internal.wnba.actions.backfillPlayerStatsFromCoreInternal,
	{},
);

crons.daily(
	"reconcile-gleague-player-stats",
	{ hourUTC: 18, minuteUTC: 40 },
	internal.gleague.actions.backfillPlayerStatsFromCoreInternal,
	{},
);

export default crons;

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

// Refresh every team's record from ESPN standings after the night's games
// (9 AM UTC = 5 AM EDT). Standings also refresh after each game goes final;
// this is the backstop for games that finished without a status check.
crons.daily(
	"refresh-nba-standings",
	{ hourUTC: 9, minuteUTC: 0 },
	internal.nba.actions.refreshStandings,
	{},
);

crons.daily(
	"refresh-wnba-standings",
	{ hourUTC: 9, minuteUTC: 5 },
	internal.wnba.actions.refreshStandings,
	{},
);

crons.daily(
	"refresh-gleague-standings",
	{ hourUTC: 9, minuteUTC: 10 },
	internal.gleague.actions.refreshStandings,
	{},
);

// Refresh season phases (preseason, regular season, playoffs...) from ESPN
// before the schedule syncs below read the season's dates.
crons.daily(
	"sync-season-phases",
	{ hourUTC: 9, minuteUTC: 15 },
	internal.seasonSync.syncAll,
	{},
);

// Store the schedule from yesterday through the season's end (9:30 AM UTC,
// after the standings refresh). Discovery only adds today's games, so without
// this the scoreboard has nothing for upcoming dates. Re-syncing yesterday
// also stores each finished game's settled as-of-game records.
crons.daily(
	"sync-nba-schedule",
	{ hourUTC: 9, minuteUTC: 30 },
	internal.nba.actions.syncSchedule,
	{},
);

crons.daily(
	"sync-wnba-schedule",
	{ hourUTC: 9, minuteUTC: 35 },
	internal.wnba.actions.syncSchedule,
	{},
);

crons.daily(
	"sync-gleague-schedule",
	{ hourUTC: 9, minuteUTC: 40 },
	internal.gleague.actions.syncSchedule,
	{},
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

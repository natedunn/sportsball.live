import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Update team stats every night at 4 AM UTC (11 PM EST / 8 PM PST)
// This runs after most games have completed
crons.daily(
	"update-team-stats",
	{ hourUTC: 4, minuteUTC: 0 },
	internal.teamStats.updateAllLeagues,
);

// === Smart Player Stats Polling System ===

// Populate today's games at 6 PM UTC (1 PM EST / 10 AM PST)
// Before most games start, adds games to the queue for tracking
crons.daily(
	"populate-game-queue",
	{ hourUTC: 18, minuteUTC: 0 },
	internal.gameQueue.populateTodaysGames,
);

// Poll for finished games every 15 minutes
// Checks games ~2h15m after their scheduled start, updates player stats when complete
crons.interval(
	"process-game-queue",
	{ minutes: 15 },
	internal.gameQueue.processReadyGames,
);

// Backup: Update all player stats at 6 AM UTC (1 AM EST / 10 PM PST)
// Catches any games missed by the polling system
// Changed from 5 AM to 6 AM to avoid overlap with team stats
crons.daily(
	"update-player-stats-backup",
	{ hourUTC: 6, minuteUTC: 0 },
	internal.playerStats.updateAllLeaguesPlayerStats,
);

// Clean up old games from the queue weekly (Sunday at 7 AM UTC)
crons.weekly(
	"cleanup-game-queue",
	{ dayOfWeek: "sunday", hourUTC: 7, minuteUTC: 0 },
	internal.gameQueue.cleanupOldGames,
);

// === Weekly Stats History Snapshots ===

// Capture weekly snapshots every Sunday at 7:30 AM UTC (2:30 AM EST)
// After Saturday night games complete and stats are updated
// Runs 30 min after cleanup to avoid conflicts
crons.weekly(
	"capture-weekly-snapshots",
	{ dayOfWeek: "sunday", hourUTC: 7, minuteUTC: 30 },
	internal.statsHistory.captureWeeklySnapshots,
);

export default crons;

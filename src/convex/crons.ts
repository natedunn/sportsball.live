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

export default crons;

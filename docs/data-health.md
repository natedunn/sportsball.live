# Data health

Stats come from ESPN and are kept current by daily Convex jobs (`src/convex/crons.ts`). A daily health check makes sure that's still true, fixes what it can, and opens a GitHub issue when it can't.

## How it works

1. **Daily jobs record a heartbeat.** Game discovery, standings, the schedule sync, the player refresh (rosters, then stats) and the season sync each call `health.recordJobRun` when they finish (table `jobRuns`).
2. **The health check runs at 19:30 UTC** (`health:runHealthCheck`, after every daily job).
   - For each league whose current season is running, it checks:
     - **games:** every game ESPN has as final is stored as final with box scores, and no game ESPN lists as unfinished (postponed, say) is stored as final. Repair: sync the game.
     - **box scores:** the last 3 days' team box scores match ESPN's, which ESPN revises after the final. Repair: re-sync the game, which recalculates both teams.
     - **team averages:** recalculating every team changes nothing. A change means a recalculation was missed, and the recalculation is the repair. This is also the daily backstop for any missed trigger.
     - **standings:** W-L records match ESPN's. Repair: refresh standings.
   - For every league:
     - **rosters:** team rosters match ESPN's, for the season the roster sync targets. Repair: run the roster sync.
   - Then:
     - **jobs:** every daily job succeeded at least once in the last 2 days, so one bad night (an ESPN outage, say) doesn't alert. This can't be repaired automatically.

   Each check ends `ok`, `repaired` (it found a problem and fixed it), `failing` (still wrong after repairing) or `skipped`. Results are saved to `healthChecks` (the last 60 runs) and shown on the admin page, where **Run Now** queues a check.
3. **The "Data health" GitHub Action runs at 20:00 UTC** (`.github/workflows/data-health.yml`, `scripts/data-health-issue.mjs`). It reads `health:getLatest` from production and keeps one issue, labelled `data-health` and assigned to the repo owner:
   - It opens the issue when the same check fails two runs in a row, the health check hasn't run in 26 hours, or Convex can't be reached after retries. A check failing once (ESPN briefly down, say) is left to fix itself.
   - It updates the issue (body plus a comment) while the problems change.
   - It closes the issue once everything passes.

   Because it runs outside Convex, it still alerts when Convex's scheduled jobs stop. It also re-enables its own workflow each run, so GitHub's 60-day inactivity rule doesn't switch the schedule off in a quiet repo.

## When the issue opens

- **jobs:** check the job's logs in the Convex dashboard. A job that throws never records a heartbeat.
- **games / box scores / standings / rosters still failing after repair:** usually ESPN is down or changed its data. Compare ESPN's endpoint (in the check's code in `src/convex/health.ts`) with what we parse.
- After a fix, run the check again, and the issue closes at the next 20:00 UTC run, or run the workflow by hand:
  ```
  npx convex run --deployment harmless-coyote-806 health:runHealthCheck
  gh workflow run data-health.yml
  ```

Expected noise: ESPN occasionally disagrees with itself. For example, its season totals don't add up to its own box scores. The checks compare against ESPN's box scores, schedules, standings and rosters, so that doesn't cause alerts.

Known limits of these checks, and stats issues they can't catch, are in [known-gaps.md](known-gaps.md).

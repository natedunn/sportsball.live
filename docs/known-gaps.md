# Known gaps

Stats issues that are known and not yet addressed, found during the October 2026 accuracy audit against ESPN (PRs #25–#30). Each entry says what's wrong, why it matters, where the code is, and a suggested fix. Remove an entry when it's fixed.

How the data pipeline and its daily checks work: [data-health.md](data-health.md).

## Product decisions pending

### G League season averages are empty until mid-December
Season averages count regular-season games only (`countsTowardSeasonAverages` in `src/convex/shared/seasonHelpers.ts`): ESPN season type 2, excluding Cup championships and All-Star games. The G League opens with the Tip-Off Tournament (2026-27: Nov 6 to ~Dec 22), which ESPN files as season type 5. Until the regular season starts (~Dec 19), G League team pages show no season averages. Player averages, copied from ESPN Core's regular-season split (`types/2` in `fetchPlayerSeasonStatsFromCore`), are empty too.

This matches how the league reports stats, but it leaves G League pages blank for about six weeks. Options:
- Fall back to Tip-Off Tournament averages until the first regular-season game, labelled as such.
- Build the playoff-stats filter (below) generally enough to cover "Tip-Off Tournament" as a split.

### Playoff stats as a separate view
Season averages are regular season only, by decision (Oct 2026). Playoff, play-in and Cup-final games are still stored and appear in the Trends tab and player game logs (`countsTowardGameLog`), but nowhere shows playoff averages. The idea is a filter or tab on the team and player stats pages that switches between "Regular season" and "Playoffs".
- Team: compute a second set of averages in `recalculateTeamAverages` (per league, `src/convex/{league}/mutations.ts`) for `seasonType === 3`, or compute playoff averages on read from the team events.
- Player: ESPN Core has the postseason split at `.../types/3/athletes/{id}/statistics/0`.

## Calculation methodology

### Pace and offensive/defensive ratings are approximations
`calculatePossessions` (`src/convex/shared/statsCalculations.ts`) uses the team's own `FGA + 0.44 × FTA − OREB + TOV` with:
- **Player turnovers only.** ESPN's possession count also includes team turnovers (the `totalTurnovers` box stat, which `parseTeamBoxScore` doesn't read).
- **The team's own possessions only.** NBA.com averages both teams' possessions. Defensive rating divides opponent points by our possessions.
- **No overtime adjustment.** The Pace card says "Possessions Per 48 Minutes" (`src/components/team-details/stats/stats-tab.tsx`), but pace is per game, so overtime inflates it.

Effect: for PHX on 2026-10-30, ESPN's possession count gave ORtg 108.7 and DRtg 122.9; we showed 110.1 / 124.2. ESPN doesn't publish ratings, so the health check can't catch this. Fix: use total turnovers, average both teams' possessions, normalize pace to 48 minutes (40 for WNBA), and relabel if any of that is skipped.

### Opponent points are rebuilt from rounded ratings
`recalculateTeamAverages` doesn't have opponent scores on team events, so it reconstructs them as `defensiveRating / 100 × pace` from per-game values rounded to 0.1. That's off by about 0.1 PPG at most. Fix: store `oppScore` on team events (it's already passed to `upsertTeamEvent` and dropped).

### AST/TO with no turnovers
`computePlayerSeasonRatings` uses `assists / max(turnovers, 0.1)`, so a player with 3 assists and 0 turnovers shows 30.00. Consider showing "—" or the assist total instead.

### Stats the team page can't show
`convexTeamToStats` (`src/lib/shared/convex-adapters.ts`) hard-codes `orebPct`, `oppFgPct` and `oppThreePct` to 0 ("Not computed in Convex yet"), so those cards stay hidden. Both teams' box scores are stored, so they can be computed in `recalculateTeamAverages`.

### Ranking ties
`updateLeagueRankings` ranks by position in a sorted list, so tied teams get different ranks (for example, 3rd and 4th instead of both 3rd).

## Data timing

### Player season averages lag up to a day
Team averages update as soon as a game goes final. Player season averages are copied from ESPN Core by the daily refresh (`refreshPlayers`, 18:00 UTC NBA / 18:20 WNBA / 18:40 G League), so after a night game they change the next afternoon. Fix: refresh just the two rosters' Core stats when a game goes final (where `checkGameStatusV2` recalculates the teams).

## Health check limits

### WNBA standings check is skipped in the offseason
`checkStandings` (`src/convex/health.ts`) reads ESPN's top-level `season.year`, which rolls forward to the next season before the new standings exist (WNBA said 2027 on 2026-10-30 while its standings groups still held 2026's final records). The WNBA standings job reads the groups' season instead (`getStandingsSeason` in `src/convex/wnba/actions.ts`). Fix: use the same group-level season in the health check.

### The workflow's keep-alive relies on a community workaround
GitHub disables scheduled workflows in repos with no activity for 60 days. `.github/workflows/data-health.yml` re-enables itself each run, which is a widely used workaround (it resets the timer), not documented GitHub behavior. If it stops working, GitHub emails the owner before disabling the schedule.

### Sync paths aren't tested against a backend
Unit tests cover parsing and calculations. The sync, recalculation and roster actions have only run against production. A Convex test harness (for example `convex-test`) around `syncLiveGameData`, `runRosterSync` and `recalculateTeamAverages` would catch regressions before deploy.

## ESPN data quirks (not fixable on our side)

- **ESPN's season totals don't always add up to its own box scores.** For example, ATL, DAL and HOU team totals were off by about 1 shot or 0.2 per game on 2026-10-30, and about 16 players' season stats were off by 1 shot or a few rebounds. We match ESPN's box scores for teams and ESPN's season stats for players, so a user comparing with ESPN's team page can see a 0.1–0.3 difference.
- **Box-score minutes are whole numbers.** Season minutes per game from ESPN use exact time, so they differ slightly from sums of box scores.
- **Postponed games come through as "post" with an all-zero box score.** This is now handled (`mapApiStateToEventStatus`), and the health check flags any game final here but not on ESPN.
- **A suspended game can stay "in progress" on ESPN forever.** G League 401819319 (2026-02-24, WES at CLC) shows 4:55 left in the 1st quarter. We mirror ESPN, so it doesn't count.

## Data left as is

- **NBA 2025-26 Cup final (401809839)** was stored before `competitionType` existed, so it counts toward 2025-26 regular-season averages. Past seasons aren't shown in the app. Re-syncing that date through the schedule sync would tag it.
- **Duplicate player names.** A few players appear under two ESPN ids (for example "Taye Fields" on PHI, "Erik Reynolds II" on CPS). They were camp players now flagged off-roster, so they don't show on team pages.
- **`bootstrapPlayers` uses ESPN's common-API roster**, which has no birthdates. The daily roster sync fills them in from the site API, so a fresh bootstrap gets birthdates within a day.

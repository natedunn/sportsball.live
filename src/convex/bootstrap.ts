import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Full bootstrap: teams → discover today → players (all via scheduler, no timeout risk)
// Each step schedules the next, so no single action runs longer than a few minutes.
// Trigger from Convex dashboard: bootstrap:fullBootstrap
export const fullBootstrap = internalAction({
	args: {},
	handler: async (ctx) => {
		console.log("[Bootstrap] Starting full bootstrap...");
		console.log("[Bootstrap] Step 1/3: Bootstrapping teams for all leagues...");

		// Step 1: Bootstrap all teams (sequentially within this action - ~2 min total)
		try {
			await ctx.runAction(internal.nba.actions.bootstrapTeams, {});
			console.log("[Bootstrap] NBA teams done");
		} catch (error) {
			console.error("[Bootstrap] NBA teams failed:", error);
		}

		try {
			await ctx.runAction(internal.wnba.actions.bootstrapTeams, {});
			console.log("[Bootstrap] WNBA teams done");
		} catch (error) {
			console.error("[Bootstrap] WNBA teams failed:", error);
		}

		try {
			await ctx.runAction(internal.gleague.actions.bootstrapTeams, {});
			console.log("[Bootstrap] G-League teams done");
		} catch (error) {
			console.error("[Bootstrap] G-League teams failed:", error);
		}

		// Schedule step 2 as a separate action (avoids timeout)
		await ctx.scheduler.runAfter(1000, internal.bootstrap.step2DiscoverGames, {});

		console.log("[Bootstrap] Teams done! Scheduled game discovery in 1s.");
	},
});

// Step 2: Discover today's games for all leagues
export const step2DiscoverGames = internalAction({
	args: {},
	handler: async (ctx) => {
		console.log("[Bootstrap] Step 2/3: Discovering today's games...");

		try {
			await ctx.runAction(internal.nba.actions.discoverTodaysGames, {});
			console.log("[Bootstrap] NBA games discovered");
		} catch (error) {
			console.error("[Bootstrap] NBA discovery failed:", error);
		}

		try {
			await ctx.runAction(internal.wnba.actions.discoverTodaysGames, {});
			console.log("[Bootstrap] WNBA games discovered");
		} catch (error) {
			console.error("[Bootstrap] WNBA discovery failed:", error);
		}

		try {
			await ctx.runAction(internal.gleague.actions.discoverTodaysGames, {});
			console.log("[Bootstrap] G-League games discovered");
		} catch (error) {
			console.error("[Bootstrap] G-League discovery failed:", error);
		}

		// Schedule step 3 as a separate action
		await ctx.scheduler.runAfter(1000, internal.bootstrap.step3BootstrapPlayers, {});

		console.log("[Bootstrap] Games discovered! Scheduled player bootstrap in 1s.");
	},
});

// Step 3: Bootstrap players for all leagues (self-scheduling chunks handle the rest)
export const step3BootstrapPlayers = internalAction({
	args: {},
	handler: async (ctx) => {
		console.log("[Bootstrap] Step 3/3: Starting player bootstrap...");

		// These each just query teams and schedule the first chunk, so they're fast
		try {
			await ctx.runAction(internal.nba.actions.bootstrapPlayers, {});
			console.log("[Bootstrap] NBA player bootstrap scheduled");
		} catch (error) {
			console.error("[Bootstrap] NBA player bootstrap failed:", error);
		}

		try {
			await ctx.runAction(internal.wnba.actions.bootstrapPlayers, {});
			console.log("[Bootstrap] WNBA player bootstrap scheduled");
		} catch (error) {
			console.error("[Bootstrap] WNBA player bootstrap failed:", error);
		}

		try {
			await ctx.runAction(internal.gleague.actions.bootstrapPlayers, {});
			console.log("[Bootstrap] G-League player bootstrap scheduled");
		} catch (error) {
			console.error("[Bootstrap] G-League player bootstrap failed:", error);
		}

		console.log("[Bootstrap] Full bootstrap complete! Player chunks will continue in background.");
	},
});

// ── Test Bootstrap: Single NBA team ──────────────────────────────────────
// Use from Convex dashboard: bootstrap:testBootstrapSingleTeam
// Phoenix Suns = "21". Pass any API provider team ID.
//
// Flow:
//   1. Bootstrap ALL NBA teams (standings) — fast, 1 API call
//   2. Bootstrap players for just the target team — 1 API call
//   3. Backfill games involving the target team only — skips non-matching games
//   4. Recalculate averages + rankings
//
// Expected time: ~5-8 minutes for a full season of one team
export const testBootstrapSingleTeam = internalAction({
	args: {
		espnTeamId: v.string(), // e.g. "21" for Phoenix Suns (API provider team ID)
	},
	handler: async (ctx, args) => {
		console.log(`[Test Bootstrap] Starting single-team bootstrap for team ${args.espnTeamId}...`);

		// Step 1: Bootstrap all NBA teams (for standings, names, opponent data)
		console.log("[Test Bootstrap] Step 1/4: Bootstrapping all NBA teams from standings...");
		try {
			await ctx.runAction(internal.nba.actions.bootstrapTeams, {});
			console.log("[Test Bootstrap] NBA teams done");
		} catch (error) {
			console.error("[Test Bootstrap] NBA teams failed:", error);
			return;
		}

		// Step 2: Bootstrap players for just the target team
		console.log(`[Test Bootstrap] Step 2/4: Bootstrapping players for team ${args.espnTeamId}...`);
		try {
			await ctx.runAction(internal.nba.actions.bootstrapSingleTeamPlayers, {
				espnTeamId: args.espnTeamId,
			});
			console.log("[Test Bootstrap] Target team players done");
		} catch (error) {
			console.error("[Test Bootstrap] Player bootstrap failed:", error);
			return;
		}

		// Step 3: Schedule backfill (self-scheduling, runs as separate actions)
		console.log(`[Test Bootstrap] Step 3/4: Scheduling game backfill for team ${args.espnTeamId}...`);
		await ctx.runAction(internal.nba.actions.backfillGames, {
			targetEspnTeamId: args.espnTeamId,
		});

		// Step 4: Schedule recalculation after backfill completes
		// Backfill is self-scheduling so we can't await it. Schedule recalc with a delay.
		// For ~50 games this should be done in ~5 min. Schedule recalc at 6 min.
		console.log("[Test Bootstrap] Step 4/4: Scheduling recalculation in 6 minutes (after backfill)...");
		await ctx.scheduler.runAfter(6 * 60 * 1000, internal.nba.actions.recalculateAll, {});

		console.log("[Test Bootstrap] Single-team bootstrap initiated! Monitor logs for progress.");
		console.log("[Test Bootstrap] Backfill will process ~50 games. Recalculate scheduled in 6 min.");
		console.log("[Test Bootstrap] After completion, run bootstrap:verifyTeamData to check results.");
	},
});

// Verify data integrity for a single team after bootstrap
// Run from dashboard: bootstrap:verifyTeamData
export const verifyTeamData = internalAction({
	args: {
		espnTeamId: v.string(), // e.g. "21" for Phoenix Suns (API provider team ID)
	},
	handler: async (ctx, args) => {
		const { getCurrentSeason } = await import("./shared/seasonHelpers");
		const season = getCurrentSeason();
		const issues: string[] = [];

		console.log(`\n[Verify] ════════════════════════════════════════`);
		console.log(`[Verify] Checking team ${args.espnTeamId} for season ${season}`);
		console.log(`[Verify] ════════════════════════════════════════\n`);

		// 1. Check team record
		const team = await ctx.runQuery(internal.nba.queries.getTeamInternal, {
			espnTeamId: args.espnTeamId, season,
		});

		if (!team) {
			console.error("[Verify] FAIL: Team not found in database!");
			return;
		}

		console.log(`[Verify] Team: ${team.name} (${team.abbreviation})`);
		console.log(`[Verify] Record: ${team.wins}-${team.losses}`);
		console.log(`[Verify] Conference: ${team.conference ?? "N/A"} (Rank: ${team.conferenceRank ?? "N/A"})`);

		if (!team.name || team.name === "Unknown") issues.push("Team name is missing or Unknown");
		if (!team.abbreviation || team.abbreviation === "???") issues.push("Team abbreviation is missing");
		if (team.wins === 0 && team.losses === 0) issues.push("Team has 0-0 record (standings may not have loaded)");

		// 2. Check players
		const players = await ctx.runQuery(api.nba.queries.getTeamRoster, { teamId: team._id });
		console.log(`[Verify] Players on roster: ${players.length}`);

		if (players.length === 0) {
			issues.push("No players found on roster");
		} else {
			const withAvg = players.filter((p) => (p.gamesPlayed ?? 0) > 0);
			const withHeadshot = players.filter((p) => p.headshot);
			console.log(`[Verify] Players with game data: ${withAvg.length}`);
			console.log(`[Verify] Players with headshots: ${withHeadshot.length}`);

			// Show top scorer
			const topScorer = players
				.filter((p) => (p.pointsPerGame ?? 0) > 0)
				.sort((a, b) => (b.pointsPerGame ?? 0) - (a.pointsPerGame ?? 0))[0];
			if (topScorer) {
				console.log(`[Verify] Top scorer: ${topScorer.name} — ${topScorer.pointsPerGame?.toFixed(1)} PPG, ${topScorer.reboundsPerGame?.toFixed(1)} RPG, ${topScorer.assistsPerGame?.toFixed(1)} APG`);
			}

			if (withAvg.length === 0) issues.push("No players have computed averages (recalculate may not have run)");
		}

		// 3. Check game events
		const schedule = await ctx.runQuery(api.nba.queries.getTeamSchedule, { teamId: team._id });
		const completed = schedule.filter((g) => g.eventStatus === "completed");
		const withScores = schedule.filter((g) => (g.homeScore ?? 0) > 0 || (g.awayScore ?? 0) > 0);

		console.log(`[Verify] Total games on schedule: ${schedule.length}`);
		console.log(`[Verify] Completed games: ${completed.length}`);
		console.log(`[Verify] Games with scores: ${withScores.length}`);

		if (schedule.length === 0) issues.push("No games found on schedule");
		if (completed.length > 0 && withScores.length === 0) issues.push("Completed games have no scores");

		// 4. Check team averages
		console.log(`\n[Verify] ── Team Averages ──`);
		console.log(`[Verify] PPG: ${team.pointsFor?.toFixed(1) ?? "N/A"} | Opp PPG: ${team.pointsAgainst?.toFixed(1) ?? "N/A"}`);
		console.log(`[Verify] FG%: ${team.fgPct?.toFixed(1) ?? "N/A"} | 3P%: ${team.threePct?.toFixed(1) ?? "N/A"} | FT%: ${team.ftPct?.toFixed(1) ?? "N/A"}`);
		console.log(`[Verify] RPG: ${team.rpg?.toFixed(1) ?? "N/A"} | APG: ${team.apg?.toFixed(1) ?? "N/A"} | TOV: ${team.tovPg?.toFixed(1) ?? "N/A"}`);
		console.log(`[Verify] Pace: ${team.pace?.toFixed(1) ?? "N/A"} | ORtg: ${team.offensiveRating?.toFixed(1) ?? "N/A"} | DRtg: ${team.defensiveRating?.toFixed(1) ?? "N/A"} | NetRtg: ${team.netRating?.toFixed(1) ?? "N/A"}`);
		console.log(`[Verify] eFG%: ${team.efgPct?.toFixed(1) ?? "N/A"} | TS%: ${team.tsPct?.toFixed(1) ?? "N/A"}`);

		if (completed.length > 0 && !team.fgPct) issues.push("Team has completed games but no FG% average");
		if (completed.length > 0 && !team.pace) issues.push("Team has completed games but no pace average");

		// 5. Spot-check a recent game's box score
		const recentCompleted = completed[completed.length - 1];
		if (recentCompleted) {
			console.log(`\n[Verify] ── Sample Game Box Score ──`);
			console.log(`[Verify] Game: ${recentCompleted.isHome ? "vs" : "@"} ${recentCompleted.opponent?.name ?? "?"} (${recentCompleted.gameDate})`);
			console.log(`[Verify] Score: ${recentCompleted.homeScore ?? "?"}-${recentCompleted.awayScore ?? "?"}`);

			const gameDetails = await ctx.runQuery(api.nba.queries.getGameDetails, {
				espnGameId: recentCompleted.espnGameId,
			});

			if (gameDetails) {
				const teamEvent = recentCompleted.isHome ? gameDetails.homeTeamEvent : gameDetails.awayTeamEvent;
				if (teamEvent) {
					console.log(`[Verify] Team box: ${teamEvent.fieldGoalsMade}/${teamEvent.fieldGoalsAttempted} FG, ${teamEvent.threePointMade}/${teamEvent.threePointAttempted} 3P, ${teamEvent.totalRebounds} REB, ${teamEvent.assists} AST`);
				} else {
					issues.push("Recent game missing team event (box score)");
				}

				const playerEvents = recentCompleted.isHome ? gameDetails.homePlayerEvents : gameDetails.awayPlayerEvents;
				const activePlayers = playerEvents.filter((p) => p.active);
				console.log(`[Verify] Player events: ${playerEvents.length} total, ${activePlayers.length} active`);

				if (playerEvents.length === 0) issues.push("Recent game has no player events");
			} else {
				issues.push("Could not load game details for most recent game");
			}
		}

		// Summary
		console.log(`\n[Verify] ════════════════════════════════════════`);
		if (issues.length === 0) {
			console.log("[Verify] ✓ ALL CHECKS PASSED");
		} else {
			console.log(`[Verify] ✗ ${issues.length} ISSUE(S) FOUND:`);
			for (const issue of issues) {
				console.log(`[Verify]   - ${issue}`);
			}
		}
		console.log(`[Verify] ════════════════════════════════════════\n`);
	},
});

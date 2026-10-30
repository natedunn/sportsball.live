// One-off roster repair for a season that ended before the daily roster sync
// existed. Its team pages kept every player who passed through a team (call-ups,
// releases, camp invites) and missed some who finished the season there.
//
// This rebuilds each team's roster from ESPN Core's end-of-season roster:
// players on it are moved to that team and marked on the roster (players we
// don't have yet are added with their Core bio), and everyone else on the team
// is flagged off-roster. Flagged players keep their stats and box scores.
//
// Run order (dry run first):
//   npx convex run gleague/migrations:syncFinishedSeasonRosters '{"season":"2025-26","dryRun":true}'
//   npx convex run gleague/migrations:syncFinishedSeasonRosters '{"season":"2025-26"}'
// Totals are logged as "[GLEAGUE Migration]".

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { parseRosterPlayer, type ApiRosterAthlete } from "../shared/apiParser";
import { getSeasonEndYear, sleep } from "../shared/seasonHelpers";

const FETCH_DELAY_MS = 150;

function getCoreApi(): string {
	const url = process.env.GLEAGUE_CORE_API;
	if (!url) throw new Error("GLEAGUE_CORE_API not configured");
	return url;
}

async function fetchJson<T>(url: string): Promise<T | null> {
	const response = await fetch(url, { headers: { "Content-Type": "application/json" } });
	if (!response.ok) {
		console.error(`[GLEAGUE Migration] Fetch failed (${response.status}): ${url}`);
		return null;
	}
	return (await response.json()) as T;
}

export const syncFinishedSeasonRosters = internalAction({
	args: { season: v.string(), dryRun: v.optional(v.boolean()) },
	handler: async (ctx, args) => {
		const coreBase = getCoreApi();
		const espnYear = getSeasonEndYear(args.season);
		const teams: Doc<"gleagueTeam">[] = await ctx.runQuery(
			internal.gleague.queries.getAllTeamsInternal,
			{ season: args.season },
		);
		const players: Doc<"gleaguePlayer">[] = await ctx.runQuery(
			internal.gleague.queries.getAllPlayersInternal,
			{ season: args.season },
		);
		const byEspnId = new Map(players.map((player) => [player.espnPlayerId, player]));

		const totals = { teams: 0, skippedTeams: 0, kept: 0, moved: 0, added: 0, flagged: 0, failed: 0 };
		// Dry run: teams synced and every player on an ESPN roster, to count who'd be flagged
		const syncedTeamIds = new Set<string>();
		const onAnyRoster = new Set<string>();

		for (const team of teams) {
			if (!/^\d+$/.test(team.espnTeamId)) continue;
			const roster = await fetchJson<{ items?: Array<{ $ref: string }> }>(
				`${coreBase}/seasons/${espnYear}/teams/${team.espnTeamId}/athletes?limit=200&lang=en&region=us`,
			);
			const rosterIds = (roster?.items ?? [])
				.map((item) => item.$ref.match(/athletes\/(\d+)/)?.[1])
				.filter((id): id is string => id !== undefined);
			// Never empty a team from a failed or empty response
			if (rosterIds.length === 0) {
				totals.skippedTeams += 1;
				continue;
			}

			for (const espnPlayerId of rosterIds) {
				const existing = byEspnId.get(espnPlayerId);
				if (existing) {
					if (existing.teamId === team._id) totals.kept += 1;
					else totals.moved += 1;
					if (!args.dryRun && (existing.teamId !== team._id || existing.onRoster !== true)) {
						await ctx.runMutation(internal.gleague.mutations.upsertPlayer, {
							espnPlayerId,
							season: args.season,
							teamId: team._id,
							name: existing.name,
							onRoster: true,
						});
					}
					continue;
				}

				totals.added += 1;
				if (args.dryRun) continue;
				await sleep(FETCH_DELAY_MS);
				const athlete = await fetchJson<ApiRosterAthlete>(
					`${coreBase}/athletes/${espnPlayerId}?lang=en&region=us`,
				);
				if (!athlete) {
					totals.failed += 1;
					continue;
				}
				await ctx.runMutation(internal.gleague.mutations.upsertPlayer, {
					...parseRosterPlayer(athlete),
					season: args.season,
					teamId: team._id,
					onRoster: true,
				});
			}

			if (args.dryRun) {
				syncedTeamIds.add(team._id);
				for (const id of rosterIds) onAnyRoster.add(id);
			} else {
				totals.flagged += await ctx.runMutation(internal.gleague.mutations.markOffRoster, {
					teamId: team._id,
					rosterEspnPlayerIds: rosterIds,
				});
			}
			totals.teams += 1;
			await sleep(FETCH_DELAY_MS);
		}

		if (args.dryRun) {
			// Players on another team's roster get moved there, not flagged
			totals.flagged = players.filter(
				(player) =>
					syncedTeamIds.has(player.teamId) &&
					!onAnyRoster.has(player.espnPlayerId) &&
					player.onRoster !== false,
			).length;
		}

		console.log(
			`[GLEAGUE Migration] ${args.season}${args.dryRun ? " (dry run)" : ""}: ${JSON.stringify(totals)}`,
		);
		return { season: args.season, dryRun: !!args.dryRun, ...totals };
	},
});

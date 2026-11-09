// What's kept of why players sat once the day has passed. ESPN keeps no injury
// history: its report only knows today, and the `injuries` list on a past
// game's summary is today's too. So two records build up here:
//   gameAbsences: the reason on each did-not-play line, per game
//   injuryLog: every version of every entry on the league's report
// shared/playerAvailability.ts turns them into a player's season.
// The log runs all year for every league and is meant to outlive that page.
import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { leagueValidator } from "./validators";
import type { ParsedInjury } from "./shared/injuries";

type League = "nba" | "wnba" | "gleague";

/** Any change to these makes a new version of a player's entry */
function logKey(entry: {
	espnPlayerId?: string;
	espnTeamId: string;
	status: string;
	description?: string;
	shortComment?: string;
	returnDate?: string;
}) {
	return JSON.stringify([
		entry.espnPlayerId,
		entry.espnTeamId,
		entry.status,
		entry.description,
		entry.shortComment,
		entry.returnDate,
	]);
}

/** Bring the log up to date with the league's latest report */
export async function updateInjuryLog(ctx: MutationCtx, league: League, injuries: ParsedInjury[]) {
	const open = await ctx.db
		.query("injuryLog")
		.withIndex("by_league_clearedAt", (q) => q.eq("league", league).eq("clearedAt", undefined))
		.collect();
	const openByKey = new Map(open.map((row) => [logKey(row), row]));
	const now = Date.now();
	const seen = new Set<string>();

	for (const injury of injuries) {
		// Without a player id it can't be tied to anyone's page
		if (!injury.espnPlayerId) continue;
		const key = logKey(injury);
		if (seen.has(key)) continue;
		seen.add(key);
		if (openByKey.has(key)) continue;
		await ctx.db.insert("injuryLog", {
			league,
			espnPlayerId: injury.espnPlayerId,
			espnTeamId: injury.espnTeamId,
			name: injury.name,
			status: injury.status,
			description: injury.description,
			shortComment: injury.shortComment,
			returnDate: injury.returnDate,
			reportedAt: injury.reportedAt,
			firstSeenAt: now,
		});
	}

	for (const [key, row] of openByKey) {
		if (!seen.has(key)) await ctx.db.patch(row._id, { clearedAt: now });
	}
}

// Replaces the game's rows, so a corrected box score corrects them
export const recordGameAbsences = internalMutation({
	args: {
		league: leagueValidator,
		season: v.string(),
		espnGameId: v.string(),
		gameDate: v.string(),
		phase: v.union(v.literal("regular"), v.literal("playoffs"), v.literal("tournament")),
		absences: v.array(
			v.object({ espnPlayerId: v.string(), espnTeamId: v.string(), reason: v.string() }),
		),
	},
	handler: async (ctx, { absences, ...game }) => {
		const existing = await ctx.db
			.query("gameAbsences")
			.withIndex("by_league_game", (q) => q.eq("league", game.league).eq("espnGameId", game.espnGameId))
			.collect();
		const incoming = new Map(absences.map((absence) => [absence.espnPlayerId, absence]));
		const existingIds = new Set(existing.map((row) => row.espnPlayerId));

		for (const row of existing) {
			const absence = incoming.get(row.espnPlayerId);
			if (!absence) await ctx.db.delete(row._id);
			else if (absence.reason !== row.reason) await ctx.db.patch(row._id, { reason: absence.reason });
		}
		for (const absence of absences) {
			if (!existingIds.has(absence.espnPlayerId)) await ctx.db.insert("gameAbsences", { ...game, ...absence });
		}
	},
});

import { v } from "convex/values";

export const leagueValidator = v.union(
	v.literal("nba"),
	v.literal("wnba"),
	v.literal("gleague"),
);

/** A player's draft (see parseCoreDraft) */
export const draftValidator = v.object({
	year: v.number(),
	round: v.number(),
	pick: v.number(),
	teamEspnId: v.optional(v.string()),
});

/**
 * One health check result: "repaired" means the check found a problem and
 * fixed it; "failing" means it couldn't, and needs a person.
 */
export const healthResultValidator = v.object({
	league: v.optional(leagueValidator),
	check: v.string(),
	status: v.union(
		v.literal("ok"),
		v.literal("repaired"),
		v.literal("failing"),
		v.literal("skipped"),
	),
	message: v.string(),
	details: v.optional(v.array(v.string())),
});

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

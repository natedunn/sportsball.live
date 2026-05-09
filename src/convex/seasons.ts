import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { leagueValidator } from "./validators";
import type { Doc } from "./_generated/dataModel";

type League = "nba" | "wnba" | "gleague";
type SeasonType = "tournament" | "pre-season" | "regular-season" | "playoffs";
type SeasonStatus = "confirmed" | "estimated";

type SeasonInput = {
	league: League;
	startYear: number;
	endYear: number;
	name: string;
	type: SeasonType;
	startDate: string;
	endDate: string;
	status: SeasonStatus;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const seasonTypeValidator = v.union(
	v.literal("tournament"),
	v.literal("pre-season"),
	v.literal("regular-season"),
	v.literal("playoffs"),
);

const seasonStatusValidator = v.union(
	v.literal("confirmed"),
	v.literal("estimated"),
);

const seasonArgs = {
	league: leagueValidator,
	startYear: v.number(),
	endYear: v.number(),
	name: v.string(),
	type: seasonTypeValidator,
	startDate: v.string(),
	endDate: v.string(),
	status: seasonStatusValidator,
};

const typeOrder: SeasonType[] = [
	"tournament",
	"pre-season",
	"regular-season",
	"playoffs",
];

const seedSeasons: SeasonInput[] = [
	{
		league: "nba",
		startYear: 2025,
		endYear: 2026,
		name: "Preseason",
		type: "pre-season",
		startDate: "2025-10-02",
		endDate: "2025-10-17",
		status: "confirmed",
	},
	{
		league: "nba",
		startYear: 2025,
		endYear: 2026,
		name: "Regular season",
		type: "regular-season",
		startDate: "2025-10-21",
		endDate: "2026-04-12",
		status: "confirmed",
	},
	{
		league: "nba",
		startYear: 2025,
		endYear: 2026,
		name: "Playoffs",
		type: "playoffs",
		startDate: "2026-04-14",
		endDate: "2026-06-19",
		status: "estimated",
	},
	{
		league: "wnba",
		startYear: 2025,
		endYear: 2025,
		name: "Preseason",
		type: "pre-season",
		startDate: "2025-05-02",
		endDate: "2025-05-12",
		status: "confirmed",
	},
	{
		league: "wnba",
		startYear: 2025,
		endYear: 2025,
		name: "Regular season",
		type: "regular-season",
		startDate: "2025-05-16",
		endDate: "2025-09-11",
		status: "confirmed",
	},
	{
		league: "wnba",
		startYear: 2025,
		endYear: 2025,
		name: "Playoffs",
		type: "playoffs",
		startDate: "2025-09-14",
		endDate: "2025-10-10",
		status: "confirmed",
	},
	{
		league: "wnba",
		startYear: 2026,
		endYear: 2026,
		name: "Preseason",
		type: "pre-season",
		startDate: "2026-04-25",
		endDate: "2026-05-03",
		status: "confirmed",
	},
	{
		league: "wnba",
		startYear: 2026,
		endYear: 2026,
		name: "Regular season",
		type: "regular-season",
		startDate: "2026-05-08",
		endDate: "2026-09-24",
		status: "confirmed",
	},
	{
		league: "wnba",
		startYear: 2026,
		endYear: 2026,
		name: "Playoffs",
		type: "playoffs",
		startDate: "2026-09-27",
		endDate: "2026-10-25",
		status: "estimated",
	},
	{
		league: "gleague",
		startYear: 2025,
		endYear: 2026,
		name: "Tip-Off Tournament",
		type: "tournament",
		startDate: "2025-11-07",
		endDate: "2025-12-22",
		status: "confirmed",
	},
	{
		league: "gleague",
		startYear: 2025,
		endYear: 2026,
		name: "Regular season",
		type: "regular-season",
		startDate: "2025-12-27",
		endDate: "2026-03-28",
		status: "confirmed",
	},
	{
		league: "gleague",
		startYear: 2025,
		endYear: 2026,
		name: "Playoffs",
		type: "playoffs",
		startDate: "2026-03-31",
		endDate: "2026-04-13",
		status: "confirmed",
	},
];

function validateIsoDate(value: string, label: string) {
	if (!datePattern.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
		throw new Error(`${label} must be a valid YYYY-MM-DD date`);
	}
}

function validateSeason(season: SeasonInput) {
	if (!Number.isInteger(season.startYear) || !Number.isInteger(season.endYear)) throw new Error("Start and end years are required");
	if (season.endYear < season.startYear) throw new Error("End year must be on or after start year");
	if (!season.name.trim()) throw new Error("Season name is required");
	validateIsoDate(season.startDate, "Start date");
	validateIsoDate(season.endDate, "End date");
	if (season.endDate < season.startDate) {
		throw new Error("End date must be on or after start date");
	}
}

async function assertAdmin(ctx: MutationCtx) {
	const user = await authComponent.safeGetAuthUser(ctx);
	if (!user?.email) throw new Error("Not authenticated");

	const superAdminEmail = process.env.SUPER_ADMIN;
	if (!superAdminEmail || user.email.toLowerCase() !== superAdminEmail.toLowerCase()) {
		throw new Error("Not authorized");
	}
}

function sortSeasons(a: Doc<"seasons">, b: Doc<"seasons">) {
	if (a.league !== b.league) return a.league.localeCompare(b.league);
	if (a.startYear !== b.startYear) return b.startYear - a.startYear;
	if (a.endYear !== b.endYear) return b.endYear - a.endYear;
	if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
	return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
}

function getCurrentSegment(rows: Doc<"seasons">[]) {
	const today = new Date().toISOString().split("T")[0];
	const sorted = [...rows].sort((a, b) => a.startDate.localeCompare(b.startDate));

	const active = sorted.find((season) => today >= season.startDate && today <= season.endDate);
	if (active) return active;

	const mostRecentPast = [...sorted]
		.reverse()
		.find((season) => today >= season.startDate);
	if (mostRecentPast) return mostRecentPast;

	return sorted[0] ?? null;
}

function getCurrentSeasonKey(rows: Doc<"seasons">[]) {
	const current = getCurrentSegment(rows);
	return current ? formatSeasonKey(current.startYear, current.endYear) : null;
}

function matchesSeasonKey(season: Doc<"seasons">, seasonKey: string) {
	return formatSeasonKey(season.startYear, season.endYear) === seasonKey;
}

function getCurrentRegularSeason(rows: Doc<"seasons">[]) {
	const seasonKey = getCurrentSeasonKey(rows);
	if (!seasonKey) return null;
	return (
		rows.find(
			(season) =>
				matchesSeasonKey(season, seasonKey) && season.type === "regular-season",
		) ?? null
	);
}

function getCurrentTypeSegment(rows: Doc<"seasons">[], type: SeasonType) {
	const seasonKey = getCurrentSeasonKey(rows);
	if (!seasonKey) return null;
	return (
		rows.find((season) => matchesSeasonKey(season, seasonKey) && season.type === type) ??
		null
	);
}

export const list = query({
	args: { league: v.optional(leagueValidator) },
	handler: async (ctx, args) => {
		let rows: Array<Doc<"seasons">>;
		if (args.league) {
			const league = args.league;
			rows = await ctx.db
				.query("seasons")
				.withIndex("by_league", (q) => q.eq("league", league))
				.collect();
		} else {
			rows = await ctx.db.query("seasons").collect();
		}
		return rows.sort(sortSeasons);
	},
});

export const getCurrent = query({
	args: { league: leagueValidator },
	handler: async (ctx, args) => {
		const rows = await ctx.db
			.query("seasons")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.collect();
		return getCurrentSegment(rows);
	},
});

export const getCurrentName = query({
	args: { league: leagueValidator },
	handler: async (ctx, args) => {
		const rows = await ctx.db
			.query("seasons")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.collect();
		const regularSeason = getCurrentRegularSeason(rows);
		if (regularSeason) return formatSeasonKey(regularSeason.startYear, regularSeason.endYear);
		return getCurrentSeasonKey(rows);
	},
});

export const getCurrentEventDate = query({
	args: {
		league: leagueValidator,
		eventType: v.union(
			v.literal("preseasonStart"),
			v.literal("preseasonEnd"),
			v.literal("regularSeasonStart"),
			v.literal("regularSeasonEnd"),
			v.literal("playoffStart"),
			v.literal("playoffEnd"),
			v.literal("offseasonStart"),
		),
	},
	handler: async (ctx, args) => {
		const rows = await ctx.db
			.query("seasons")
			.withIndex("by_league", (q) => q.eq("league", args.league))
			.collect();

		if (args.eventType === "offseasonStart") {
			const playoffs = getCurrentTypeSegment(rows, "playoffs");
			return playoffs ? nextDate(playoffs.endDate) : null;
		}

		const type =
			args.eventType === "preseasonStart" || args.eventType === "preseasonEnd"
				? "pre-season"
				: args.eventType === "regularSeasonStart" ||
						args.eventType === "regularSeasonEnd"
					? "regular-season"
					: "playoffs";
		const segment = getCurrentTypeSegment(rows, type);
		if (!segment) return null;
		return args.eventType.endsWith("Start") ? segment.startDate : segment.endDate;
	},
});

export const upsert = mutation({
	args: seasonArgs,
	handler: async (ctx, args) => {
		await assertAdmin(ctx);
		validateSeason(args);

		const now = Date.now();
		const existing = await ctx.db
			.query("seasons")
			.withIndex("by_league_years_type", (q) =>
				q.eq("league", args.league).eq("startYear", args.startYear).eq("endYear", args.endYear).eq("type", args.type),
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, { ...args, updatedAt: now });
			return existing._id;
		}

		return await ctx.db.insert("seasons", { ...args, updatedAt: now });
	},
});

export const resetAndSeedLocalDefaults = mutation({
	args: {},
	handler: async (ctx) => {
		const existingSeasons = await ctx.db.query("seasons").collect();
		for (const season of existingSeasons) {
			await ctx.db.delete(season._id);
		}

		const now = Date.now();
		for (const seed of seedSeasons) {
			validateSeason(seed);
			await ctx.db.insert("seasons", { ...seed, updatedAt: now });
		}

		return { insertedSeasons: seedSeasons.length };
	},
});

function nextDate(date: string) {
	const parsed = new Date(`${date}T00:00:00Z`);
	parsed.setUTCDate(parsed.getUTCDate() + 1);
	return parsed.toISOString().split("T")[0];
}

function formatSeasonKey(startYear: number, endYear: number) {
	if (startYear === endYear) return String(startYear);
	return `${startYear}-${String(endYear).slice(-2)}`;
}

import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { compareSeasons, getSeasonEndYear, getSeasonStartYear, getTodayDate } from "./shared/seasonHelpers";
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
	// 2026-27 dates are estimates until the league publishes its schedule
	{
		league: "nba",
		startYear: 2026,
		endYear: 2027,
		name: "Preseason",
		type: "pre-season",
		startDate: "2026-10-02",
		endDate: "2026-10-16",
		status: "estimated",
	},
	{
		league: "nba",
		startYear: 2026,
		endYear: 2027,
		name: "Regular season",
		type: "regular-season",
		startDate: "2026-10-20",
		endDate: "2027-04-11",
		status: "estimated",
	},
	{
		league: "nba",
		startYear: 2026,
		endYear: 2027,
		name: "Playoffs",
		type: "playoffs",
		startDate: "2027-04-13",
		endDate: "2027-06-25",
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
	// 2026-27 dates are estimates until the league publishes its schedule
	{
		league: "gleague",
		startYear: 2026,
		endYear: 2027,
		name: "Tip-Off Tournament",
		type: "tournament",
		startDate: "2026-11-07",
		endDate: "2026-12-22",
		status: "estimated",
	},
	{
		league: "gleague",
		startYear: 2026,
		endYear: 2027,
		name: "Regular season",
		type: "regular-season",
		startDate: "2026-12-26",
		endDate: "2027-03-27",
		status: "estimated",
	},
	{
		league: "gleague",
		startYear: 2026,
		endYear: 2027,
		name: "Playoffs",
		type: "playoffs",
		startDate: "2027-03-30",
		endDate: "2027-04-12",
		status: "estimated",
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

function getConfiguredSeasonKey(rows: Doc<"seasons">[]) {
	const current = getCurrentSegment(rows);
	return current ? formatSeasonKey(current.startYear, current.endYear) : null;
}

const GAME_TABLES = {
	nba: "nbaGameEvent",
	wnba: "wnbaGameEvent",
	gleague: "gleagueGameEvent",
} as const;

/**
 * Season of the most recent game on or before today. Game seasons come from
 * ESPN's own event metadata, so this keeps tracking the real season even when
 * nobody has added the new season to the seasons table yet.
 */
async function getLatestGameSeason(ctx: QueryCtx, league: League): Promise<string | null> {
	const today = getTodayDate();
	const latest = await ctx.db
		.query(GAME_TABLES[league])
		.withIndex("by_gameDate", (q) => q.lte("gameDate", today))
		.order("desc")
		.first();
	return latest?.season ?? null;
}

/**
 * The current season key ("2026-27", or "2026" for WNBA). Uses the configured
 * seasons table, but if ESPN-tagged games show a newer season has started,
 * that newer season wins.
 */
export async function resolveCurrentSeasonKey(
	ctx: QueryCtx,
	league: League,
	rows?: Doc<"seasons">[],
): Promise<string | null> {
	const seasonRows =
		rows ??
		(await ctx.db
			.query("seasons")
			.withIndex("by_league", (q) => q.eq("league", league))
			.collect());
	const configured = getConfiguredSeasonKey(seasonRows);
	const fromGames = await getLatestGameSeason(ctx, league);
	if (!configured) return fromGames;
	if (!fromGames) return configured;
	return compareSeasons(fromGames, configured) > 0 ? fromGames : configured;
}

function matchesSeasonKey(season: Doc<"seasons">, seasonKey: string) {
	return formatSeasonKey(season.startYear, season.endYear) === seasonKey;
}

function getTypeSegment(rows: Doc<"seasons">[], seasonKey: string, type: SeasonType) {
	return (
		rows.find((season) => matchesSeasonKey(season, seasonKey) && season.type === type) ??
		null
	);
}

/**
 * Whether the seasons table is missing the current season. True when ESPN data
 * shows a newer season than any configured row, or when today is past the end
 * of every configured row.
 */
function getConfigWarning(rows: Doc<"seasons">[], currentKey: string | null) {
	const today = new Date().toISOString().split("T")[0];
	const lastEnd = rows.reduce<string | null>(
		(max, row) => (max === null || row.endDate > max ? row.endDate : max),
		null,
	);
	const hasCurrentRows = currentKey ? rows.some((row) => matchesSeasonKey(row, currentKey)) : false;

	if (currentKey && !hasCurrentRows) {
		return {
			reason: "missing-current-season" as const,
			currentSeason: currentKey,
			startYear: getSeasonStartYear(currentKey),
			endYear: getSeasonEndYear(currentKey),
			lastConfiguredEndDate: lastEnd,
		};
	}
	if (!lastEnd || today > lastEnd) {
		return {
			reason: "past-last-configured-season" as const,
			currentSeason: currentKey,
			startYear: currentKey ? getSeasonStartYear(currentKey) : null,
			endYear: currentKey ? getSeasonEndYear(currentKey) : null,
			lastConfiguredEndDate: lastEnd,
		};
	}
	return null;
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
		return await resolveCurrentSeasonKey(ctx, args.league, rows);
	},
});

/** Per-league warnings for the admin page when the seasons table is out of date. */
export const getConfigStatus = query({
	args: {},
	handler: async (ctx) => {
		const leagues: League[] = ["nba", "wnba", "gleague"];
		return await Promise.all(
			leagues.map(async (league) => {
				const rows = await ctx.db
					.query("seasons")
					.withIndex("by_league", (q) => q.eq("league", league))
					.collect();
				const currentSeason = await resolveCurrentSeasonKey(ctx, league, rows);
				return { league, currentSeason, warning: getConfigWarning(rows, currentSeason) };
			}),
		);
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

		const seasonKey = await resolveCurrentSeasonKey(ctx, args.league, rows);
		if (!seasonKey) return null;

		if (args.eventType === "offseasonStart") {
			const playoffs = getTypeSegment(rows, seasonKey, "playoffs");
			return playoffs ? nextDate(playoffs.endDate) : null;
		}

		const type =
			args.eventType === "preseasonStart" || args.eventType === "preseasonEnd"
				? "pre-season"
				: args.eventType === "regularSeasonStart" ||
						args.eventType === "regularSeasonEnd"
					? "regular-season"
					: "playoffs";
		// Null when the current season isn't configured; callers fall back to defaults
		// instead of reusing last season's dates.
		const segment = getTypeSegment(rows, seasonKey, type);
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

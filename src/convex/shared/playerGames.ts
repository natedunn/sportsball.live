// The player page's games table, assembled on the server so a page of games
// costs one bounded query. It reads a player's own box score lines, their team's
// schedule and why they sat: a season's worth, at most a couple of hundred
// small rows. getPlayerGameLog is the expensive one, because advanced stats need
// every player's line in every game, and the table needs none of that.
import { v } from "convex/values";
import { summarizeAvailability, type GameAbsence, type InjuryReportEntry } from "./playerAvailability";
import {
	buildTeamGame,
	gameLogPhase,
	gameScore,
	lineStats,
	type GameLike,
	type GameLogPhase,
	type PlayerLineLike,
	type PlayerLineStats,
	type PlayerTeamGame,
} from "./playerGameLog";
import { countsTowardGameLog } from "./seasonHelpers";

export const PLAYER_GAMES_DEFAULT_PAGE_SIZE = 20;
const PLAYER_GAMES_MAX_PAGE_SIZE = 50;

const gamesSortKey = v.union(
	v.literal("date"),
	v.literal("min"),
	v.literal("pts"),
	v.literal("reb"),
	v.literal("ast"),
	v.literal("stl"),
	v.literal("blk"),
	v.literal("tov"),
	v.literal("fg"),
	v.literal("tp"),
	v.literal("ft"),
	v.literal("pm"),
	v.literal("gmsc"),
);

export const playerGamesArgs = {
	page: v.optional(v.number()),
	pageSize: v.optional(v.number()),
	phase: v.optional(v.union(v.literal("regular"), v.literal("playoffs"), v.literal("tournament"))),
	split: v.optional(
		v.union(v.literal("home"), v.literal("road"), v.literal("wins"), v.literal("losses")),
	),
	show: v.optional(v.union(v.literal("played"), v.literal("all"))),
	sort: v.optional(gamesSortKey),
	dir: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
};

export type GamesSortKey = "date" | "min" | "pts" | "reb" | "ast" | "stl" | "blk" | "tov" | "fg" | "tp" | "ft" | "pm" | "gmsc";
export type GamesSplit = "home" | "road" | "wins" | "losses";
export type GamesShow = "played" | "all";
export type GamesSortDir = "asc" | "desc";

export interface PlayerGamesOptions {
	page?: number;
	pageSize?: number;
	phase?: GameLogPhase;
	split?: GamesSplit;
	/** Defaults to the games they played */
	show?: GamesShow;
	sort?: GamesSortKey;
	dir?: GamesSortDir;
}

/** A game in the table. One they missed has a reason and all-zero stats */
export interface PlayerGameTableRow extends PlayerTeamGame, PlayerLineStats {
	starter: boolean;
	missedReason?: string;
	/** Set when the reason is an injury: its place in `injuries` */
	injuryIndex?: number;
}

const MISSED_STATS: PlayerLineStats = {
	min: 0,
	pts: 0,
	reb: 0,
	oreb: 0,
	dreb: 0,
	ast: 0,
	stl: 0,
	blk: 0,
	tov: 0,
	pf: 0,
	fgm: 0,
	fga: 0,
	tpm: 0,
	tpa: 0,
	ftm: 0,
	fta: 0,
	plusMinus: 0,
};

const SORT_VALUES: Record<Exclude<GamesSortKey, "date">, (row: PlayerGameTableRow) => number> = {
	min: (row) => row.min,
	pts: (row) => row.pts,
	reb: (row) => row.reb,
	ast: (row) => row.ast,
	stl: (row) => row.stl,
	blk: (row) => row.blk,
	tov: (row) => row.tov,
	fg: (row) => row.fgm,
	tp: (row) => row.tpm,
	ft: (row) => row.ftm,
	pm: (row) => row.plusMinus ?? Number.NEGATIVE_INFINITY,
	gmsc: gameScore,
};

function matchesFilters(row: PlayerGameTableRow, options: PlayerGamesOptions) {
	if (options.show !== "all" && row.missedReason !== undefined) return false;
	if (options.phase && row.phase !== options.phase) return false;
	const won = row.teamScore > row.oppScore;
	switch (options.split) {
		case "home":
			return row.isHome;
		case "road":
			return !row.isHome;
		case "wins":
			return won;
		case "losses":
			return !won;
		default:
			return true;
	}
}

/** Newest first unless told otherwise; ties keep the newest game on top */
function sortRows(rows: PlayerGameTableRow[], options: PlayerGamesOptions) {
	const direction = options.dir === "asc" ? 1 : -1;
	const newestFirst = [...rows].sort((a, b) => b.scheduledStart - a.scheduledStart);
	if (!options.sort || options.sort === "date") {
		return direction === 1 ? newestFirst.reverse() : newestFirst;
	}
	const value = SORT_VALUES[options.sort];
	return newestFirst.sort((a, b) => direction * (value(a) - value(b)));
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

interface GameDoc<TeamId> extends GameLike {
	homeTeamId: TeamId;
	awayTeamId: TeamId;
}

/** Everything the table needs, ready to return from a query */
export async function assemblePlayerGames<TeamId extends string, Game extends GameDoc<TeamId>>(args: {
	currentTeamId: TeamId;
	/** Games the player appeared in, each with their line */
	played: Array<{ game: Game; line: PlayerLineLike & { teamId: TeamId } }>;
	/** The current team's whole schedule, finished or not */
	schedule: Game[];
	/** Games sat out for a former team, which aren't on that schedule */
	formerGames: Array<{ game: Game; teamId: TeamId }>;
	absences: GameAbsence[];
	reports: InjuryReportEntry[];
	options: PlayerGamesOptions;
	/** Called once per team on the page */
	abbreviationFor: (teamId: TeamId) => Promise<string | undefined>;
}) {
	const { currentTeamId, played, options } = args;
	const pageSize = clamp(
		Math.floor(options.pageSize ?? PLAYER_GAMES_DEFAULT_PAGE_SIZE),
		1,
		PLAYER_GAMES_MAX_PAGE_SIZE,
	);

	const playedIds = new Set(played.map(({ game }) => game.espnGameId));
	// Traded: the current team's earlier games weren't theirs to miss
	const traded = played.some(({ line }) => line.teamId !== currentTeamId);
	const joined = played
		.filter(({ line }) => line.teamId === currentTeamId)
		.map(({ game }) => game.gameDate)
		.sort()[0];

	const missedGames = [
		...args.schedule
			.filter((game) => countsTowardGameLog(game) && !(traded && joined && game.gameDate < joined))
			.map((game) => ({ game, teamId: currentTeamId })),
		...args.formerGames.filter(({ game }) => countsTowardGameLog(game)),
	].filter(({ game }) => !playedIds.has(game.espnGameId));

	const teamGame = (game: Game, teamId: TeamId) => ({
		...buildTeamGame(game, game.homeTeamId === teamId, "", ""),
		teamId,
		opponentId: game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId,
	});

	// The report log only runs forward from the last thing we know of. Not the
	// clock: that would make a cached query's answer depend on when it ran.
	const now = Math.max(
		0,
		...played.map(({ game }) => game.scheduledStart),
		...missedGames.map(({ game }) => game.scheduledStart),
		...args.reports.map((report) => report.firstSeenAt),
	);
	const summary = summarizeAvailability({
		played: played.map(({ game, line }) => ({
			gameDate: game.gameDate,
			phase: gameLogPhase(game),
			starter: line.starter,
		})),
		teamGames: missedGames.map(({ game }) => ({ gameDate: game.gameDate, phase: gameLogPhase(game) })),
		absences: args.absences,
		reports: args.reports,
		now,
	});
	const reasons = new Map(summary.games.map((game) => [game.gameDate, game.reason]));
	const injuryIndexes = new Map(
		summary.injuries.flatMap((injury, index) =>
			injury.gameDates.map((date) => [date, index] as const),
		),
	);

	const rows = [
		...played.map(({ game, line }) => ({
			...teamGame(game, line.teamId),
			...lineStats(line),
			starter: line.starter,
		})),
		...missedGames.map(({ game, teamId }) => ({
			...teamGame(game, teamId),
			...MISSED_STATS,
			starter: false,
			missedReason: reasons.get(game.gameDate) ?? "Reason unknown",
			injuryIndex: injuryIndexes.get(game.gameDate),
		})),
	];

	const filtered = rows.filter((row) => matchesFilters(row, options));
	const total = filtered.length;
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const page = clamp(Math.floor(options.page ?? 1), 1, pageCount);
	const pageRows = sortRows(filtered, options).slice((page - 1) * pageSize, page * pageSize) as Array<
		(typeof rows)[number]
	>;

	const abbreviations = new Map<TeamId, Promise<string | undefined>>();
	const abbreviation = async (teamId: TeamId) => {
		if (!abbreviations.has(teamId)) abbreviations.set(teamId, args.abbreviationFor(teamId));
		return (await abbreviations.get(teamId)) ?? "UNK";
	};

	return {
		rows: await Promise.all(
			pageRows.map(async ({ teamId, opponentId, ...row }): Promise<PlayerGameTableRow> => ({
				...row,
				teamAbbreviation: await abbreviation(teamId),
				opponent: await abbreviation(opponentId),
			})),
		),
		page,
		pageCount,
		/** Games matching the filters */
		total,
		/** Which phases have games, for the filter */
		phases: (["regular", "playoffs", "tournament"] as const).filter((phase) =>
			rows.some((row) => row.phase === phase),
		),
		played: summary.played,
		started: summary.started,
		missed: summary.missed,
		/** Regular season games missed to a known injury */
		missedToInjury: missedGames.filter(
			({ game }) => gameLogPhase(game) === "regular" && injuryIndexes.has(game.gameDate),
		).length,
		availability: summary.availability,
		playoffs: summary.playoffs,
		injuries: summary.injuries.map(({ gameDates: _gameDates, ...injury }) => injury),
	};
}

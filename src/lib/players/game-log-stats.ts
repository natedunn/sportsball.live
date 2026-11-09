import {
	gameScore,
	type GameLogPhase,
	type PlayerGameLogRow,
} from "@convex/shared/playerGameLog";

export type { GameLogPhase, PlayerGameLogRow };

/** Narrows the game log within a phase */
export type GameLogSplit = "all" | "last5" | "last10" | "home" | "road" | "wins" | "losses";

export const GAME_LOG_SPLITS: Array<{ value: GameLogSplit; label: string }> = [
	{ value: "all", label: "All games" },
	{ value: "last5", label: "Last 5" },
	{ value: "last10", label: "Last 10" },
	{ value: "home", label: "Home" },
	{ value: "road", label: "Road" },
	{ value: "wins", label: "Wins" },
	{ value: "losses", label: "Losses" },
];

export const PHASE_LABELS: Record<GameLogPhase, string> = {
	regular: "Regular season",
	playoffs: "Playoffs",
	tournament: "Tournaments",
};

/** Phases the player has games in, in season order */
export function phasesIn(rows: PlayerGameLogRow[]): GameLogPhase[] {
	const order: GameLogPhase[] = ["regular", "playoffs", "tournament"];
	return order.filter((phase) => rows.some((row) => row.phase === phase));
}

export function isWin(row: PlayerGameLogRow) {
	return row.teamScore > row.oppScore;
}

/** `rows` newest first, as the query returns them */
export function filterGameLog(
	rows: PlayerGameLogRow[],
	phase: GameLogPhase,
	split: GameLogSplit,
): PlayerGameLogRow[] {
	const inPhase = rows.filter((row) => row.phase === phase);
	switch (split) {
		case "last5":
			return inPhase.slice(0, 5);
		case "last10":
			return inPhase.slice(0, 10);
		case "home":
			return inPhase.filter((row) => row.isHome);
		case "road":
			return inPhase.filter((row) => !row.isHome);
		case "wins":
			return inPhase.filter(isWin);
		case "losses":
			return inPhase.filter((row) => !isWin(row));
		default:
			return inPhase;
	}
}

export { gameScore };

const COUNTING = [
	"min",
	"pts",
	"reb",
	"oreb",
	"dreb",
	"ast",
	"stl",
	"blk",
	"tov",
	"pf",
	"fgm",
	"fga",
	"tpm",
	"tpa",
	"ftm",
	"fta",
] as const;
type CountingStat = (typeof COUNTING)[number];

export type CountingTotals = Record<CountingStat, number>;

export type StatMode = "perGame" | "per36" | "totals";

export interface GameLogSummary {
	games: number;
	wins: number;
	losses: number;
	/** Counting stats in the requested mode */
	stats: CountingTotals;
	/** Percentages, 0-100; null with no attempts */
	fgPct: number | null;
	tpPct: number | null;
	ftPct: number | null;
	/** Average plus-minus over games that report it */
	plusMinus: number | null;
	gameScore: number | null;
}

function emptyTotals(): CountingTotals {
	return Object.fromEntries(COUNTING.map((key) => [key, 0])) as CountingTotals;
}

function pct(made: number, attempted: number) {
	return attempted > 0 ? (made / attempted) * 100 : null;
}

export function summarizeGameLog(rows: PlayerGameLogRow[], mode: StatMode): GameLogSummary {
	const totals = emptyTotals();
	for (const row of rows) {
		for (const key of COUNTING) totals[key] += row[key];
	}
	const games = rows.length;
	const divisor =
		mode === "totals" ? 1 : mode === "per36" ? (totals.min > 0 ? totals.min / 36 : 0) : games;
	const stats = emptyTotals();
	for (const key of COUNTING) {
		// Per 36 keeps minutes per game; scaling minutes to 36 says nothing
		const by = mode === "per36" && key === "min" ? games : divisor;
		stats[key] = by > 0 ? totals[key] / by : 0;
	}

	const withPlusMinus = rows.filter((row) => row.plusMinus !== undefined);
	const wins = rows.filter(isWin).length;
	return {
		games,
		wins,
		losses: games - wins,
		stats,
		fgPct: pct(totals.fgm, totals.fga),
		tpPct: pct(totals.tpm, totals.tpa),
		ftPct: pct(totals.ftm, totals.fta),
		plusMinus:
			withPlusMinus.length > 0
				? withPlusMinus.reduce((sum, row) => sum + (row.plusMinus ?? 0), 0) / withPlusMinus.length
				: null,
		gameScore: games > 0 ? rows.reduce((sum, row) => sum + gameScore(row), 0) / games : null,
	};
}

/** Advanced stats, all 0-100 percentages; null when a denominator is zero */
export interface AdvancedStats {
	tsPct: number | null;
	efgPct: number | null;
	usgPct: number | null;
	astPct: number | null;
	orebPct: number | null;
	drebPct: number | null;
	rebPct: number | null;
	stlPct: number | null;
	blkPct: number | null;
	tovPct: number | null;
	threePointRate: number | null;
	freeThrowRate: number | null;
}

function ratio(numerator: number, denominator: number) {
	return denominator > 0 ? (numerator / denominator) * 100 : null;
}

/**
 * Basketball-Reference's formulas, summed over the games in `rows`. Team and
 * opponent totals come from those same games, so the rates describe the
 * player's share while they were in the lineup that night. Opponent
 * possessions use FGA + 0.44 FTA - OREB + TOV, as our team ratings do.
 */
export function advancedStats(rows: PlayerGameLogRow[]): AdvancedStats {
	const p = emptyTotals();
	const team = { minutes: 0, fgm: 0, fga: 0, fta: 0, tov: 0, oreb: 0, dreb: 0, reb: 0 };
	const opp = { fga: 0, tpa: 0, fta: 0, tov: 0, oreb: 0, dreb: 0, reb: 0 };
	for (const row of rows) {
		for (const key of COUNTING) p[key] += row[key];
		team.minutes += row.team.minutes;
		team.fgm += row.team.fgm;
		team.fga += row.team.fga;
		team.fta += row.team.fta;
		team.tov += row.team.tov;
		team.oreb += row.team.oreb;
		team.dreb += row.team.dreb;
		team.reb += row.team.reb;
		opp.fga += row.opp.fga;
		opp.tpa += row.opp.tpa;
		opp.fta += row.opp.fta;
		opp.tov += row.opp.tov;
		opp.oreb += row.opp.oreb;
		opp.dreb += row.opp.dreb;
		opp.reb += row.opp.reb;
	}

	// Minutes a single lineup spot plays across these games
	const spot = team.minutes / 5;
	// How much of the game the player was on the floor for, scaling team totals
	const share = (value: number) => (spot > 0 ? (p.min / spot) * value : 0);
	const playerPlays = p.fga + 0.44 * p.fta + p.tov;
	const oppPossessions = opp.fga + 0.44 * opp.fta - opp.oreb + opp.tov;

	return {
		tsPct: ratio(p.pts, 2 * (p.fga + 0.44 * p.fta)),
		efgPct: ratio(p.fgm + 0.5 * p.tpm, p.fga),
		usgPct: ratio(playerPlays, share(team.fga + 0.44 * team.fta + team.tov)),
		astPct: ratio(p.ast, share(team.fgm) - p.fgm),
		orebPct: ratio(p.oreb, share(team.oreb + opp.dreb)),
		drebPct: ratio(p.dreb, share(team.dreb + opp.oreb)),
		rebPct: ratio(p.reb, share(team.reb + opp.reb)),
		stlPct: ratio(p.stl, share(oppPossessions)),
		blkPct: ratio(p.blk, share(opp.fga - opp.tpa)),
		tovPct: ratio(p.tov, playerPlays),
		threePointRate: ratio(p.tpa, p.fga),
		freeThrowRate: ratio(p.fta, p.fga),
	};
}

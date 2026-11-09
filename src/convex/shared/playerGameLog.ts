import { ESPN_SEASON_TYPE, countsTowardSeasonAverages } from "./seasonHelpers";

/** Which part of the season a game belongs to */
export type GameLogPhase = "regular" | "playoffs" | "tournament";

/** A team's box score totals for one game, as advanced stats need them */
export interface GameLogTeamBox {
	/** Sum of the team's player minutes (240 in a regulation NBA game) */
	minutes: number;
	fgm: number;
	fga: number;
	tpa: number;
	fta: number;
	tov: number;
	oreb: number;
	dreb: number;
	reb: number;
}

/** One game the player appeared in, with both teams' totals */
/** A player's box score line in one game */
export interface PlayerLineStats {
	min: number;
	pts: number;
	reb: number;
	oreb: number;
	dreb: number;
	ast: number;
	stl: number;
	blk: number;
	tov: number;
	pf: number;
	fgm: number;
	fga: number;
	tpm: number;
	tpa: number;
	ftm: number;
	fta: number;
	plusMinus?: number;
}

export interface PlayerGameLogRow extends PlayerLineStats {
	espnGameId: string;
	gameDate: string;
	scheduledStart: number;
	phase: GameLogPhase;
	isHome: boolean;
	/** The player's team that night, which may differ after a trade */
	teamAbbreviation: string;
	opponent: string;
	teamScore: number;
	oppScore: number;
	starter: boolean;
	team: GameLogTeamBox;
	opp: GameLogTeamBox;
}

/** A game of the player's team, whether or not they were in it */
export interface PlayerTeamGame {
	espnGameId: string;
	gameDate: string;
	scheduledStart: number;
	phase: GameLogPhase;
	isHome: boolean;
	teamAbbreviation: string;
	opponent: string;
	teamScore: number;
	oppScore: number;
}

export interface GameLike {
	espnGameId: string;
	gameDate: string;
	scheduledStart: number;
	seasonType?: number;
	competitionType?: string;
	eventStatus?: string;
	homeScore?: number;
	awayScore?: number;
}

interface TeamEventLike {
	score: number;
	fieldGoalsMade: number;
	fieldGoalsAttempted: number;
	threePointAttempted: number;
	freeThrowsAttempted: number;
	turnovers: number;
	offensiveRebounds: number;
	defensiveRebounds: number;
	totalRebounds: number;
}

export interface PlayerLineLike {
	starter: boolean;
	minutes: number;
	points: number;
	totalRebounds: number;
	offensiveRebounds: number;
	defensiveRebounds: number;
	assists: number;
	steals: number;
	blocks: number;
	turnovers: number;
	fouls: number;
	fieldGoalsMade: number;
	fieldGoalsAttempted: number;
	threePointMade: number;
	threePointAttempted: number;
	freeThrowsMade: number;
	freeThrowsAttempted: number;
	plusMinus?: number;
}

export function gameLogPhase(game: GameLike): GameLogPhase {
	// Read before the type guard below narrows `game` away
	const { seasonType } = game;
	if (countsTowardSeasonAverages(game)) return "regular";
	if (seasonType === ESPN_SEASON_TYPE.postseason) return "playoffs";
	// Play-in, Cup finals, G League Tip-Off and Showdown Cup games
	return "tournament";
}

export function buildTeamGame(
	game: GameLike,
	isHome: boolean,
	teamAbbreviation: string,
	opponent: string,
): PlayerTeamGame {
	const [home, away] = [game.homeScore ?? 0, game.awayScore ?? 0];
	return {
		espnGameId: game.espnGameId,
		gameDate: game.gameDate,
		scheduledStart: game.scheduledStart,
		phase: gameLogPhase(game),
		isHome,
		teamAbbreviation,
		opponent,
		teamScore: isHome ? home : away,
		oppScore: isHome ? away : home,
	};
}

function teamBox(event: TeamEventLike, minutes: number): GameLogTeamBox {
	return {
		minutes,
		fgm: event.fieldGoalsMade,
		fga: event.fieldGoalsAttempted,
		tpa: event.threePointAttempted,
		fta: event.freeThrowsAttempted,
		tov: event.turnovers,
		oreb: event.offensiveRebounds,
		dreb: event.defensiveRebounds,
		reb: event.totalRebounds,
	};
}

export function lineStats(line: PlayerLineLike): PlayerLineStats {
	return {
		min: line.minutes,
		pts: line.points,
		reb: line.totalRebounds,
		oreb: line.offensiveRebounds,
		dreb: line.defensiveRebounds,
		ast: line.assists,
		stl: line.steals,
		blk: line.blocks,
		tov: line.turnovers,
		pf: line.fouls,
		fgm: line.fieldGoalsMade,
		fga: line.fieldGoalsAttempted,
		tpm: line.threePointMade,
		tpa: line.threePointAttempted,
		ftm: line.freeThrowsMade,
		fta: line.freeThrowsAttempted,
		plusMinus: line.plusMinus,
	};
}

/** John Hollinger's Game Score: a rough single-game productivity number */
export function gameScore(row: PlayerLineStats): number {
	return (
		row.pts +
		0.4 * row.fgm -
		0.7 * row.fga -
		0.4 * (row.fta - row.ftm) +
		0.7 * row.oreb +
		0.3 * row.dreb +
		row.stl +
		0.7 * row.ast +
		0.7 * row.blk -
		0.4 * row.pf -
		row.tov
	);
}

export function buildGameLogRow(args: {
	game: GameLike;
	line: PlayerLineLike;
	isHome: boolean;
	team: string;
	opponent: string;
	teamEvent: TeamEventLike;
	oppEvent: TeamEventLike;
	teamMinutes: number;
	oppMinutes: number;
}): PlayerGameLogRow {
	const { game, line, teamEvent, oppEvent } = args;
	return {
		espnGameId: game.espnGameId,
		gameDate: game.gameDate,
		scheduledStart: game.scheduledStart,
		phase: gameLogPhase(game),
		isHome: args.isHome,
		teamAbbreviation: args.team,
		opponent: args.opponent,
		teamScore: teamEvent.score,
		oppScore: oppEvent.score,
		starter: line.starter,
		...lineStats(line),
		team: teamBox(teamEvent, args.teamMinutes),
		opp: teamBox(oppEvent, args.oppMinutes),
	};
}

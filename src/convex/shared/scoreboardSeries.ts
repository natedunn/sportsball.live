import { ESPN_SEASON_TYPE, getCompetitionYear } from "./seasonHelpers";
type League = "nba" | "wnba" | "gleague";

type SeriesGame = {
	_id: unknown;
	season: string;
	seasonType?: number;
	homeTeamId: unknown;
	awayTeamId: unknown;
	gameDate: string;
	scheduledStart: number;
	eventStatus: string;
	homeScore?: number;
	awayScore?: number;
};

type SeriesRecord = {
	home: string;
	away: string;
};

/** Configured playoff date range (YYYY-MM-DD), usually from the seasons table. */
export type PlayoffWindow = {
	startDate?: string;
	endDate?: string;
};

function normalizeDate(date: string): string {
	if (date.includes("-")) return date;
	return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

export function getPlayoffStartDate(league: League, season: string): string {
	const competitionYear = getCompetitionYear(league, season);

	switch (league) {
		case "nba":
			return `${competitionYear}-04-14`;
		case "gleague":
			return `${competitionYear}-03-31`;
		case "wnba":
			return `${competitionYear}-09-27`;
	}
}

export function getPlayoffEndDate(league: League, season: string): string {
	const competitionYear = getCompetitionYear(league, season);

	switch (league) {
		case "nba":
			return `${competitionYear}-06-30`;
		case "gleague":
			return `${competitionYear}-04-30`;
		case "wnba":
			return `${competitionYear}-10-31`;
	}
}

/**
 * Date-based playoff check, used only for legacy games that were stored before
 * we recorded ESPN's season type. Bounded on both ends so games from the next
 * season (still tagged with the old season string) are never treated as playoffs.
 */
export function isPlayoffScoreboardDate(
	league: League,
	season: string,
	gameDate: string,
	window?: PlayoffWindow,
): boolean {
	const date = normalizeDate(gameDate);
	const startDate = window?.startDate ?? getPlayoffStartDate(league, season);
	const endDate = window?.endDate ?? getPlayoffEndDate(league, season);
	return date >= startDate && date <= endDate;
}

/**
 * Whether a game is a postseason game. ESPN's season type is authoritative when
 * present; play-in games (type 5) are not part of a series.
 */
export function isPlayoffGame(
	league: League,
	game: Pick<SeriesGame, "season" | "seasonType" | "gameDate">,
	window?: PlayoffWindow,
): boolean {
	if (game.seasonType !== undefined) {
		return game.seasonType === ESPN_SEASON_TYPE.postseason;
	}
	return isPlayoffScoreboardDate(league, game.season, game.gameDate, window);
}

function sameId(a: unknown, b: unknown): boolean {
	return String(a) === String(b);
}

export function getSeriesRecordForGame(
	league: League,
	currentGame: SeriesGame,
	candidateGames: SeriesGame[],
	window?: PlayoffWindow,
): SeriesRecord | undefined {
	if (!isPlayoffGame(league, currentGame, window)) {
		return undefined;
	}

	let homeWins = 0;
	let awayWins = 0;

	for (const game of candidateGames) {
		if (game.season !== currentGame.season) continue;
		if (game.eventStatus !== "completed") continue;
		if (!isPlayoffGame(league, game, window)) continue;
		if (
			game.scheduledStart > currentGame.scheduledStart ||
			(sameId(game._id, currentGame._id) &&
				currentGame.eventStatus !== "completed")
		) {
			continue;
		}

		const sameHomeAway =
			sameId(game.homeTeamId, currentGame.homeTeamId) &&
			sameId(game.awayTeamId, currentGame.awayTeamId);
		const reversedHomeAway =
			sameId(game.homeTeamId, currentGame.awayTeamId) &&
			sameId(game.awayTeamId, currentGame.homeTeamId);

		if (!sameHomeAway && !reversedHomeAway) continue;
		if (game.homeScore === undefined || game.awayScore === undefined) continue;
		if (game.homeScore === game.awayScore) continue;

		const gameHomeWon = game.homeScore > game.awayScore;
		const currentHomeWon =
			(sameHomeAway && gameHomeWon) || (reversedHomeAway && !gameHomeWon);

		if (currentHomeWon) {
			homeWins += 1;
		} else {
			awayWins += 1;
		}
	}

	return {
		home: `${homeWins}-${awayWins}`,
		away: `${awayWins}-${homeWins}`,
	};
}

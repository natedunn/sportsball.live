import { ESPN_SEASON_TYPE } from "./seasonHelpers";

type SeriesGame = {
	_id: unknown;
	season: string;
	seasonType?: number;
	homeTeamId: unknown;
	awayTeamId: unknown;
	scheduledStart: number;
	eventStatus: string;
	homeScore?: number;
	awayScore?: number;
};

type SeriesRecord = {
	home: string;
	away: string;
};

/**
 * Whether a game is a postseason game, by ESPN's season type. Play-in games
 * (type 5) are not part of a series, and a game without a season type is never
 * treated as one.
 */
export function isPlayoffGame(game: Pick<SeriesGame, "seasonType">): boolean {
	return game.seasonType === ESPN_SEASON_TYPE.postseason;
}

function sameId(a: unknown, b: unknown): boolean {
	return String(a) === String(b);
}

export function getSeriesRecordForGame(
	currentGame: SeriesGame,
	candidateGames: SeriesGame[],
): SeriesRecord | undefined {
	if (!isPlayoffGame(currentGame)) {
		return undefined;
	}

	let homeWins = 0;
	let awayWins = 0;

	for (const game of candidateGames) {
		if (game.season !== currentGame.season) continue;
		if (game.eventStatus !== "completed") continue;
		if (!isPlayoffGame(game)) continue;
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

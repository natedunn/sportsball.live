import { getCompetitionYear } from "./seasonHelpers";
type League = "nba" | "wnba" | "gleague";

type SeriesGame = {
	_id: unknown;
	season: string;
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

export function isPlayoffScoreboardDate(
	league: League,
	season: string,
	gameDate: string,
): boolean {
	return normalizeDate(gameDate) >= getPlayoffStartDate(league, season);
}

function sameId(a: unknown, b: unknown): boolean {
	return String(a) === String(b);
}

export function getSeriesRecordForGame(
	league: League,
	currentGame: SeriesGame,
	candidateGames: SeriesGame[],
): SeriesRecord | undefined {
	if (
		!isPlayoffScoreboardDate(
			league,
			currentGame.season,
			currentGame.gameDate,
		)
	) {
		return undefined;
	}

	let homeWins = 0;
	let awayWins = 0;

	for (const game of candidateGames) {
		if (game.season !== currentGame.season) continue;
		if (game.eventStatus !== "completed") continue;
		if (!isPlayoffScoreboardDate(league, game.season, game.gameDate)) continue;
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

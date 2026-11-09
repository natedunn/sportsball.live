import type { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { getTeamStaticData } from "@/lib/teams";
import type { League } from "@/lib/shared/league";
import { isWin, type PlayerGameLogRow } from "@/lib/players/game-log-stats";
import {
	playerDetailsQuery,
	playerGameLogQuery,
	playerGamesQuery,
	GAMES_PREVIEW_SIZE,
} from "@/components/player-details/player-details-page";
import type {
	GamesShow,
	GamesSortDir,
	GamesSortKey,
	GamesSplit,
	PlayerGamesOptions,
} from "@convex/shared/playerGames";
import { seo } from "@/lib/seo";

/** What the page tags need when a stats link opens one game */
export interface SharedPerformance {
	playerName: string;
	row: PlayerGameLogRow;
}

/**
 * Loader for the player stats routes: primes the game log for SSR and, when
 * `?game=` names one of the player's games, returns it for the page tags.
 */
export async function loadPlayerStats(
	queryClient: QueryClient,
	league: League,
	espnPlayerId: string,
	game: number | undefined,
): Promise<{ performance?: SharedPerformance }> {
	const season = await queryClient.ensureQueryData(
		convexQuery(api.seasons.getCurrentName, { league }),
	);
	if (!season) return {};
	const [gameLog, details] = await Promise.all([
		queryClient.ensureQueryData(playerGameLogQuery(league, season, espnPlayerId)),
		game === undefined
			? undefined
			: queryClient.ensureQueryData(playerDetailsQuery(league, season, espnPlayerId)),
	]);
	const row = game === undefined ? undefined : gameLog?.find((entry) => entry.espnGameId === String(game));
	if (!row || !details?.player) return {};
	return { performance: { playerName: details.player.name, row } };
}

/**
 * Loader for the games routes: primes the page of games for SSR. The full game
 * log is only needed when `?game=` opens one.
 */
export async function loadPlayerGames(
	queryClient: QueryClient,
	league: League,
	espnPlayerId: string,
	game: number | undefined,
	options: PlayerGamesOptions,
): Promise<{ performance?: SharedPerformance }> {
	const season = await queryClient.ensureQueryData(
		convexQuery(api.seasons.getCurrentName, { league }),
	);
	if (!season) return {};
	const [performance] = await Promise.all([
		game === undefined ? {} : loadPlayerStats(queryClient, league, espnPlayerId, game),
		queryClient.ensureQueryData(playerGamesQuery(league, season, espnPlayerId, options)),
	]);
	return performance;
}

export const GAME_LOG_PAGE_SIZE = 25;

/** The full game log's URL: its filters, sort and page, and the open game */
export interface GameLogSearch extends Omit<PlayerGamesOptions, "pageSize"> {
	game?: number;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
	return allowed.find((option) => option === value);
}

function positiveInteger(value: unknown) {
	const number = Number(value);
	return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

const SORT_KEYS: readonly GamesSortKey[] = [
	"date", "min", "pts", "reb", "ast", "stl", "blk", "tov", "fg", "tp", "ft", "pm", "gmsc",
];
const SPLITS: readonly GamesSplit[] = ["home", "road", "wins", "losses"];
// Played is the default, so it stays out of the URL
const SHOWS: readonly GamesShow[] = ["all"];
const DIRECTIONS: readonly GamesSortDir[] = ["asc", "desc"];

export function validateGameLogSearch(search: Record<string, unknown>): GameLogSearch {
	return {
		page: positiveInteger(search.page),
		phase: oneOf(search.phase, ["regular", "playoffs", "tournament"]),
		split: oneOf(search.split, SPLITS),
		show: oneOf(search.show, SHOWS),
		sort: oneOf(search.sort, SORT_KEYS),
		dir: oneOf(search.dir, DIRECTIONS),
		game: positiveInteger(search.game),
	};
}

/** The games tab's URL: the open game, and whether missed games are listed */
export interface GamesSearch {
	/**
	 * ESPN game id: opens that game's performance, so it can be shared. A
	 * number, since the router would quote a numeric string in the URL.
	 */
	game?: number;
	show?: "all";
}

export function validateGamesSearch(search: Record<string, unknown>): GamesSearch {
	return {
		game: positiveInteger(search.game),
		show: oneOf(search.show, ["all"]),
	};
}

/** The server's options for the games tab */
export function gamesOptions({ show }: GamesSearch): PlayerGamesOptions {
	return show ? { pageSize: GAMES_PREVIEW_SIZE, show } : { pageSize: GAMES_PREVIEW_SIZE };
}

/** The server's options for a game log URL */
export function gameLogOptions({ game: _game, ...search }: GameLogSearch): PlayerGamesOptions {
	// Unset filters are left out, not sent as undefined, so the same page is
	// one query whichever way it was reached
	const set = Object.entries(search).filter(([, value]) => value !== undefined);
	return { ...Object.fromEntries(set), pageSize: GAME_LOG_PAGE_SIZE };
}

/** "20261102" → "Monday, Nov 2, 2026" */
function formatDate(gameDate: string, short = false) {
	const date = new Date(
		Number(gameDate.slice(0, 4)),
		Number(gameDate.slice(4, 6)) - 1,
		Number(gameDate.slice(6, 8)),
	);
	return date.toLocaleDateString(
		"en-US",
		short
			? { month: "short", day: "numeric" }
			: { weekday: "long", month: "short", day: "numeric", year: "numeric" },
	);
}

/**
 * Tags for a shared game performance. Unlike other pages these carry numbers:
 * the game is over, so the preview can't go stale.
 */
export function playerStatsSeo(
	league: League,
	espnPlayerId: string,
	performance: SharedPerformance | undefined,
) {
	if (!performance) return [];
	const { playerName, row } = performance;
	const opponent = getTeamStaticData(league, row.opponent);
	const where = row.isHome ? "vs" : "at";
	const result = `${isWin(row) ? "win" : "loss"}, ${row.teamScore}-${row.oppScore}`;
	return seo({
		title: `${playerName} ${where} ${opponent?.name ?? row.opponent} · ${formatDate(row.gameDate, true)}`,
		description: `${playerName}: ${row.pts} points, ${row.reb} rebounds and ${row.ast} assists ${where} the ${opponent?.fullName ?? row.opponent} on ${formatDate(row.gameDate)} (${result}).`,
		image: `/api/og/${league}/player/${espnPlayerId}/game/${row.espnGameId}`,
	});
}

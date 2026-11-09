import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { OverviewTab } from "./overview-tab";
import { StatsTab } from "./stats-tab";
import { ComparisonTab } from "./comparison-tab";
import { GameLog } from "./game-log";
import { GamesTab } from "./games-tab";
import { usePlayerDetails } from "./player-details-layout";
import {
	gameLogOptions,
	gamesOptions,
	type GameLogSearch,
	type GamesSearch,
} from "@/lib/players/stats-route";
import { playerGameLogQuery, playerGamesQuery } from "./player-details-page";
import type { PlayerOption } from "./player-search";

// Player tab pages. Each league's player child routes render these; the data
// comes from the player layout route.

export function PlayerOverviewPage() {
	const { player, teammates, league } = usePlayerDetails();
	return <OverviewTab player={player} teammates={teammates} league={league} />;
}

export function PlayerGamesPage({
	search,
	onSearchChange,
}: {
	search: GamesSearch;
	onSearchChange: (change: Partial<GamesSearch>) => void;
}) {
	const { player, league, season } = usePlayerDetails();
	const { data, isLoading } = useQuery({
		...playerGamesQuery(league, season, player.id, gamesOptions(search)),
		enabled: !!season,
		// The table stays up while missed games are added or removed
		placeholderData: keepPreviousData,
	});
	return (
		<GamesTab
			data={data ?? null}
			isLoading={isLoading}
			league={league}
			season={season}
			player={player}
			search={search}
			onSearchChange={onSearchChange}
		/>
	);
}

export function PlayerGameLogPage({
	search,
	onSearchChange,
}: {
	search: GameLogSearch;
	onSearchChange: (change: Partial<GameLogSearch>) => void;
}) {
	const { player, league, season } = usePlayerDetails();
	const { data, isLoading } = useQuery({
		...playerGamesQuery(league, season, player.id, gameLogOptions(search)),
		enabled: !!season,
		// The table stays up while the next page or filter loads
		placeholderData: keepPreviousData,
	});
	return (
		<GameLog
			data={data ?? null}
			isLoading={isLoading}
			league={league}
			season={season}
			player={player}
			search={search}
			onSearchChange={onSearchChange}
		/>
	);
}

export function PlayerStatsPage({
	game,
	onGameChange,
}: {
	/** The game whose performance is open, from the URL */
	game?: string;
	onGameChange: (game: string | null) => void;
}) {
	const { player, league, season } = usePlayerDetails();
	const { data, isLoading } = useQuery({
		...playerGameLogQuery(league, season, player.id),
		enabled: !!season,
	});
	return <StatsTab
			games={data ?? []}
			isLoading={isLoading}
			league={league}
			player={player}
			openGameId={game ?? null}
			onOpenGame={onGameChange}
		/>;
}

export interface PlayerCompareSearch {
	compare?: string;
}

export function validatePlayerCompareSearch(
	search: Record<string, unknown>,
): PlayerCompareSearch {
	// Player ids are numeric, so a hand-written `?compare=123` parses as a number
	const { compare } = search;
	return {
		compare:
			typeof compare === "string" || typeof compare === "number"
				? String(compare)
				: undefined,
	};
}

interface PlayerComparePageProps {
	/** The compared player's id, from the `?compare=` search param */
	compare: string | undefined;
	onCompareChange: (playerId: string) => void;
}

const playerProfileQueries = {
	nba: api.nba.queries.getPlayerProfile,
	wnba: api.wnba.queries.getPlayerProfile,
	gleague: api.gleague.queries.getPlayerProfile,
};

export function PlayerComparePage({
	compare,
	onCompareChange,
}: PlayerComparePageProps) {
	const { player, league, season } = usePlayerDetails();
	const compareId = compare && compare !== player.id ? compare : "";
	// The player just picked in the search, shown while their stats load
	const [picked, setPicked] = useState<PlayerOption | null>(null);

	const { data: comparedPlayer, isLoading } = useQuery({
		...convexQuery(playerProfileQueries[league], { season, espnPlayerId: compareId }),
		enabled: !!season && !!compareId,
	});

	const selected = comparedPlayer
		? {
				id: comparedPlayer.id,
				name: comparedPlayer.name,
				team: comparedPlayer.team,
				position: comparedPlayer.position,
			}
		: picked?.id === compareId
			? picked
			: null;

	return (
		<ComparisonTab
			player={player}
			league={league}
			season={season}
			compareId={compareId}
			selected={compareId ? selected : null}
			onCompareChange={(option) => {
				setPicked(option);
				onCompareChange(option?.id ?? "");
			}}
			isLoading={isLoading}
			comparedPlayer={compareId ? (comparedPlayer ?? undefined) : undefined}
		/>
	);
}

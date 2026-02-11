import { useEffect, useRef } from "react";
import type { League } from "./league";
import { syncGamesForView } from "./sync.server";

export const LIVE_SCORE_REFRESH_INTERVAL_MS = 15_000;

export type RawSyncableGame = {
	espnGameId?: string;
	eventStatus?: string;
	scheduledStart?: number;
	lastFetchedAt?: number;
};

export type SyncableGame = {
	espnGameId: string;
	eventStatus?: string;
	scheduledStart?: number;
	lastFetchedAt?: number;
};

export function toSyncableGames(
	rawGames: RawSyncableGame[] | null | undefined,
): SyncableGame[] {
	if (!rawGames) return [];

	return rawGames
		.filter(
			(game): game is SyncableGame =>
				typeof game.espnGameId === "string" && game.espnGameId.length > 0,
		)
		.map((game) => ({
			espnGameId: game.espnGameId,
			eventStatus: game.eventStatus,
			scheduledStart: game.scheduledStart,
			lastFetchedAt: game.lastFetchedAt,
		}));
}

export async function syncLeagueGamesForView(
	league: League,
	rawGames: RawSyncableGame[] | null | undefined,
): Promise<boolean> {
	const games = toSyncableGames(rawGames);
	if (games.length === 0) return false;

	await syncGamesForView({
		data: {
			league,
			games,
		},
	});
	return true;
}

interface UseLiveScoreSyncOptions {
	league: League;
	rawGames: RawSyncableGame[] | null | undefined;
	refetch: () => Promise<unknown>;
	enabled?: boolean;
}

export function useLiveScoreSync({
	league,
	rawGames,
	refetch,
	enabled = true,
}: UseLiveScoreSyncOptions) {
	const rawGamesRef = useRef(rawGames);
	const refetchRef = useRef(refetch);

	useEffect(() => {
		rawGamesRef.current = rawGames;
	}, [rawGames]);

	useEffect(() => {
		refetchRef.current = refetch;
	}, [refetch]);

	useEffect(() => {
		if (!enabled) return;

		const syncNow = async () => {
			if (document.visibilityState !== "visible") return;

			const didSync = await syncLeagueGamesForView(league, rawGamesRef.current);
			if (!didSync) return;

			await refetchRef.current();
		};

		void syncNow();

		const intervalId = window.setInterval(() => {
			void syncNow();
		}, LIVE_SCORE_REFRESH_INTERVAL_MS);

		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void syncNow();
			}
		};

		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [league, enabled]);
}

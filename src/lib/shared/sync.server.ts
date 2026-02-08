import { createServerFn } from "@tanstack/react-start";
import { ConvexHttpClient } from "convex/browser";
import { api } from "~api";
import type { League } from "./league";

function getConvexUrl(): string {
	const url = process.env.VITE_CONVEX_URL;
	if (!url) throw new Error("VITE_CONVEX_URL not configured");
	return url;
}

function getGameEventQuery(league: League) {
	switch (league) {
		case "nba":
			return api.nba.queries.getGameEvent;
		case "wnba":
			return api.wnba.queries.getGameEvent;
		case "gleague":
			return api.gleague.queries.getGameEvent;
		default:
			throw new Error(`Unknown league: ${league}`);
	}
}

function getRequestSyncAction(league: League) {
	switch (league) {
		case "nba":
			return api.nba.actions.requestGameSync;
		case "wnba":
			return api.wnba.actions.requestGameSync;
		case "gleague":
			return api.gleague.actions.requestGameSync;
		default:
			throw new Error(`Unknown league: ${league}`);
	}
}

/**
 * Trigger an ESPN→Convex sync for a live game.
 * Called from route loaders to ensure freshest data on page load.
 * The Convex action has a 15-second throttle to prevent over-fetching.
 */
export const syncLiveGame = createServerFn({ method: "GET" })
	.inputValidator((d: { espnGameId: string; league: League }) => d)
	.handler(async ({ data }: { data: { espnGameId: string; league: League } }) => {
		const httpClient = new ConvexHttpClient(getConvexUrl());

		try {
			const game = await httpClient.query(getGameEventQuery(data.league), {
				espnGameId: data.espnGameId,
			});

			if (game?.lastFetchedAt && Date.now() - game.lastFetchedAt < 15_000) {
				return; // Data is fresh enough
			}

			await httpClient.action(getRequestSyncAction(data.league), {
				espnGameId: data.espnGameId,
			});
		} catch (error) {
			// Don't fail the page load if sync fails
			console.error(`[${data.league.toUpperCase()}] Live sync failed for ${data.espnGameId}:`, error);
		}
	});

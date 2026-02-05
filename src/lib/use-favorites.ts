import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "~api";
import { useMemo, useCallback, useState, useRef } from "react";
import type { League } from "@/lib/shared/league";

export interface FavoriteTeam {
	_id: string;
	userId: string;
	league: League;
	teamId: string;
	teamSlug: string;
	addedAt: number;
}

type OptimisticChange = {
	league: League;
	teamId: string;
	teamSlug: string;
	action: "add" | "remove";
};

export function useFavorites() {
	const { data: serverFavorites = [], isLoading } = useQuery(
		convexQuery(api.favorites.getUserFavorites, {}),
	);

	const toggleMutation = useConvexMutation(api.favorites.toggleFavorite);

	// Track optimistic changes locally
	const [optimisticChanges, setOptimisticChanges] = useState<
		Map<string, OptimisticChange>
	>(new Map());
	const pendingMutationsRef = useRef(0);

	// Build the effective favorites list by applying optimistic changes
	const favorites = useMemo(() => {
		const result: FavoriteTeam[] = [];
		const serverSet = new Set<string>();

		// First, add all server favorites that haven't been optimistically removed
		for (const fav of serverFavorites) {
			const key = `${fav.league}:${fav.teamId}`;
			serverSet.add(key);
			const change = optimisticChanges.get(key);
			if (!change || change.action !== "remove") {
				result.push(fav);
			}
		}

		// Then add optimistic additions that aren't already in server data
		for (const [key, change] of optimisticChanges) {
			if (change.action === "add" && !serverSet.has(key)) {
				result.push({
					_id: `optimistic-${key}`,
					userId: "",
					league: change.league,
					teamId: change.teamId,
					teamSlug: change.teamSlug,
					addedAt: Date.now(),
				});
			}
		}

		return result;
	}, [serverFavorites, optimisticChanges]);

	// Build lookup Set for O(1) checks
	const favoritesSet = useMemo(() => {
		const set = new Set<string>();
		for (const fav of favorites) {
			set.add(`${fav.league}:${fav.teamId}`);
		}
		return set;
	}, [favorites]);

	// Check if a team is favorited - O(1) lookup
	const isFavorited = useCallback(
		(league: League, teamId: string): boolean => {
			return favoritesSet.has(`${league}:${teamId}`);
		},
		[favoritesSet],
	);

	// Toggle favorite status for a team with optimistic updates
	const toggleFavorite = useCallback(
		async (league: League, teamId: string, teamSlug: string) => {
			const key = `${league}:${teamId}`;
			const currentlyFavorited = isFavorited(league, teamId);
			const newAction = currentlyFavorited ? "remove" : "add";

			// Apply optimistic update
			setOptimisticChanges((prev) => {
				const next = new Map(prev);
				next.set(key, { league, teamId, teamSlug, action: newAction });
				return next;
			});

			pendingMutationsRef.current += 1;

			try {
				const result = await toggleMutation({ league, teamId, teamSlug });

				// Clear this specific optimistic change after successful mutation
				// The server data will be updated by Convex's real-time sync
				setOptimisticChanges((prev) => {
					const next = new Map(prev);
					next.delete(key);
					return next;
				});

				return result;
			} catch (error) {
				// Revert optimistic change on error
				setOptimisticChanges((prev) => {
					const next = new Map(prev);
					next.delete(key);
					return next;
				});
				throw error;
			} finally {
				pendingMutationsRef.current -= 1;
			}
		},
		[toggleMutation, isFavorited],
	);

	// Sort items by favorites (favorites first)
	const sortByFavorites = useCallback(
		<T>(items: T[], league: League, getTeamId: (item: T) => string): T[] => {
			return [...items].sort((a, b) => {
				const aFav = isFavorited(league, getTeamId(a));
				const bFav = isFavorited(league, getTeamId(b));
				if (aFav && !bFav) return -1;
				if (!aFav && bFav) return 1;
				return 0;
			});
		},
		[isFavorited],
	);

	return {
		favorites: favorites as FavoriteTeam[],
		isLoading,
		isFavorited,
		toggleFavorite,
		sortByFavorites,
		isToggling: pendingMutationsRef.current > 0,
	};
}

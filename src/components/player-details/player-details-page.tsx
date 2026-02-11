import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { leaguePlayersRoutes } from "@/lib/league-routes";
import type { League } from "@/lib/shared/league";
import { getCurrentSeason } from "@/lib/shared/season";
import {
	PlayerDetailsLayout,
	PlayerDetailsPending,
} from "@/components/player-details/player-details-layout";
import { api } from "~api";

export type DetailTab = "overview" | "splits" | "last10" | "comparison";

export interface PlayerSearchParams {
	tab?: string;
	compare?: string;
}

interface PlayerDetailsPageProps {
	league: League;
	playerId: string;
	tab?: string;
	compare?: string;
	onNavigate: (args: { id: string; tab?: string; compare?: string }) => void;
}

export { PlayerDetailsPending };

export function PlayerDetailsPage({
	league,
	playerId,
	tab,
	compare,
	onNavigate,
}: PlayerDetailsPageProps) {
	const season = getCurrentSeason();
	const queryRef = useMemo(() => {
		const queryMap = {
			nba: (api as any).nba.queries.getPlayerDetails,
			wnba: (api as any).wnba.queries.getPlayerDetails,
			gleague: (api as any).gleague.queries.getPlayerDetails,
		};
		return queryMap[league];
	}, [league]);

	const { data, isLoading } = useQuery(
		convexQuery(queryRef, { season, espnPlayerId: playerId }),
	);

	const player = data?.player;
	const allPlayers = data?.allPlayers ?? [];
	const teammates = useMemo(() => {
		if (!player) return [];
		const allById = new Map(allPlayers.map((entry: any) => [entry.id, entry]));
		return player.teammateIds
			.map((teammateId: string) => allById.get(teammateId))
			.filter(Boolean);
	}, [allPlayers, player]);

	const [activeTab, setActiveTab] = useState<DetailTab>(
		(tab as DetailTab) || "overview",
	);
	const [compareId, setCompareId] = useState(compare ?? "");
	const [isLoadingCompare, setIsLoadingCompare] = useState(false);
	const [loadedCompareId, setLoadedCompareId] = useState(compare ?? "");

	useEffect(() => {
		setActiveTab((tab as DetailTab) || "overview");
	}, [tab]);

	useEffect(() => {
		setCompareId(compare ?? "");
		setLoadedCompareId(compare ?? "");
	}, [compare]);

	useEffect(() => {
		if (!compareId || !player || compareId === player.id) {
			setLoadedCompareId("");
			setIsLoadingCompare(false);
			return;
		}
		setIsLoadingCompare(true);
		const timer = window.setTimeout(() => {
			setLoadedCompareId(compareId);
			setIsLoadingCompare(false);
		}, 500);
		return () => window.clearTimeout(timer);
	}, [compareId, player]);

	if (isLoading) {
		return <PlayerDetailsPending />;
	}

	if (!player) {
		return (
			<div className="container py-12">
				<h1 className="text-2xl font-bold">Player not found</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					We could not find this player id. Return to the player rankings page.
				</p>
				<Link
					to={leaguePlayersRoutes[league]}
					className="mt-4 inline-flex text-orange-600 hover:underline dark:text-orange-400"
				>
					Back to players
				</Link>
			</div>
		);
	}

	const comparedPlayer = loadedCompareId
		? allPlayers.find((entry: any) => entry.id === loadedCompareId)
		: undefined;

	const handleTabChange = (nextTab: string) => {
		const parsedTab = nextTab as DetailTab;
		setActiveTab(parsedTab);
		onNavigate({
			id: player.id,
			tab: parsedTab,
			compare: compareId || undefined,
		});
	};

	const handleCompareChange = (nextPlayerId: string) => {
		setCompareId(nextPlayerId);
		onNavigate({
			id: player.id,
			tab: activeTab,
			compare: nextPlayerId || undefined,
		});
	};

	const handleCompareTeammate = (teammateId: string) => {
		setActiveTab("comparison");
		setCompareId(teammateId);
		onNavigate({
			id: player.id,
			tab: "comparison",
			compare: teammateId,
		});
	};

	return (
		<PlayerDetailsLayout
			player={player}
			teammates={teammates}
			allPlayers={allPlayers}
			league={league}
			activeTab={activeTab}
			onTabChange={handleTabChange}
			compareId={compareId}
			onCompareChange={handleCompareChange}
			isLoadingCompare={isLoadingCompare}
			comparedPlayer={comparedPlayer}
			onCompareTeammate={handleCompareTeammate}
		/>
	);
}

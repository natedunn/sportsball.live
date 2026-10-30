import { useEffect, useState } from "react";
import { OverviewTab } from "./overview-tab";
import { SplitsTab } from "./splits-tab";
import { Last10Tab } from "./last10-tab";
import { ComparisonTab } from "./comparison-tab";
import { usePlayerDetails } from "./player-details-layout";

// Player tab pages. Each league's player child routes render these; the data
// comes from the player layout route.

export function PlayerOverviewPage() {
	const { player, teammates, league } = usePlayerDetails();
	return <OverviewTab player={player} teammates={teammates} league={league} />;
}

export function PlayerSplitsPage() {
	const { player } = usePlayerDetails();
	return <SplitsTab splits={player.splits} />;
}

export function PlayerLast10Page() {
	const { player } = usePlayerDetails();
	return <Last10Tab games={player.lastTen} />;
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

export function PlayerComparePage({
	compare,
	onCompareChange,
}: PlayerComparePageProps) {
	const { player, allPlayers } = usePlayerDetails();
	const compareId = compare ?? "";
	const [loadedCompareId, setLoadedCompareId] = useState(compareId);

	// Brief loading state when the comparison changes
	useEffect(() => {
		if (!compareId || compareId === player.id) {
			setLoadedCompareId("");
			return;
		}
		const timer = window.setTimeout(() => setLoadedCompareId(compareId), 500);
		return () => window.clearTimeout(timer);
	}, [compareId, player.id]);

	const isLoadingCompare =
		!!compareId && compareId !== player.id && loadedCompareId !== compareId;
	const comparedPlayer = loadedCompareId
		? allPlayers.find((entry) => entry.id === loadedCompareId)
		: undefined;

	return (
		<ComparisonTab
			player={player}
			allPlayers={allPlayers}
			compareId={compareId}
			onCompareChange={onCompareChange}
			isLoading={isLoadingCompare}
			comparedPlayer={comparedPlayer}
		/>
	);
}

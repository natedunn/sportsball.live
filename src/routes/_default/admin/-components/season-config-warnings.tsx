import { convexQuery, useConvexAction } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "~api";
import { Button } from "@/components/ui/button";
import { getSeasonSyncProblem } from "@/lib/season-sync";

type League = "nba" | "wnba" | "gleague";
export type SeasonConfigStatus = FunctionReturnType<typeof api.seasons.getConfigStatus>[number];
export type SeasonConfigWarning = NonNullable<SeasonConfigStatus["warning"]>;

const LEAGUE_LABELS: Record<League, string> = {
	nba: "NBA",
	wnba: "WNBA",
	gleague: "G-League",
};

/** Plain-language description of what's missing from a league's season schedule. */
export function describeSeasonConfigWarning(league: League, warning: SeasonConfigWarning) {
	const label = LEAGUE_LABELS[league];
	const lastEnded = warning.lastConfiguredEndDate
		? ` Last configured season ended ${warning.lastConfiguredEndDate}.`
		: "";

	if (warning.reason === "missing-current-season") {
		return `${label} ${warning.currentSeason} isn't in the season schedule.${lastEnded}`;
	}
	if (!warning.lastConfiguredEndDate) {
		return `${label} has no season schedule configured.`;
	}
	return `${label}'s season schedule has run out and no later season is configured.${lastEnded}`;
}

export function useSeasonConfigWarnings() {
	const { data } = useQuery(convexQuery(api.seasons.getConfigStatus, {}));
	return (data ?? []).filter(
		(status): status is SeasonConfigStatus & { warning: SeasonConfigWarning } =>
			status.warning !== null,
	);
}

export function SeasonConfigWarningBanner({
	league,
	warning,
	action,
}: {
	league: League;
	warning: SeasonConfigWarning;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
			<div className="flex items-start gap-3">
				<AlertTriangle className="mt-0.5 size-4 shrink-0" />
				<div className="text-sm">
					<p className="font-medium">{describeSeasonConfigWarning(league, warning)}</p>
					<p className="mt-0.5 text-amber-800/80 dark:text-amber-200/70">
						Season dates fall back to defaults until it's added.
					</p>
				</div>
			</div>
			{action}
		</div>
	);
}

export function useSeasonSyncStatus(league: League) {
	const { data } = useQuery(convexQuery(api.seasonSync.getStatus, {}));
	const status = data?.leagues.find((row) => row.league === league);
	if (!data || !status) return null;
	return { ...status, problem: getSeasonSyncProblem(status, data.staleAfterMs) };
}

/** Leagues whose ESPN season sync failed or has fallen behind. */
export function useSeasonSyncProblems() {
	const { data } = useQuery(convexQuery(api.seasonSync.getStatus, {}));
	return (data?.leagues ?? []).flatMap((status) => {
		const problem = getSeasonSyncProblem(status, data!.staleAfterMs);
		return problem ? [{ league: status.league, problem }] : [];
	});
}

function SeasonSyncAlert({ message, action }: { message: string; action?: ReactNode }) {
	return (
		<div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
			<div className="flex items-start gap-3">
				<AlertTriangle className="mt-0.5 size-4 shrink-0" />
				<p className="text-sm font-medium">{message}</p>
			</div>
			{action}
		</div>
	);
}

/** When the league's season dates were last fetched from ESPN, with a manual refresh. */
export function SeasonSyncBar({ league }: { league: League }) {
	const status = useSeasonSyncStatus(league);
	const refreshNow = useConvexAction(api.seasonSync.refreshNow);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [refreshError, setRefreshError] = useState<string | null>(null);

	const handleRefresh = async () => {
		setIsRefreshing(true);
		setRefreshError(null);
		try {
			const [result] = await refreshNow({ league });
			if (result && !result.ok) setRefreshError(result.error ?? "Refresh failed");
		} catch (err) {
			setRefreshError(err instanceof Error ? err.message : "Refresh failed");
		} finally {
			setIsRefreshing(false);
		}
	};

	const refreshButton = (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className="shrink-0"
			onClick={handleRefresh}
			disabled={isRefreshing}
		>
			<RefreshCw className={isRefreshing ? "animate-spin" : undefined} />
			{isRefreshing ? "Refreshing..." : "Refresh now"}
		</Button>
	);

	if (!status) return null;
	// A failed refresh reports its own error; the stored status catches up on the next render
	const problem = refreshError ? `Refresh failed: ${refreshError}` : status.problem;

	if (problem) return <SeasonSyncAlert message={problem} action={refreshButton} />;

	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2">
			<p className="text-sm text-muted-foreground">
				Dates sync from ESPN daily. Last fetched{" "}
				{status.lastSuccessAt !== null &&
					formatDistanceToNow(status.lastSuccessAt, { addSuffix: true })}
				.
			</p>
			{refreshButton}
		</div>
	);
}

/**
 * Warnings for every league with an out-of-date season schedule or a stale
 * ESPN season sync, linking to the editor.
 */
export function SeasonConfigWarnings() {
	const warnings = useSeasonConfigWarnings();
	const syncProblems = useSeasonSyncProblems();
	if (warnings.length === 0 && syncProblems.length === 0) return null;

	return (
		<div className="space-y-2">
			{syncProblems.map(({ league, problem }) => (
				<SeasonSyncAlert
					key={`sync-${league}`}
					message={`${LEAGUE_LABELS[league]}: ${problem}`}
					action={<SchedulesLink league={league} />}
				/>
			))}
			{warnings.map((status) => (
				<SeasonConfigWarningBanner
					key={status.league}
					league={status.league}
					warning={status.warning}
					action={<SchedulesLink league={status.league} />}
				/>
			))}
		</div>
	);
}

function SchedulesLink({ league }: { league: League }) {
	return (
		<Link
			to="/admin/schedules"
			search={{ league }}
			className="inline-flex h-8 shrink-0 items-center rounded-md border border-amber-300 bg-background px-3 text-sm font-medium text-foreground hover:bg-accent dark:border-amber-900/60"
		>
			Open season schedules
		</Link>
	);
}

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "~api";

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

/** Warnings for every league with an out-of-date season schedule, linking to the editor. */
export function SeasonConfigWarnings() {
	const warnings = useSeasonConfigWarnings();
	if (warnings.length === 0) return null;

	return (
		<div className="space-y-2">
			{warnings.map((status) => (
				<SeasonConfigWarningBanner
					key={status.league}
					league={status.league}
					warning={status.warning}
					action={
						<Link
							to="/admin/schedules"
							search={{ league: status.league }}
							className="inline-flex h-8 shrink-0 items-center rounded-md border border-amber-300 bg-background px-3 text-sm font-medium text-foreground hover:bg-accent dark:border-amber-900/60"
						>
							Open season schedules
						</Link>
					}
				/>
			))}
		</div>
	);
}

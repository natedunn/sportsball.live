import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import type { League } from "@/lib/shared/league";

/** Cookie holding the standings page last viewed, shared by every league. */
export const STANDINGS_VIEW_COOKIE = "standings-view";

/** The standings pages: `/{league}/standings/{view}`. */
export const STANDINGS_VIEWS = ["west", "east", "league"] as const;
export type StandingsView = (typeof STANDINGS_VIEWS)[number];

/** Where `/{league}/standings` goes when no view is saved. */
export const DEFAULT_STANDINGS_VIEW: Record<League, StandingsView> = {
	nba: "east",
	wnba: "league",
	gleague: "east",
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isStandingsView(value: unknown): value is StandingsView {
	return STANDINGS_VIEWS.includes(value as StandingsView);
}

/**
 * The standings page last viewed in any league, or undefined. Read from the
 * cookie on the server too, so `/{league}/standings` redirects the same way
 * on a first load as on a click.
 */
export const getStoredStandingsView = createIsomorphicFn()
	.server((): StandingsView | undefined => {
		const value = getCookie(STANDINGS_VIEW_COOKIE);
		return isStandingsView(value) ? value : undefined;
	})
	.client((): StandingsView | undefined => {
		const value = document.cookie
			.split("; ")
			.find((part) => part.startsWith(`${STANDINGS_VIEW_COOKIE}=`))
			?.slice(STANDINGS_VIEW_COOKIE.length + 1);
		return isStandingsView(value) ? value : undefined;
	});

export function storeStandingsView(view: StandingsView) {
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${STANDINGS_VIEW_COOKIE}=${view}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

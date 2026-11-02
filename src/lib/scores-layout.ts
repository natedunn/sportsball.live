import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

/** Cookie holding the scores layout last picked, shared by every league. */
export const SCORES_LAYOUT_COOKIE = "scores-layout";

/**
 * How the scores pages lay out games:
 * - `list`: one card per game, one column
 * - `grid`: one card per game, two columns
 * Below `md` every layout is one column.
 */
export const SCORES_LAYOUTS = ["list", "grid"] as const;
export type ScoresLayout = (typeof SCORES_LAYOUTS)[number];

export const DEFAULT_SCORES_LAYOUT: ScoresLayout = "list";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isScoresLayout(value: unknown): value is ScoresLayout {
	return SCORES_LAYOUTS.includes(value as ScoresLayout);
}

/**
 * The scores layout last picked, or the default. Read from the cookie on the
 * server too, so the first load renders the same layout as the client.
 */
export const getStoredScoresLayout = createIsomorphicFn()
	.server((): ScoresLayout => {
		const value = getCookie(SCORES_LAYOUT_COOKIE);
		return isScoresLayout(value) ? value : DEFAULT_SCORES_LAYOUT;
	})
	.client((): ScoresLayout => {
		const value = document.cookie
			.split("; ")
			.find((part) => part.startsWith(`${SCORES_LAYOUT_COOKIE}=`))
			?.slice(SCORES_LAYOUT_COOKIE.length + 1);
		return isScoresLayout(value) ? value : DEFAULT_SCORES_LAYOUT;
	});

export function storeScoresLayout(layout: ScoresLayout) {
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${SCORES_LAYOUT_COOKIE}=${layout}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

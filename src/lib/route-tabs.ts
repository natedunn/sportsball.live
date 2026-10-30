import { redirect, useRouterState } from "@tanstack/react-router";

/**
 * Helpers for detail pages whose tabs are child routes, e.g.
 * `/nba/team/$teamId` (first tab, the index route) and `/nba/team/$teamId/roster`.
 * The first tab in a list is always the index route.
 */

/** Route path for a tab: the base path for the first tab, `base/tab` for the rest */
export function tabRoute<T extends string>(
	basePath: string,
	tabs: readonly T[],
	tab: T,
): string {
	return tab === tabs[0] ? basePath : `${basePath}/${tab}`;
}

/** The tab whose child route is showing, read from the last URL segment */
export function useRouteTab<T extends string>(tabs: readonly T[]): T {
	const segment = useRouterState({
		select: (state) =>
			state.location.pathname.replace(/\/+$/, "").split("/").pop() ?? "",
	});
	return tabs.find((tab) => tab === segment) ?? tabs[0];
}

/**
 * Tabs used to be a `?tab=` search param. Redirect those links to the child
 * route, keeping any other search params. Call from a layout route's
 * `beforeLoad`. `legacyTabs` maps old `?tab=` values whose names changed.
 */
export function redirectLegacyTab<T extends string>({
	search,
	basePath,
	params,
	tabs,
	legacyTabs,
}: {
	search: Record<string, unknown>;
	basePath: string;
	params: Record<string, string>;
	tabs: readonly T[];
	legacyTabs?: Record<string, T>;
}) {
	const legacy = search.tab;
	if (typeof legacy !== "string") return;
	const tab =
		legacyTabs?.[legacy] ?? tabs.find((t) => t === legacy) ?? tabs[0];
	const { tab: _legacy, ...rest } = search;
	throw redirect({
		to: tabRoute(basePath, tabs, tab),
		params,
		search: rest,
		statusCode: 301,
	});
}

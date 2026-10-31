import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { getTeamStaticData, leagueLabels } from "@/lib/teams";
import type { League } from "@/lib/shared/league";
import {
	formatGameDate,
	formatShortGameDate,
	gameStageLabel,
	type GameMeta,
} from "@/lib/og/game-meta";

export const SITE_NAME = "Sportsball";
export const SITE_TITLE = import.meta.env.DEV ? "🚧 Sportsball" : "Sportsball";
export const SITE_DESCRIPTION =
	"Live scores, standings and stats for the NBA, WNBA and G League.";

/**
 * The origin the page was served from. Social cards need absolute image URLs,
 * and previews run on <branch>.preview.sportsball.live, so this comes from the
 * request rather than a fixed domain. Locally Portless proxies the request, so
 * only there the forwarded host counts.
 */
export const getSiteOrigin = createIsomorphicFn()
	.server(
		() =>
			getRequestUrl({
				xForwardedHost: import.meta.env.DEV,
				xForwardedProto: import.meta.env.DEV,
			}).origin,
	)
	.client(() => window.location.origin);

interface SeoOptions {
	/** Page title, without the site name */
	title?: string;
	description?: string;
	/** Path of the social image, e.g. `/api/og/nba/team/bos` */
	image?: string;
}

/** Title, description and Open Graph / Twitter card tags for a route's `head` */
export function seo({ title, description = SITE_DESCRIPTION, image }: SeoOptions) {
	const fullTitle = title ? `${title} · ${SITE_TITLE}` : SITE_TITLE;
	const socialTitle = title ?? SITE_NAME;
	const meta: Array<Record<string, string>> = [
		{ title: fullTitle },
		{ name: "description", content: description },
		{ property: "og:site_name", content: SITE_NAME },
		{ property: "og:type", content: "website" },
		{ property: "og:title", content: socialTitle },
		{ property: "og:description", content: description },
		{ name: "twitter:title", content: socialTitle },
		{ name: "twitter:description", content: description },
	];
	if (image) {
		const imageUrl = `${getSiteOrigin()}${image}`;
		meta.push(
			{ property: "og:image", content: imageUrl },
			{ property: "og:image:width", content: "1200" },
			{ property: "og:image:height", content: "630" },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:image", content: imageUrl },
		);
	}
	return meta;
}

// ============================================================
// Per-page tags
// ============================================================

// Descriptions say what a page has rather than current numbers: chat apps
// keep a link's preview for weeks.

/** `season` is the current season's name, e.g. "2026-27", when the loader had it */
export function teamSeo(league: League, teamSlug: string, season?: string) {
	const team = getTeamStaticData(league, teamSlug);
	if (!team) return seo({});
	const seasonText = season ? ` for the ${season} ${leagueLabels[league]} season` : "";
	return seo({
		title: team.fullName,
		description: `${team.fullName} schedule, roster, stats, trends and injuries${seasonText}.`,
		image: `/api/og/${league}/team/${team.api.slug}`,
	});
}

const CONFERENCE_NAMES: Record<string, string> = {
	eastern: "Eastern Conference",
	western: "Western Conference",
};

export function standingsSeo(league: League, conference?: string) {
	const conferenceName = conference ? CONFERENCE_NAMES[conference] : undefined;
	const name = [leagueLabels[league], conferenceName].filter(Boolean).join(" ");
	return seo({
		title: `${name} Standings`,
		description: `${name} standings: records, games back, home and away, last 10 and streaks.`,
		image: `/api/og/${league}/standings${conferenceName ? `?conference=${conference}` : ""}`,
	});
}

/** `meta` is undefined when the loader didn't find the game */
export function gameSeo(league: League, gameId: string, meta?: GameMeta) {
	const away = meta && getTeamStaticData(league, meta.awayTeamId);
	const home = meta && getTeamStaticData(league, meta.homeTeamId);
	if (!meta || !away || !home) return seo({ title: `${leagueLabels[league]} Game` });
	const stage = gameStageLabel(league, meta.seasonType);
	const when = [formatGameDate(meta.scheduledStart), meta.venue && `at ${meta.venue}`]
		.filter(Boolean)
		.join(" ");
	return seo({
		title: `${away.name} at ${home.name} · ${formatShortGameDate(meta.scheduledStart)}`,
		description: `${away.fullName} at ${home.fullName}, ${when}${stage ? ` (${leagueLabels[league]} ${stage})` : ""}: box score, team stats and matchups.`,
		image: `/api/og/${league}/game/${gameId}`,
	});
}

import type { League } from "./league";

export interface LeagueSection {
	label: string;
	/** Path after the league prefix: "" for the overview, "/scores" etc. */
	path: string;
}

export const LEAGUES: { league: League; label: string }[] = [
	{ league: "nba", label: "NBA" },
	{ league: "wnba", label: "WNBA" },
	{ league: "gleague", label: "G League" },
];

const overview: LeagueSection = { label: "Overview", path: "" };
const scores: LeagueSection = { label: "Scores", path: "/scores" };
const standings: LeagueSection = { label: "Standings", path: "/standings" };
const players: LeagueSection = { label: "Players", path: "/players" };
const playoffs: LeagueSection = { label: "Playoffs", path: "/playoffs" };

/** The sections each league's nav shows, in order. */
export const LEAGUE_SECTIONS: Record<League, LeagueSection[]> = {
	nba: [overview, scores, standings, playoffs, players],
	wnba: [overview, scores, standings, players],
	gleague: [overview, scores, standings, players],
};

const leaguePathPattern = /^\/(nba|wnba|gleague)(\/.*)?$/;

function parseLeaguePath(pathname: string) {
	const match = leaguePathPattern.exec(pathname.replace(/\/+$/, ""));
	if (!match) return null;
	return { league: match[1] as League, rest: match[2] ?? "" };
}

export function getLeagueFromPathname(pathname: string): League | null {
	return parseLeaguePath(pathname)?.league ?? null;
}

/**
 * The section the pathname is on, including its sub-pages (`/nba/standings/west`),
 * or null on team, game and player pages.
 */
export function getActiveSection(pathname: string): LeagueSection | null {
	const parsed = parseLeaguePath(pathname);
	if (!parsed) return null;
	return (
		LEAGUE_SECTIONS[parsed.league].find(
			(s) =>
				s.path === parsed.rest ||
				(s.path !== "" && parsed.rest.startsWith(`${s.path}/`)),
		) ?? null
	);
}

/**
 * Where switching to `target` should go from `pathname`: the same section when
 * the target league has it, otherwise the target league's overview. Sub-pages
 * land on the section (standings then opens the page last viewed). Team, game
 * and player IDs belong to one league, so those pages also land on the overview.
 */
export function switchLeagueHref(pathname: string, target: League): string {
	const section = getActiveSection(pathname);
	if (section && LEAGUE_SECTIONS[target].some((s) => s.path === section.path)) {
		return `/${target}${section.path}`;
	}
	return `/${target}`;
}

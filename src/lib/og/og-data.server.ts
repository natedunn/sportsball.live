import { ConvexHttpClient } from "convex/browser";
import { api } from "~api";
import { getTeamStaticData, leagueLabels } from "@/lib/teams";
import type { League } from "@/lib/shared/league";
import { NBA_TEAM_LOGOS } from "@/lib/nba/team-logos";
import { WNBA_TEAM_LOGOS } from "@/lib/wnba/team-logos";
import { GLEAGUE_TEAM_LOGOS } from "@/lib/gleague/team-logos";
import type { GameCardData, GameCardTeam, StandingsCardData, TeamCardData } from "./og-cards";
import {
	formatGameDate,
	formatGameTime,
	gameStageLabel,
	toGameMeta,
} from "./game-meta";

// Data for the social cards, read straight from Convex: the cards are
// rendered in API routes, outside the router and its query cache.

const LEAGUES = new Set<string>(["nba", "wnba", "gleague"]);

export function isLeague(value: string): value is League {
	return LEAGUES.has(value);
}

function convex() {
	// Baked in at build, like the client's.
	const url = import.meta.env.VITE_CONVEX_URL;
	if (!url) throw new Error("VITE_CONVEX_URL not configured");
	return new ConvexHttpClient(url);
}

const TEAM_LOGOS: Record<League, Record<string, string>> = {
	nba: NBA_TEAM_LOGOS,
	wnba: WNBA_TEAM_LOGOS,
	gleague: GLEAGUE_TEAM_LOGOS,
};

/** ESPN's resizer, so a card doesn't pull in dozens of 500px logos */
function logoUrl(league: League, logoSlug: string, size: number) {
	const source = TEAM_LOGOS[league][logoSlug];
	if (!source) return undefined;
	const path = new URL(source).pathname;
	return `https://a.espncdn.com/combiner/i?img=${path}&w=${size}&h=${size}`;
}

function getStandingsQuery(league: League) {
	switch (league) {
		case "nba":
			return api.nba.queries.getStandings;
		case "wnba":
			return api.wnba.queries.getStandings;
		case "gleague":
			return api.gleague.queries.getStandings;
	}
}

function getGameDetailsQuery(league: League) {
	switch (league) {
		case "nba":
			return api.nba.queries.getGameDetails;
		case "wnba":
			return api.wnba.queries.getGameDetails;
		case "gleague":
			return api.gleague.queries.getGameDetails;
	}
}

export async function getTeamCardData(
	league: League,
	teamSlug: string,
): Promise<TeamCardData | null> {
	const staticData = getTeamStaticData(league, teamSlug);
	if (!staticData) return null;
	const logo = logoUrl(league, staticData.logoSlug, 480);
	if (!logo) return null;

	const season = await convex().query(api.seasons.getCurrentName, { league });
	return {
		leagueLabel: leagueLabels[league],
		season: season ?? undefined,
		city: staticData.city,
		name: staticData.name,
		logoUrl: logo,
		color: staticData.colors.display.dark,
	};
}

const CONFERENCES = {
	eastern: "Eastern Conference",
	western: "Western Conference",
} as const;

export type Conference = keyof typeof CONFERENCES;

export function parseConference(value: string | null): Conference | undefined {
	return value === "eastern" || value === "western" ? value : undefined;
}

/** The whole league, or one conference */
export async function getStandingsCardData(
	league: League,
	conference?: Conference,
): Promise<StandingsCardData | null> {
	const client = convex();
	const season = await client.query(api.seasons.getCurrentName, { league });
	if (!season) return null;
	const standings = await client.query(getStandingsQuery(league), { season });
	const teams = conference ? standings[conference] : [...standings.eastern, ...standings.western];

	// Alphabetical, so the wall doesn't read as a ranking. Teams the static
	// registry doesn't know yet have no logo and are left out.
	const logoUrls = teams
		.map((team) => getTeamStaticData(league, team.espnTeamId))
		.filter((team) => team !== undefined)
		.sort((a, b) => a.fullName.localeCompare(b.fullName))
		.map((team) => logoUrl(league, team.logoSlug, 144))
		.filter((url) => url !== undefined);

	return {
		leagueLabel: leagueLabels[league],
		season,
		conference: conference && CONFERENCES[conference],
		logoUrls,
	};
}

function gameCardTeam(league: League, espnTeamId: string): GameCardTeam | undefined {
	const team = getTeamStaticData(league, espnTeamId);
	const logo = team && logoUrl(league, team.logoSlug, 400);
	if (!team || !logo) return undefined;
	return { city: team.city, name: team.name, logoUrl: logo, color: team.colors.display.dark };
}

/** Who and when; never the score */
export async function getGameCardData(
	league: League,
	gameId: string,
): Promise<GameCardData | null> {
	const details = await convex().query(getGameDetailsQuery(league), { espnGameId: gameId });
	const meta = toGameMeta(details);
	if (!meta) return null;
	const away = gameCardTeam(league, meta.awayTeamId);
	const home = gameCardTeam(league, meta.homeTeamId);
	if (!away || !home) return null;
	return {
		leagueLabel: leagueLabels[league],
		season: meta.season,
		stage: gameStageLabel(league, meta.seasonType),
		date: formatGameDate(meta.scheduledStart),
		time: formatGameTime(meta.scheduledStart),
		venue: meta.venue,
		away,
		home,
	};
}

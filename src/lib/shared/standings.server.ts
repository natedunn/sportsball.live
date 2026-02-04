import { createServerFn } from "@tanstack/react-start";
import type {
	StandingTeam,
	ConferenceStandings,
	StandingsResponse,
} from "@/lib/types/standings";
import type { League } from "./league";
import { getTeamColors, getProxiedLogoUrl } from "./team-utils";
import type { ApiStandingsTeamEntry, ApiStandingsGroup, ApiStandingsResponse } from "./api-types";

// Re-export types for convenience
export type { StandingTeam, ConferenceStandings, StandingsResponse };

// Standings API URLs by league
const STANDINGS_API_URLS: Record<"nba" | "wnba", string> = {
	nba: "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings",
	wnba: "https://site.api.espn.com/apis/v2/sports/basketball/wnba/standings",
};

// Shared stat extraction utilities
export function getStat(stats: ApiStandingsTeamEntry["stats"], name: string): number {
	return stats.find((s) => s.name === name)?.value ?? 0;
}

export function getStatDisplay(stats: ApiStandingsTeamEntry["stats"], name: string): string {
	return stats.find((s) => s.name === name)?.displayValue ?? "-";
}

interface MappedTeamWithSeed extends StandingTeam {
	playoffSeed: number;
}

// Map API team entry to standing team (shared between NBA and WNBA)
function mapTeamEntry(league: League, entry: ApiStandingsTeamEntry): MappedTeamWithSeed {
	const { team, stats } = entry;
	const colors = getTeamColors(league, team.uid, team.id);

	return {
		id: team.id,
		name: team.displayName ?? "Unknown",
		abbreviation: team.abbreviation ?? "???",
		logo: getProxiedLogoUrl(league, team.logos?.[0]?.href, team.id),
		darkColor: colors.darkColor,
		lightColor: colors.lightColor,
		wins: getStat(stats, "wins"),
		losses: getStat(stats, "losses"),
		winPct: getStat(stats, "winPercent"),
		gamesBack: getStat(stats, "gamesBehind"),
		streak: getStatDisplay(stats, "streak"),
		homeRecord: getStatDisplay(stats, "Home"),
		awayRecord: getStatDisplay(stats, "Road"),
		divisionRecord: getStatDisplay(stats, "vs. Div."),
		conferenceRecord: getStatDisplay(stats, "vs. Conf."),
		last10: getStatDisplay(stats, "Last Ten Games"),
		pointsFor: getStat(stats, "avgPointsFor"),
		pointsAgainst: getStat(stats, "avgPointsAgainst"),
		differential: getStat(stats, "differential"),
		playoffSeed: getStat(stats, "playoffSeed"),
	};
}

// Fetch standings using ESPN v2 API (works for NBA and WNBA)
async function fetchStandingsForLeague(league: "nba" | "wnba"): Promise<StandingsResponse> {
	const response = await fetch(STANDINGS_API_URLS[league], {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Standings API error: ${response.status}`);
	}

	const apiData = (await response.json()) as ApiStandingsResponse;
	const conferences = apiData.children ?? [];

	const eastern = conferences.find((c) =>
		c.name?.toLowerCase().includes("east"),
	);
	const western = conferences.find((c) =>
		c.name?.toLowerCase().includes("west"),
	);

	const mapConference = (
		conf: ApiStandingsGroup | undefined,
		fallbackName: string,
	): ConferenceStandings => {
		const entries = conf?.standings?.entries ?? [];
		const teamsWithSeed = entries.map((entry) => mapTeamEntry(league, entry));
		// Sort by ESPN's official playoff seed (includes all tiebreakers)
		teamsWithSeed.sort((a, b) => a.playoffSeed - b.playoffSeed);
		// Remove playoffSeed from final output (not part of StandingTeam type)
		const teams: StandingTeam[] = teamsWithSeed.map(({ playoffSeed, ...team }) => team);
		return {
			name: conf?.name ?? fallbackName,
			teams,
		};
	};

	return {
		eastern: mapConference(eastern, "Eastern Conference"),
		western: mapConference(western, "Western Conference"),
	};
}

// League-specific server functions
export const fetchNbaStandings = createServerFn({ method: "GET" }).handler(
	async (): Promise<StandingsResponse> => {
		return fetchStandingsForLeague("nba");
	},
);

export const fetchWnbaStandings = createServerFn({ method: "GET" }).handler(
	async (): Promise<StandingsResponse> => {
		return fetchStandingsForLeague("wnba");
	},
);

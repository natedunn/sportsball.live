import { createServerFn } from "@tanstack/react-start";
import { getTeamColors, getProxiedLogoUrl } from "./team-utils.server";
import type {
	StandingTeam,
	ConferenceStandings,
	StandingsResponse,
} from "@/lib/types/standings";

export type { StandingTeam, ConferenceStandings, StandingsResponse };

interface ApiTeamEntry {
	team: {
		id: string;
		uid?: string;
		displayName?: string;
		abbreviation?: string;
		logos?: Array<{ href?: string }>;
	};
	stats: Array<{
		name: string;
		value: number;
		displayValue?: string;
	}>;
}

interface ApiStandingsGroup {
	name?: string;
	standings?: {
		entries?: ApiTeamEntry[];
	};
}

interface ApiResponse {
	children?: ApiStandingsGroup[];
}

function getStat(stats: ApiTeamEntry["stats"], name: string): number {
	return stats.find((s) => s.name === name)?.value ?? 0;
}

function getStatDisplay(stats: ApiTeamEntry["stats"], name: string): string {
	return stats.find((s) => s.name === name)?.displayValue ?? "-";
}

function mapTeamEntry(entry: ApiTeamEntry): StandingTeam {
	const { team, stats } = entry;
	const colors = getTeamColors(team.uid, team.id);

	return {
		id: team.id,
		name: team.displayName ?? "Unknown",
		abbreviation: team.abbreviation ?? "???",
		logo: getProxiedLogoUrl(team.logos?.[0]?.href, team.id),
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
		pointsFor: getStat(stats, "pointsFor"),
		pointsAgainst: getStat(stats, "pointsAgainst"),
		differential: getStat(stats, "pointDifferential"),
	};
}

export const fetchWnbaStandings = createServerFn({ method: "GET" }).handler(
	async (): Promise<StandingsResponse> => {
		const response = await fetch(
			"https://site.api.espn.com/apis/v2/sports/basketball/wnba/standings",
			{
				headers: { "Content-Type": "application/json" },
			},
		);

		if (!response.ok) {
			throw new Error(`Standings API error: ${response.status}`);
		}

		const apiData = (await response.json()) as ApiResponse;

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
			const teams = entries.map(mapTeamEntry);
			// Sort by wins descending, then by win pct
			teams.sort((a, b) => {
				if (b.wins !== a.wins) return b.wins - a.wins;
				return b.winPct - a.winPct;
			});
			return {
				name: conf?.name ?? fallbackName,
				teams,
			};
		};

		return {
			eastern: mapConference(eastern, "Eastern Conference"),
			western: mapConference(western, "Western Conference"),
		};
	},
);

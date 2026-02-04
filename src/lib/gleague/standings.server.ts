import { createServerFn } from "@tanstack/react-start";
import { getTeamColors, getProxiedLogoUrl } from "./team-utils.server";
import type {
	StandingTeam,
	ConferenceStandings,
	StandingsResponse,
} from "@/lib/types/standings";

export type { StandingTeam, ConferenceStandings, StandingsResponse };

interface ApiResultSet {
	name: string;
	headers: string[];
	rowSet: (string | number | null)[][];
}

interface ApiResponse {
	resultSets: ApiResultSet[];
}

function getCurrentSeason(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth(); // 0-indexed
	// G-League season runs roughly Nov-March
	// If we're in Jan-July, use previous year as start
	const startYear = month < 8 ? year - 1 : year;
	return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

interface MappedTeamWithRank extends StandingTeam {
	playoffRank: number;
}

function mapRowToTeam(
	headers: string[],
	row: (string | number | null)[],
): MappedTeamWithRank {
	const getValue = (name: string): string | number | null => {
		const index = headers.indexOf(name);
		return index >= 0 ? row[index] : null;
	};

	const teamId = String(getValue("TeamID") ?? "");
	const colors = getTeamColors(undefined, teamId);

	return {
		id: teamId,
		name: `${getValue("TeamCity") ?? ""} ${getValue("TeamName") ?? ""}`.trim(),
		abbreviation: String(getValue("TeamSlug") ?? "").toUpperCase().slice(0, 3),
		logo: getProxiedLogoUrl(undefined, teamId),
		darkColor: colors.darkColor,
		lightColor: colors.lightColor,
		wins: Number(getValue("WINS") ?? 0),
		losses: Number(getValue("LOSSES") ?? 0),
		winPct: Number(getValue("WinPCT") ?? 0),
		gamesBack: Number(getValue("ConferenceGamesBack") ?? 0),
		streak: String(getValue("strCurrentStreak") ?? "-").trim(),
		homeRecord: String(getValue("HOME") ?? "-").trim(),
		awayRecord: String(getValue("ROAD") ?? "-").trim(),
		divisionRecord: "-", // G-League doesn't have divisions
		conferenceRecord: String(getValue("ConferenceRecord") ?? "-").trim(),
		last10: String(getValue("L10") ?? "-").trim(),
		pointsFor: Number(getValue("PointsPG") ?? 0),
		pointsAgainst: Number(getValue("OppPointsPG") ?? 0),
		differential: Number(getValue("DiffPointsPG") ?? 0),
		// Official playoff rank with tiebreakers
		playoffRank: Number(getValue("PlayoffRank") ?? 999),
	};
}

export const fetchGLeagueStandings = createServerFn({ method: "GET" }).handler(
	async (): Promise<StandingsResponse> => {
		const baseUrl = process.env.GLEAGUE_STATS_API;
		if (!baseUrl) {
			throw new Error("GLEAGUE_STATS_API not configured");
		}
		const season = getCurrentSeason();

		const response = await fetch(
			`${baseUrl}/leaguestandingsv3?LeagueID=20&Season=${season}&SeasonType=Regular%20Season`,
			{
				headers: {
					"Content-Type": "application/json",
					"User-Agent": "Mozilla/5.0",
					Referer: baseUrl,
				},
			},
		);

		if (!response.ok) {
			throw new Error(`G-League Standings API error: ${response.status}`);
		}

		const apiData = (await response.json()) as ApiResponse;
		const standingsResult = apiData.resultSets?.find(
			(rs) => rs.name === "Standings",
		);

		if (!standingsResult) {
			throw new Error("No standings data in API response");
		}

		const { headers, rowSet } = standingsResult;
		const conferenceIndex = headers.indexOf("Conference");

		const eastTeams: MappedTeamWithRank[] = [];
		const westTeams: MappedTeamWithRank[] = [];

		for (const row of rowSet) {
			const conference = String(row[conferenceIndex] ?? "").toLowerCase();
			const team = mapRowToTeam(headers, row);

			if (conference === "east") {
				eastTeams.push(team);
			} else if (conference === "west") {
				westTeams.push(team);
			}
		}

		// Sort by official playoff rank (includes all tiebreakers)
		const sortAndStripRank = (teams: MappedTeamWithRank[]): StandingTeam[] => {
			teams.sort((a, b) => a.playoffRank - b.playoffRank);
			return teams.map(({ playoffRank, ...team }) => team);
		};

		return {
			eastern: {
				name: "Eastern Conference",
				teams: sortAndStripRank(eastTeams),
			},
			western: {
				name: "Western Conference",
				teams: sortAndStripRank(westTeams),
			},
		};
	},
);

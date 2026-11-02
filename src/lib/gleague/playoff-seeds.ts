import { getAllTeams } from "@/lib/teams";

/** A team's playoff seed: its side of the bracket and its rank there. */
export interface PlayoffSeed {
	/** ESPN team ID, as stored on gleagueTeam */
	espnTeamId: string;
	conference: "East" | "West";
	rank: number;
}

interface StandingsResponse {
	resultSets?: { headers: string[]; rowSet: (string | number | null)[][] }[];
}

/**
 * Seeds from the stats API's `leaguestandingsv3`. The G League playoffs split
 * the league into East and West, ranked 1 to 16 (`PlayoffRank`); ESPN only
 * has the four divisions. Stats API team IDs map to ESPN's through the static
 * team data, and teams it doesn't know are left out.
 */
export function parsePlayoffSeeds(data: StandingsResponse): PlayoffSeed[] {
	const table = data.resultSets?.[0];
	if (!table) return [];
	const col = (name: string) => table.headers.indexOf(name);
	const teamIdCol = col("TeamID");
	const conferenceCol = col("Conference");
	const rankCol = col("PlayoffRank");
	if (teamIdCol < 0 || conferenceCol < 0 || rankCol < 0) return [];

	const espnIdByStatsId = new Map(
		getAllTeams("gleague").flatMap((team) =>
			team.statsApi ? [[team.statsApi.id, team.api.id] as const] : [],
		),
	);

	return table.rowSet.flatMap((row): PlayoffSeed[] => {
		const espnTeamId = espnIdByStatsId.get(String(row[teamIdCol]));
		const conference = row[conferenceCol];
		const rank = Number(row[rankCol]);
		if (!espnTeamId || !Number.isInteger(rank) || rank < 1) return [];
		if (conference !== "East" && conference !== "West") return [];
		return [{ espnTeamId, conference, rank }];
	});
}

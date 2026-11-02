import type { StandingsResponse, StandingTeam } from "@/lib/types/standings";

function pct(team: StandingTeam): number {
	const games = team.wins + team.losses;
	return games > 0 ? team.wins / games : 0;
}

/**
 * Both conferences in one list. Ordered by ESPN's league-wide seed when every
 * team has one (WNBA, tiebreakers included), otherwise best record first.
 * Games back is recomputed against the league leader, since the stored value
 * is per conference.
 */
export function combineStandings(standings: StandingsResponse): StandingTeam[] {
	const all = [...standings.eastern.teams, ...standings.western.teams];
	const seeded = all.length > 0 && all.every((team) => team.leagueRank !== undefined);
	const teams = all.sort((a, b) =>
		seeded
			? a.leagueRank! - b.leagueRank!
			: pct(b) - pct(a) || b.wins - a.wins || a.losses - b.losses,
	);
	const leader = teams[0];
	if (!leader) return teams;
	return teams.map((team) => ({
		...team,
		gamesBack: (leader.wins - team.wins + (team.losses - leader.losses)) / 2,
	}));
}

/**
 * Ranks for a list sorted by win percentage, where teams with the same
 * percentage share a rank and the next one follows on (1, 2, 2, 3).
 */
export function pctRanks(teams: StandingTeam[]): number[] {
	const ranks: number[] = [];
	teams.forEach((team, index) => {
		if (index === 0) {
			ranks.push(1);
			return;
		}
		const tied = pct(teams[index - 1]) === pct(team);
		ranks.push(tied ? ranks[index - 1] : ranks[index - 1] + 1);
	});
	return ranks;
}

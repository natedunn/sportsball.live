import { createServerFn } from "@tanstack/react-start";
import { getTeamStaticData } from "@/lib/teams";
import type { League } from "./league";
import { getLeagueSiteApi, getLeagueCoreApi, getLeagueCommonApi } from "./league";
import type {
	TeamOverview,
	RosterPlayer,
	ScheduleGame,
	TeamStats,
	TeamLeader,
	InjuredPlayer,
} from "@/lib/types/team";
import type {
	ApiTeamResponse,
	ApiScheduleResponse,
	ApiStatsResponse,
	ApiRosterResponse,
} from "./team.types";

// Re-export types for convenience
export type {
	TeamOverview,
	RosterPlayer,
	ScheduleGame,
	TeamStats,
	TeamLeader,
	InjuredPlayer,
} from "@/lib/types/team";

// ============================================================================
// Helper Functions
// ============================================================================

function getProxiedLogoUrl(league: League, teamId: string): string | undefined {
	const team = getTeamStaticData(league, teamId);
	if (team) {
		return `/api/${league}/logo/${team.logoSlug}`;
	}
	return undefined;
}

function getTeamColors(
	league: League,
	teamId: string,
): { darkColor: string; lightColor: string } {
	const team = getTeamStaticData(league, teamId);
	if (team) {
		return {
			darkColor: team.colors.display.dark,
			lightColor: team.colors.display.light,
		};
	}
	return { darkColor: "000000", lightColor: "000000" };
}


// ============================================================================
// Internal Handlers
// ============================================================================

async function fetchTeamOverviewForLeague(
	league: League,
	teamSlug: string,
): Promise<TeamOverview> {
	const teamData = getTeamStaticData(league, teamSlug);
	if (!teamData) {
		throw new Error(`Team not found: ${teamSlug}`);
	}

	const teamId = teamData.api.id;
	const baseUrl = getLeagueSiteApi(league);

	const response = await fetch(`${baseUrl}/teams/${teamId}?enable=roster`, {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Team API error: ${response.status}`);
	}

	const data = (await response.json()) as ApiTeamResponse;
	const team = data.team;

	const totalRecord = team.record?.items?.find((r) => r.type === "total");
	const homeRecord = team.record?.items?.find((r) => r.type === "home");
	const awayRecord = team.record?.items?.find((r) => r.type === "road");

	const wins = totalRecord?.stats?.find((s) => s.name === "wins")?.value ?? 0;
	const losses = totalRecord?.stats?.find((s) => s.name === "losses")?.value ?? 0;
	const winPct = totalRecord?.stats?.find((s) => s.name === "winPercent")?.value ?? 0;
	const streak = totalRecord?.stats?.find((s) => s.name === "streak")?.displayValue;

	const standingParts = team.standingSummary?.match(/(\d+)\w* in (\w+)/);
	const conferenceRank = standingParts ? parseInt(standingParts[1], 10) : undefined;
	const conference = standingParts ? standingParts[2] : undefined;

	const colors = getTeamColors(league, teamId);

	return {
		id: team.id,
		name: team.displayName,
		abbreviation: team.abbreviation,
		location: team.location,
		logo: getProxiedLogoUrl(league, teamId),
		darkColor: colors.darkColor,
		lightColor: colors.lightColor,
		record: {
			wins,
			losses,
			winPct,
			streak,
			home: homeRecord?.summary,
			away: awayRecord?.summary,
		},
		standings: {
			conferenceRank,
			conference,
			divisionRank: undefined,
			division: undefined,
		},
		stats: {
			ppg: 0,
			oppPpg: 0,
			ortg: 0,
			drtg: 0,
			netRtg: 0,
		},
		ranks: undefined,
	};
}

async function fetchTeamRosterForLeague(
	league: League,
	teamSlug: string,
): Promise<RosterPlayer[]> {
	const teamData = getTeamStaticData(league, teamSlug);
	if (!teamData) {
		throw new Error(`Team not found: ${teamSlug}`);
	}

	const teamId = teamData.api.id;
	const commonBase = getLeagueCommonApi(league);

	const response = await fetch(`${commonBase}/teams/${teamId}/roster`, {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Team roster API error: ${response.status}`);
	}

	const data = (await response.json()) as ApiRosterResponse;

	const allGroup = data.positionGroups?.find((g) => g.type === "all");
	const athletes = allGroup?.athletes ?? data.positionGroups?.[0]?.athletes ?? [];

	return athletes.map((athlete): RosterPlayer => {
		// Check both status and injuries array for injury info
		const hasInjuryStatus = athlete.status?.type === "injury" || athlete.status?.name === "Injured";
		const hasInjuryArray = (athlete.injuries?.length ?? 0) > 0;
		const isInjured = hasInjuryStatus || hasInjuryArray;

		// Get injury status from either source
		let injuryStatus: string | undefined;
		let injuryDescription: string | undefined;
		if (hasInjuryArray && athlete.injuries?.[0]) {
			const injury = athlete.injuries[0];
			injuryStatus = injury.status;
			injuryDescription = injury.details?.detail || injury.type?.description;
		} else if (hasInjuryStatus) {
			injuryStatus = athlete.status?.name;
		}

		const categories = athlete.statistics?.splits?.categories ?? [];

		const getStatFromCategories = (statName: string): number => {
			for (const category of categories) {
				const stat = category.stats.find((s) => s.name === statName);
				if (stat) return stat.value;
			}
			return 0;
		};

		return {
			id: athlete.id,
			name: athlete.displayName,
			firstName: athlete.firstName,
			lastName: athlete.lastName,
			jersey: athlete.jersey ?? "",
			position: athlete.position?.abbreviation ?? "",
			height: athlete.displayHeight ?? "",
			weight: athlete.displayWeight ?? "",
			age: athlete.age,
			experience: athlete.experience?.years
				? `${athlete.experience.years} yr${athlete.experience.years > 1 ? "s" : ""}`
				: "Rookie",
			college: athlete.college?.name ?? athlete.college?.shortName,
			headshot: athlete.headshot?.href,
			injured: isInjured,
			injuryStatus: isInjured ? injuryStatus : undefined,
			injuryDescription: isInjured ? injuryDescription : undefined,
			stats: {
				gp: getStatFromCategories("gamesPlayed"),
				gs: getStatFromCategories("gamesStarted"),
				mpg: getStatFromCategories("avgMinutes"),
				ppg: getStatFromCategories("avgPoints"),
				rpg: getStatFromCategories("avgRebounds"),
				apg: getStatFromCategories("avgAssists"),
				spg: getStatFromCategories("avgSteals"),
				bpg: getStatFromCategories("avgBlocks"),
				topg: getStatFromCategories("avgTurnovers"),
				fgPct: getStatFromCategories("fieldGoalPct") / 100,
				threePct: getStatFromCategories("threePointPct") / 100,
				ftPct: getStatFromCategories("freeThrowPct") / 100,
			},
		};
	});
}

async function fetchTeamScheduleForLeague(
	league: League,
	teamSlug: string,
): Promise<ScheduleGame[]> {
	const teamData = getTeamStaticData(league, teamSlug);
	if (!teamData) {
		throw new Error(`Team not found: ${teamSlug}`);
	}

	const teamId = teamData.api.id;
	const baseUrl = getLeagueSiteApi(league);

	const response = await fetch(`${baseUrl}/teams/${teamId}/schedule`, {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Team schedule API error: ${response.status}`);
	}

	const data = (await response.json()) as ApiScheduleResponse;
	const events = data.events ?? [];

	return events.map((event): ScheduleGame => {
		const competition = event.competitions[0];
		const competitors = competition.competitors;

		const isOurTeam = (c: (typeof competitors)[0]) => {
			const competitorId = c.id;
			const nestedTeamId = c.team?.id;
			return (
				competitorId === teamId ||
				nestedTeamId === teamId ||
				String(competitorId) === String(teamId) ||
				String(nestedTeamId) === String(teamId)
			);
		};

		let teamCompetitor = competitors.find(isOurTeam);
		let opponentCompetitor = competitors.find((c) => !isOurTeam(c));

		if (!teamCompetitor || !opponentCompetitor) {
			const homeComp = competitors.find((c) => c.homeAway === "home");
			const awayComp = competitors.find((c) => c.homeAway === "away");
			if (homeComp && awayComp) {
				teamCompetitor = teamCompetitor || homeComp;
				opponentCompetitor = opponentCompetitor || awayComp;
			}
		}

		const isHome = teamCompetitor?.homeAway === "home";
		const state = competition.status.type.state;

		let result: ScheduleGame["result"] | undefined;
		if (state === "post" && teamCompetitor && opponentCompetitor) {
			const score = teamCompetitor.score?.value ?? 0;
			const opponentScore = opponentCompetitor.score?.value ?? 0;

			if (score > 0 || opponentScore > 0) {
				result = {
					isWin: teamCompetitor.winner ?? score > opponentScore,
					score,
					opponentScore,
					margin: score - opponentScore,
				};
			}
		}

		const opponentTeamId = opponentCompetitor?.team?.id || opponentCompetitor?.id || "";

		return {
			id: event.id,
			date: competition.date,
			isHome,
			opponent: {
				id: opponentTeamId,
				name: opponentCompetitor?.team?.displayName ?? opponentCompetitor?.team?.name ?? "",
				abbreviation: opponentCompetitor?.team?.abbreviation ?? "",
				logo: opponentTeamId ? getProxiedLogoUrl(league, opponentTeamId) : undefined,
			},
			result,
			state,
			statusDetail: competition.status.type.detail ?? "",
			venue: competition.venue?.fullName,
		};
	});
}

async function fetchTeamStatsForLeague(league: League, teamSlug: string): Promise<TeamStats> {
	const teamData = getTeamStaticData(league, teamSlug);
	if (!teamData) {
		throw new Error(`Team not found: ${teamSlug}`);
	}

	const teamId = teamData.api.id;
	const baseUrl = getLeagueSiteApi(league);

	const response = await fetch(`${baseUrl}/teams/${teamId}/statistics`, {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Team stats API error: ${response.status}`);
	}

	const data = (await response.json()) as ApiStatsResponse;
	const categories = data.results?.stats?.categories ?? [];
	const allStats = categories.flatMap((c) => c.stats);

	const ranks: Record<string, number> = {};

	const getStatVal = (...names: string[]): number => {
		for (const name of names) {
			const stat = allStats.find((s) => s.name === name);
			if (stat !== undefined && stat.value !== undefined) {
				if (stat.rank) {
					ranks[name] = stat.rank;
				}
				return stat.value;
			}
		}
		return 0;
	};

	const fgMade = getStatVal("avgFieldGoalsMade", "fieldGoalsMade", "FGM");
	const fgAttempted = getStatVal("avgFieldGoalsAttempted", "fieldGoalsAttempted", "FGA");
	const threeMade = getStatVal("avgThreePointFieldGoalsMade", "threePointFieldGoalsMade", "3PM");
	const threeAttempted = getStatVal(
		"avgThreePointFieldGoalsAttempted",
		"threePointFieldGoalsAttempted",
		"3PA",
	);
	const ftMade = getStatVal("avgFreeThrowsMade", "freeThrowsMade", "FTM");
	const ftAttempted = getStatVal("avgFreeThrowsAttempted", "freeThrowsAttempted", "FTA");

	const fgPct = fgAttempted > 0 ? (fgMade / fgAttempted) * 100 : 0;
	const threePct = threeAttempted > 0 ? (threeMade / threeAttempted) * 100 : 0;
	const ftPct = ftAttempted > 0 ? (ftMade / ftAttempted) * 100 : 0;
	const efgPct = fgAttempted > 0 ? ((fgMade + 0.5 * threeMade) / fgAttempted) * 100 : 0;

	const ppg = getStatVal("avgPoints", "pointsPerGame", "points", "PTS");
	const tsPct =
		fgAttempted + 0.44 * ftAttempted > 0
			? (ppg / (2 * (fgAttempted + 0.44 * ftAttempted))) * 100
			: 0;

	const apg = getStatVal("avgAssists", "assistsPerGame", "assists", "AST");
	const tovPg = getStatVal("avgTurnovers", "turnoversPerGame", "turnovers", "TOV");
	const astToRatio = tovPg > 0 ? apg / tovPg : apg;

	const oppPpg = getStatVal("avgPointsAgainst", "pointsAgainstPerGame", "opponentPointsPerGame", "OppPts");
	const pace = getStatVal("pace", "possessionsPerGame", "PACE");
	const ortg = getStatVal("offensiveRating", "offRating", "ORTG", "offensiveEfficiency");
	const drtg = getStatVal("defensiveRating", "defRating", "DRTG", "defensiveEfficiency");
	const netRtg = getStatVal("netRating", "netRtg", "NRTG");
	const calculatedNetRtg = ortg > 0 && drtg > 0 ? ortg - drtg : netRtg;

	return {
		scoring: {
			ppg,
			oppPpg,
			pace,
			ortg,
			drtg,
			netRtg: calculatedNetRtg,
		},
		shooting: {
			fgPct,
			fgMade,
			fgAttempted,
			threePct,
			threeMade,
			threeAttempted,
			ftPct,
			ftMade,
			ftAttempted,
			efgPct,
			tsPct,
		},
		rebounding: {
			rpg: getStatVal("avgRebounds", "reboundsPerGame", "rebounds", "REB"),
			orpg: getStatVal("avgOffensiveRebounds", "offensiveReboundsPerGame", "OREB"),
			drpg: getStatVal("avgDefensiveRebounds", "defensiveReboundsPerGame", "DREB"),
			orebPct: getStatVal("offensiveReboundPct", "offensiveReboundPercentage", "OREB%"),
		},
		playmaking: {
			apg,
			tovPg,
			astToRatio,
		},
		defense: {
			spg: getStatVal("avgSteals", "stealsPerGame", "steals", "STL"),
			bpg: getStatVal("avgBlocks", "blocksPerGame", "blocks", "BLK"),
			oppFgPct: getStatVal("oppFieldGoalPct", "opponentFieldGoalPct", "OppFG%"),
			oppThreePct: getStatVal("oppThreePointPct", "opponentThreePointPct", "Opp3P%"),
		},
		ranks,
	};
}

async function fetchTeamLeadersForLeague(league: League, teamSlug: string): Promise<TeamLeader[]> {
	const roster = await fetchTeamRosterForLeague(league, teamSlug);

	const leaders: TeamLeader[] = [];

	const ptsLeader = [...roster].sort((a, b) => b.stats.ppg - a.stats.ppg)[0];
	if (ptsLeader && ptsLeader.stats.ppg > 0) {
		leaders.push({
			player: {
				id: ptsLeader.id,
				name: ptsLeader.name,
				headshot: ptsLeader.headshot,
				position: ptsLeader.position,
			},
			value: ptsLeader.stats.ppg,
			category: "ppg",
		});
	}

	const rebLeader = [...roster].sort((a, b) => b.stats.rpg - a.stats.rpg)[0];
	if (rebLeader && rebLeader.stats.rpg > 0) {
		leaders.push({
			player: {
				id: rebLeader.id,
				name: rebLeader.name,
				headshot: rebLeader.headshot,
				position: rebLeader.position,
			},
			value: rebLeader.stats.rpg,
			category: "rpg",
		});
	}

	const astLeader = [...roster].sort((a, b) => b.stats.apg - a.stats.apg)[0];
	if (astLeader && astLeader.stats.apg > 0) {
		leaders.push({
			player: {
				id: astLeader.id,
				name: astLeader.name,
				headshot: astLeader.headshot,
				position: astLeader.position,
			},
			value: astLeader.stats.apg,
			category: "apg",
		});
	}

	return leaders;
}

interface V2InjuryRef {
	$ref: string;
}

interface V2InjuryDetail {
	id: string;
	status: string;
	date: string;
	shortComment?: string;
	longComment?: string;
	athlete?: { $ref: string };
	details?: {
		type?: string;
		location?: string;
		detail?: string;
		side?: string;
		returnDate?: string;
	};
}

interface V2InjuriesResponse {
	count: number;
	items: V2InjuryRef[];
}

async function fetchTeamInjuriesForLeague(
	league: League,
	teamSlug: string,
): Promise<InjuredPlayer[]> {
	const teamData = getTeamStaticData(league, teamSlug);
	if (!teamData) {
		throw new Error(`Team not found: ${teamSlug}`);
	}

	const teamId = teamData.api.id;

	// Try V2 API first for richer injury data
	try {
		const v2Base = getLeagueCoreApi(league);
		const injuriesResponse = await fetch(`${v2Base}/teams/${teamId}/injuries?limit=50`, {
			headers: { "Content-Type": "application/json" },
		});

		if (injuriesResponse.ok) {
			const injuriesData = (await injuriesResponse.json()) as V2InjuriesResponse;

			if (injuriesData.items && injuriesData.items.length > 0) {
				// Fetch details for each injury in parallel
				const injuryDetails = await Promise.all(
					injuriesData.items.map(async (item): Promise<InjuredPlayer | null> => {
						try {
							const detailResponse = await fetch(item.$ref);
							if (!detailResponse.ok) return null;

							const detail = (await detailResponse.json()) as V2InjuryDetail;

							// Fetch athlete info to get name, position, headshot
							let athleteName = "Unknown";
							let athletePosition = "";
							let athleteHeadshot: string | undefined;

							if (detail.athlete?.$ref) {
								try {
									const athleteResponse = await fetch(detail.athlete.$ref);
									if (athleteResponse.ok) {
										const athleteData = await athleteResponse.json();
										athleteName = athleteData.displayName || athleteData.fullName || "Unknown";
										athletePosition = athleteData.position?.abbreviation || "";
										athleteHeadshot = athleteData.headshot?.href;
									}
								} catch {
									// Ignore athlete fetch errors
								}
							}

							// Build description from details
							let description: string | undefined;
							if (detail.details) {
								const parts: string[] = [];
								if (detail.details.side) parts.push(detail.details.side);
								if (detail.details.type) parts.push(detail.details.type);
								if (detail.details.detail) parts.push(detail.details.detail);
								if (parts.length > 0) {
									description = parts.join(" ");
								}
							}

							return {
								id: detail.id,
								name: athleteName,
								position: athletePosition,
								status: detail.status,
								description,
								shortComment: detail.shortComment,
								headshot: athleteHeadshot,
							};
						} catch {
							return null;
						}
					}),
				);

				const validInjuries = injuryDetails.filter((i): i is InjuredPlayer => i !== null);
				if (validInjuries.length > 0) {
					return validInjuries;
				}
			}
		}
	} catch {
		// V2 API failed, fall back to roster-based injuries
	}

	// Fallback: get injuries from roster data
	const roster = await fetchTeamRosterForLeague(league, teamSlug);

	return roster
		.filter((player) => player.injured)
		.map(
			(player): InjuredPlayer => ({
				id: player.id,
				name: player.name,
				position: player.position,
				status: player.injuryStatus ?? "Injured",
				description: player.injuryDescription,
				shortComment: undefined,
				headshot: player.headshot,
			}),
		);
}

// ============================================================================
// NBA Server Functions
// ============================================================================

export const fetchNbaTeamOverview = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<TeamOverview> => {
		return fetchTeamOverviewForLeague("nba", teamSlug);
	});

export const fetchNbaTeamRoster = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<RosterPlayer[]> => {
		return fetchTeamRosterForLeague("nba", teamSlug);
	});

export const fetchNbaTeamSchedule = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<ScheduleGame[]> => {
		return fetchTeamScheduleForLeague("nba", teamSlug);
	});

export const fetchNbaTeamStats = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<TeamStats> => {
		return fetchTeamStatsForLeague("nba", teamSlug);
	});

export const fetchNbaTeamLeaders = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<TeamLeader[]> => {
		return fetchTeamLeadersForLeague("nba", teamSlug);
	});

export const fetchNbaTeamInjuries = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<InjuredPlayer[]> => {
		return fetchTeamInjuriesForLeague("nba", teamSlug);
	});

// ============================================================================
// WNBA Server Functions
// ============================================================================

export const fetchWnbaTeamOverview = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<TeamOverview> => {
		return fetchTeamOverviewForLeague("wnba", teamSlug);
	});

export const fetchWnbaTeamRoster = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<RosterPlayer[]> => {
		return fetchTeamRosterForLeague("wnba", teamSlug);
	});

export const fetchWnbaTeamSchedule = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<ScheduleGame[]> => {
		return fetchTeamScheduleForLeague("wnba", teamSlug);
	});

export const fetchWnbaTeamStats = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<TeamStats> => {
		return fetchTeamStatsForLeague("wnba", teamSlug);
	});

export const fetchWnbaTeamLeaders = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<TeamLeader[]> => {
		return fetchTeamLeadersForLeague("wnba", teamSlug);
	});

export const fetchWnbaTeamInjuries = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<InjuredPlayer[]> => {
		return fetchTeamInjuriesForLeague("wnba", teamSlug);
	});

// ============================================================================
// G-League Server Functions
// ============================================================================

export const fetchGLeagueTeamOverview = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<TeamOverview> => {
		return fetchTeamOverviewForLeague("gleague", teamSlug);
	});

export const fetchGLeagueTeamRoster = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<RosterPlayer[]> => {
		return fetchTeamRosterForLeague("gleague", teamSlug);
	});

export const fetchGLeagueTeamSchedule = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<ScheduleGame[]> => {
		return fetchTeamScheduleForLeague("gleague", teamSlug);
	});

export const fetchGLeagueTeamStats = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<TeamStats> => {
		return fetchTeamStatsForLeague("gleague", teamSlug);
	});

export const fetchGLeagueTeamLeaders = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<TeamLeader[]> => {
		return fetchTeamLeadersForLeague("gleague", teamSlug);
	});

export const fetchGLeagueTeamInjuries = createServerFn({ method: "GET" })
	.inputValidator((d: string) => d)
	.handler(async ({ data: teamSlug }): Promise<InjuredPlayer[]> => {
		return fetchTeamInjuriesForLeague("gleague", teamSlug);
	});

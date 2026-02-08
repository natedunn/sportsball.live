/**
 * Adapters that transform Convex query results into the existing component types.
 * This allows route files to switch from ESPN queries to Convex queries
 * without modifying downstream components.
 */
import { getTeamStaticData } from "@/lib/teams";
import { getTeamColors, getProxiedLogoUrl } from "@/lib/shared/team-utils";
import type { League } from "@/lib/shared/league";
import type { GameData, GameTeam } from "@/lib/types";
import type { StandingTeam, StandingsResponse } from "@/lib/types/standings";
import type {
	GameDetails,
	GameDetailsTeam,
	Player,
	PlayerStats,
	TeamStats as GameTeamStats,
	SeasonSeries,
} from "@/lib/shared/game-details.types";
import type {
	TeamOverview,
	RosterPlayer,
	ScheduleGame,
	TeamStats,
	TeamLeader,
} from "@/lib/types/team";

// ============================================================
// Event status → State mapping
// ============================================================

type EventStatus =
	| "scheduled"
	| "in_progress"
	| "halftime"
	| "end_of_period"
	| "overtime"
	| "completed"
	| "postponed"
	| "cancelled";

function mapEventStatusToState(status: EventStatus | string): "pre" | "in" | "post" {
	switch (status) {
		case "scheduled":
			return "pre";
		case "completed":
		case "postponed":
		case "cancelled":
			return "post";
		default:
			return "in"; // in_progress, halftime, end_of_period, overtime
	}
}

// ============================================================
// Helper: build a GameTeam from Convex team data
// ============================================================

function buildGameTeam(
	league: League,
	team: { espnTeamId: string; name: string; location: string; abbreviation: string; wins: number; losses: number } | null,
	score: number | undefined,
): GameTeam {
	if (!team) {
		return {
			id: "",
			uid: undefined,
			location: undefined,
			name: "Unknown",
			score: String(score ?? 0),
			logo: undefined,
			primaryColor: undefined,
			darkColor: "000000",
			lightColor: "000000",
			seasonRecord: "0-0",
		};
	}

	const staticData = getTeamStaticData(league, team.espnTeamId);
	const colors = staticData
		? { darkColor: staticData.colors.display.dark, lightColor: staticData.colors.display.light }
		: { darkColor: "000000", lightColor: "000000" };
	const logo = staticData ? `/api/${league}/logo/${staticData.logoSlug}` : undefined;

	// Derive short name by stripping location prefix from full display name
	const shortName = team.location && team.name.startsWith(team.location)
		? team.name.slice(team.location.length).trim()
		: team.name;

	return {
		id: team.espnTeamId,
		uid: undefined,
		location: team.location,
		name: shortName || team.name,
		score: String(score ?? 0),
		logo,
		primaryColor: colors.darkColor,
		darkColor: colors.darkColor,
		lightColor: colors.lightColor,
		seasonRecord: `${team.wins}-${team.losses}`,
	};
}

// ============================================================
// Scoreboard → GameData[]
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convexScoreboardToGameData(games: any[], league: League): GameData[] {
	return games.map((game) => ({
		id: game.espnGameId,
		uid: "",
		state: mapEventStatusToState(game.eventStatus),
		time: {
			start: game.scheduledStart ? new Date(game.scheduledStart).toISOString() : undefined,
			detail: game.statusDetail,
		},
		away: buildGameTeam(league, game.awayTeam, game.awayScore),
		home: buildGameTeam(league, game.homeTeam, game.homeScore),
	}));
}

// ============================================================
// Standings → StandingsResponse
// ============================================================

function convexTeamToStandingTeam(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	team: any,
	league: League,
): StandingTeam {
	const staticData = getTeamStaticData(league, team.espnTeamId);
	const colors = staticData
		? { darkColor: staticData.colors.display.dark, lightColor: staticData.colors.display.light }
		: { darkColor: "000000", lightColor: "000000" };
	const logo = staticData ? `/api/${league}/logo/${staticData.logoSlug}` : undefined;

	return {
		id: team.espnTeamId,
		name: team.name,
		abbreviation: team.abbreviation,
		logo,
		darkColor: colors.darkColor,
		lightColor: colors.lightColor,
		wins: team.wins,
		losses: team.losses,
		winPct: team.winPct ?? (team.wins + team.losses > 0 ? team.wins / (team.wins + team.losses) : 0),
		gamesBack: parseFloat(team.gamesBack ?? "0") || 0,
		streak: team.streak ?? "-",
		homeRecord: team.homeRecord ?? "-",
		awayRecord: team.awayRecord ?? "-",
		divisionRecord: team.divisionRecord ?? "-",
		conferenceRecord: team.conferenceRecord ?? "-",
		last10: team.last10 ?? "-",
		pointsFor: team.pointsFor ?? 0,
		pointsAgainst: team.pointsAgainst ?? 0,
		differential: (team.pointsFor ?? 0) - (team.pointsAgainst ?? 0),
	};
}

export function convexStandingsToResponse(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	standings: { eastern: any[]; western: any[] },
	league: League,
): StandingsResponse {
	return {
		eastern: {
			name: "Eastern Conference",
			teams: standings.eastern.map((t) => convexTeamToStandingTeam(t, league)),
		},
		western: {
			name: "Western Conference",
			teams: standings.western.map((t) => convexTeamToStandingTeam(t, league)),
		},
	};
}

// ============================================================
// Game Details → GameDetails
// ============================================================

function convexPlayerEventToPlayer(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	pe: any,
): Player {
	const fgStr = `${pe.fieldGoalsMade}-${pe.fieldGoalsAttempted}`;
	const threeStr = `${pe.threePointMade}-${pe.threePointAttempted}`;
	const ftStr = `${pe.freeThrowsMade}-${pe.freeThrowsAttempted}`;
	const mins = pe.minutes ?? 0;
	const minStr = `${Math.floor(mins)}:${String(Math.round((mins % 1) * 60)).padStart(2, "0")}`;

	const stats: PlayerStats = {
		minutes: minStr,
		fieldGoals: fgStr,
		threePointers: threeStr,
		freeThrows: ftStr,
		offensiveRebounds: pe.offensiveRebounds ?? 0,
		defensiveRebounds: pe.defensiveRebounds ?? 0,
		totalRebounds: pe.totalRebounds ?? 0,
		assists: pe.assists ?? 0,
		steals: pe.steals ?? 0,
		blocks: pe.blocks ?? 0,
		turnovers: pe.turnovers ?? 0,
		fouls: pe.fouls ?? 0,
		plusMinus: pe.plusMinus !== undefined ? String(pe.plusMinus) : "0",
		points: pe.points ?? 0,
	};

	return {
		id: pe.player?.espnPlayerId ?? "",
		name: pe.player?.name ?? "Unknown",
		jersey: pe.player?.jersey ?? "",
		position: pe.player?.position ?? "",
		starter: pe.starter ?? false,
		active: pe.active ?? false,
		stats,
	};
}

function convexTeamEventToStats(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	te: any,
): GameTeamStats {
	if (!te) {
		return {
			fieldGoalsMade: 0, fieldGoalsAttempted: 0, fieldGoalPct: 0,
			threePointMade: 0, threePointAttempted: 0, threePointPct: 0,
			freeThrowsMade: 0, freeThrowsAttempted: 0, freeThrowPct: 0,
			totalRebounds: 0, offensiveRebounds: 0, defensiveRebounds: 0,
			assists: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0,
			pointsInPaint: 0, fastBreakPoints: 0, largestLead: 0,
		};
	}

	return {
		fieldGoalsMade: te.fieldGoalsMade ?? 0,
		fieldGoalsAttempted: te.fieldGoalsAttempted ?? 0,
		fieldGoalPct: te.fieldGoalPct ?? 0,
		threePointMade: te.threePointMade ?? 0,
		threePointAttempted: te.threePointAttempted ?? 0,
		threePointPct: te.threePointPct ?? 0,
		freeThrowsMade: te.freeThrowsMade ?? 0,
		freeThrowsAttempted: te.freeThrowsAttempted ?? 0,
		freeThrowPct: te.freeThrowPct ?? 0,
		totalRebounds: te.totalRebounds ?? 0,
		offensiveRebounds: te.offensiveRebounds ?? 0,
		defensiveRebounds: te.defensiveRebounds ?? 0,
		assists: te.assists ?? 0,
		steals: te.steals ?? 0,
		blocks: te.blocks ?? 0,
		turnovers: te.turnovers ?? 0,
		fouls: te.fouls ?? 0,
		pointsInPaint: te.pointsInPaint ?? 0,
		fastBreakPoints: te.fastBreakPoints ?? 0,
		largestLead: te.largestLead ?? 0,
	};
}

function buildGameDetailsTeam(
	league: League,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	team: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	teamEvent: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	playerEvents: any[],
	score: number,
	opponentScore: number,
): GameDetailsTeam {
	const staticData = team ? getTeamStaticData(league, team.espnTeamId) : null;
	const colors = staticData
		? { darkColor: staticData.colors.display.dark, lightColor: staticData.colors.display.light }
		: { darkColor: "000000", lightColor: "000000" };
	const logo = staticData ? `/api/${league}/logo/${staticData.logoSlug}` : undefined;

	return {
		id: team?.espnTeamId ?? "",
		uid: undefined,
		name: team?.name,
		abbreviation: team?.abbreviation,
		score,
		logo,
		darkColor: colors.darkColor,
		lightColor: colors.lightColor,
		winner: score > opponentScore,
		record: team ? `${team.wins}-${team.losses}` : undefined,
		stats: convexTeamEventToStats(teamEvent),
		players: playerEvents.map(convexPlayerEventToPlayer),
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convexGameDetailsToGameDetails(data: any, league: League): GameDetails | null {
	if (!data) return null;

	const { game, homeTeam, awayTeam, homeTeamEvent, awayTeamEvent, homePlayerEvents, awayPlayerEvents } = data;

	const homeScore = game.homeScore ?? homeTeamEvent?.score ?? 0;
	const awayScore = game.awayScore ?? awayTeamEvent?.score ?? 0;

	return {
		id: game.espnGameId,
		state: mapEventStatusToState(game.eventStatus),
		statusDetail: game.statusDetail,
		venue: game.venue,
		date: game.scheduledStart ? new Date(game.scheduledStart).toISOString() : undefined,
		away: buildGameDetailsTeam(league, awayTeam, awayTeamEvent, awayPlayerEvents ?? [], awayScore, homeScore),
		home: buildGameDetailsTeam(league, homeTeam, homeTeamEvent, homePlayerEvents ?? [], homeScore, awayScore),
		allSeries: [],
	};
}

// ============================================================
// Team Page → TeamOverview
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convexTeamToOverview(team: any, league: League): TeamOverview {
	const staticData = getTeamStaticData(league, team.espnTeamId);
	const colors = staticData
		? { darkColor: staticData.colors.display.dark, lightColor: staticData.colors.display.light }
		: { darkColor: "000000", lightColor: "000000" };
	const logo = staticData ? `/api/${league}/logo/${staticData.logoSlug}` : undefined;

	return {
		id: team.espnTeamId,
		name: team.name,
		abbreviation: team.abbreviation,
		location: team.location,
		logo,
		darkColor: colors.darkColor,
		lightColor: colors.lightColor,
		record: {
			wins: team.wins,
			losses: team.losses,
			winPct: team.winPct ?? (team.wins + team.losses > 0 ? team.wins / (team.wins + team.losses) : 0),
			streak: team.streak,
			home: team.homeRecord,
			away: team.awayRecord,
		},
		standings: {
			conferenceRank: team.conferenceRank,
			conference: team.conference,
			divisionRank: team.divisionRank,
			division: team.division,
		},
		stats: {
			ppg: team.pointsFor ?? 0,
			oppPpg: team.pointsAgainst ?? 0,
			ortg: team.offensiveRating ?? 0,
			drtg: team.defensiveRating ?? 0,
			netRtg: team.netRating ?? 0,
		},
		ranks: {
			ppg: team.rankPpg,
			oppPpg: team.rankOppPpg,
			ortg: team.rankOrtg,
			drtg: team.rankDrtg,
			netRtg: team.rankNetRtg,
		},
	};
}

// ============================================================
// Team Page → TeamStats
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convexTeamToStats(team: any): TeamStats {
	return {
		scoring: {
			ppg: team.pointsFor ?? 0,
			oppPpg: team.pointsAgainst ?? 0,
			pace: team.pace ?? 0,
			ortg: team.offensiveRating ?? 0,
			drtg: team.defensiveRating ?? 0,
			netRtg: team.netRating ?? 0,
		},
		shooting: {
			fgPct: team.fgPct ?? 0,
			fgMade: team.totalFgMade ?? 0,
			fgAttempted: team.totalFgAttempted ?? 0,
			threePct: team.threePct ?? 0,
			threeMade: team.totalThreeMade ?? 0,
			threeAttempted: team.totalThreeAttempted ?? 0,
			ftPct: team.ftPct ?? 0,
			ftMade: team.totalFtMade ?? 0,
			ftAttempted: team.totalFtAttempted ?? 0,
			efgPct: team.efgPct ?? 0,
			tsPct: team.tsPct ?? 0,
		},
		rebounding: {
			rpg: team.rpg ?? 0,
			orpg: team.orpg ?? 0,
			drpg: team.drpg ?? 0,
			orebPct: 0, // Not computed in Convex yet
		},
		playmaking: {
			apg: team.apg ?? 0,
			tovPg: team.tovPg ?? 0,
			astToRatio: team.astToRatio ?? 0,
		},
		defense: {
			spg: team.spg ?? 0,
			bpg: team.bpg ?? 0,
			oppFgPct: 0, // Not computed in Convex yet
			oppThreePct: 0, // Not computed in Convex yet
		},
		ranks: {
			rankPpg: team.rankPpg,
			rankOppPpg: team.rankOppPpg,
			rankMargin: team.rankMargin,
			rankPace: team.rankPace,
			rankOrtg: team.rankOrtg,
			rankDrtg: team.rankDrtg,
			rankNetRtg: team.rankNetRtg,
			rankFgPct: team.rankFgPct,
			rankThreePct: team.rankThreePct,
			rankFtPct: team.rankFtPct,
			rankEfgPct: team.rankEfgPct,
			rankTsPct: team.rankTsPct,
			rankRpg: team.rankRpg,
			rankOrpg: team.rankOrpg,
			rankDrpg: team.rankDrpg,
			rankApg: team.rankApg,
			rankTov: team.rankTov,
			rankAstToRatio: team.rankAstToRatio,
			rankSpg: team.rankSpg,
			rankBpg: team.rankBpg,
		},
	};
}

// ============================================================
// Team Page → RosterPlayer[]
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convexRosterToPlayers(players: any[]): RosterPlayer[] {
	return players.map((p) => ({
		id: p.espnPlayerId,
		name: p.name,
		firstName: p.firstName ?? p.name?.split(" ")[0] ?? "",
		lastName: p.lastName ?? p.name?.split(" ").slice(1).join(" ") ?? "",
		jersey: p.jersey ?? "",
		position: p.position ?? "",
		height: p.height ?? "",
		weight: p.weight ?? "",
		age: p.age,
		experience: p.experience ?? "",
		college: p.college,
		headshot: p.headshot,
		injured: false, // Injuries still from ESPN
		injuryStatus: undefined,
		injuryDescription: undefined,
		stats: {
			gp: p.gamesPlayed ?? 0,
			gs: p.gamesStarted ?? 0,
			mpg: p.minutesPerGame ?? 0,
			ppg: p.pointsPerGame ?? 0,
			rpg: p.reboundsPerGame ?? 0,
			apg: p.assistsPerGame ?? 0,
			spg: p.stealsPerGame ?? 0,
			bpg: p.blocksPerGame ?? 0,
			topg: p.turnoversPerGame ?? 0,
			fgPct: p.fieldGoalPct ?? 0,
			threePct: p.threePointPct ?? 0,
			ftPct: p.freeThrowPct ?? 0,
		},
	}));
}

// ============================================================
// Team Page → ScheduleGame[]
// ============================================================

export function convexScheduleToGames(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	games: any[],
	league: League,
): ScheduleGame[] {
	return games.map((game) => {
		const opponent = game.opponent;
		const staticData = opponent ? getTeamStaticData(league, opponent.espnTeamId) : null;
		const opponentLogo = staticData ? `/api/${league}/logo/${staticData.logoSlug}` : undefined;

		const state = mapEventStatusToState(game.eventStatus);
		const isHome: boolean = game.isHome;

		// Build result for completed games
		let result: ScheduleGame["result"];
		if (state === "post" && game.homeScore !== undefined && game.awayScore !== undefined) {
			const myScore = isHome ? game.homeScore : game.awayScore;
			const oppScore = isHome ? game.awayScore : game.homeScore;
			result = {
				isWin: myScore > oppScore,
				score: myScore,
				opponentScore: oppScore,
				margin: myScore - oppScore,
			};
		}

		// Build live score for in-progress games
		let liveScore: ScheduleGame["liveScore"];
		if (state === "in" && game.homeScore !== undefined && game.awayScore !== undefined) {
			liveScore = {
				score: isHome ? game.homeScore : game.awayScore,
				opponentScore: isHome ? game.awayScore : game.homeScore,
			};
		}

		return {
			id: game.espnGameId,
			date: game.scheduledStart ? new Date(game.scheduledStart).toISOString() : "",
			isHome,
			opponent: {
				id: opponent?.espnTeamId ?? "",
				name: opponent?.name ?? "Unknown",
				abbreviation: opponent?.abbreviation ?? "???",
				logo: opponentLogo,
			},
			result,
			liveScore,
			state,
			statusDetail: game.statusDetail ?? "",
			venue: game.venue,
		};
	});
}

// ============================================================
// Team Page → TeamLeader[] (derived from roster)
// ============================================================

export function deriveTeamLeaders(players: RosterPlayer[]): TeamLeader[] {
	const qualified = players.filter((p) => p.stats.gp >= 5);
	if (qualified.length === 0) return [];

	const categories: Array<{ key: "ppg" | "rpg" | "apg"; statKey: keyof RosterPlayer["stats"] }> = [
		{ key: "ppg", statKey: "ppg" },
		{ key: "rpg", statKey: "rpg" },
		{ key: "apg", statKey: "apg" },
	];

	return categories.map(({ key, statKey }) => {
		const sorted = [...qualified].sort((a, b) => b.stats[statKey] - a.stats[statKey]);
		const top = sorted[0];
		return {
			player: {
				id: top.id,
				name: top.name,
				headshot: top.headshot,
				position: top.position,
			},
			value: top.stats[statKey],
			category: key,
		};
	});
}

// Statistical calculation formulas used for computing advanced stats

/**
 * Calculate possessions using the standard formula.
 * Possessions ≈ FGA + 0.44 × FTA - OREB + TOV
 */
export function calculatePossessions(
	fga: number,
	fta: number,
	oreb: number,
	tov: number,
): number {
	return fga + 0.44 * fta - oreb + tov;
}

/**
 * Calculate Offensive Rating (points per 100 possessions).
 */
export function calculateOffensiveRating(points: number, possessions: number): number {
	if (possessions <= 0) return 0;
	return (points / possessions) * 100;
}

/**
 * Calculate Defensive Rating (opponent points per 100 possessions).
 */
export function calculateDefensiveRating(oppPoints: number, possessions: number): number {
	if (possessions <= 0) return 0;
	return (oppPoints / possessions) * 100;
}

/**
 * Calculate Net Rating (ORtg - DRtg).
 */
export function calculateNetRating(ortg: number, drtg: number): number {
	return ortg - drtg;
}

/**
 * Calculate Effective Field Goal Percentage.
 * eFG% = (FGM + 0.5 × 3PM) / FGA × 100
 */
export function calculateEfgPct(fgMade: number, threeMade: number, fgAttempted: number): number {
	if (fgAttempted <= 0) return 0;
	return ((fgMade + 0.5 * threeMade) / fgAttempted) * 100;
}

/**
 * Calculate True Shooting Percentage.
 * TS% = PTS / (2 × (FGA + 0.44 × FTA)) × 100
 */
export function calculateTsPct(points: number, fgAttempted: number, ftAttempted: number): number {
	const trueShotAttempts = 2 * (fgAttempted + 0.44 * ftAttempted);
	if (trueShotAttempts <= 0) return 0;
	return (points / trueShotAttempts) * 100;
}

/**
 * Compute per-game advanced stats for a single team event (box score).
 * Returns pace, ORtg, DRtg, netRtg, eFG%, TS%.
 */
export function computeTeamEventAdvancedStats(args: {
	score: number;
	oppScore: number;
	fga: number;
	fta: number;
	oreb: number;
	tov: number;
	fgMade: number;
	threeMade: number;
}): {
	pace: number;
	offensiveRating: number;
	defensiveRating: number;
	netRating: number;
	efgPct: number;
	tsPct: number;
} {
	const pace = calculatePossessions(args.fga, args.fta, args.oreb, args.tov);
	const offensiveRating = calculateOffensiveRating(args.score, pace);
	const defensiveRating = calculateDefensiveRating(args.oppScore, pace);
	const netRating = calculateNetRating(offensiveRating, defensiveRating);
	const efgPct = calculateEfgPct(args.fgMade, args.threeMade, args.fga);
	const tsPct = calculateTsPct(args.score, args.fga, args.fta);

	return { pace, offensiveRating, defensiveRating, netRating, efgPct, tsPct };
}

/**
 * Whether a player's box score line is an actual appearance. Did-not-play
 * rows come through as all zeros, and ESPN's `active` flag can't tell them
 * apart (it's false for most bench players who did play).
 */
export function playedInGame(line: {
	minutes: number;
	points: number;
	fieldGoalsAttempted: number;
	freeThrowsAttempted: number;
	totalRebounds: number;
	assists: number;
	steals: number;
	blocks: number;
	turnovers: number;
	fouls: number;
}): boolean {
	return (
		line.minutes > 0 ||
		line.points > 0 ||
		line.fieldGoalsAttempted > 0 ||
		line.freeThrowsAttempted > 0 ||
		line.totalRebounds > 0 ||
		line.assists > 0 ||
		line.steals > 0 ||
		line.blocks > 0 ||
		line.turnovers > 0 ||
		line.fouls > 0
	);
}

/**
 * A player's season ratings from their stored season stats (per-game averages
 * plus shooting totals):
 * - TS% = PTS / (2 × (FGA + 0.44 × FTA))
 * - EFF (per game) = PTS + REB + AST + STL + BLK − missed FG − missed FT − TOV
 * - AST/TO = assists per turnover
 */
export function computePlayerSeasonRatings(player: {
	gamesPlayed?: number;
	pointsPerGame?: number;
	reboundsPerGame?: number;
	assistsPerGame?: number;
	stealsPerGame?: number;
	blocksPerGame?: number;
	turnoversPerGame?: number;
	totalFgMade?: number;
	totalFgAttempted?: number;
	totalFtMade?: number;
	totalFtAttempted?: number;
}): { trueShootingPct: number; efficiency: number; assistToTurnover: number } {
	const gamesPlayed = player.gamesPlayed ?? 0;
	if (gamesPlayed <= 0) return { trueShootingPct: 0, efficiency: 0, assistToTurnover: 0 };

	const points = player.pointsPerGame ?? 0;
	const assists = player.assistsPerGame ?? 0;
	const turnovers = player.turnoversPerGame ?? 0;
	const fgAttempted = (player.totalFgAttempted ?? 0) / gamesPlayed;
	const fgMissed = fgAttempted - (player.totalFgMade ?? 0) / gamesPlayed;
	const ftAttempted = (player.totalFtAttempted ?? 0) / gamesPlayed;
	const ftMissed = ftAttempted - (player.totalFtMade ?? 0) / gamesPlayed;

	return {
		trueShootingPct: calculateTsPct(points, fgAttempted, ftAttempted),
		efficiency:
			points +
			(player.reboundsPerGame ?? 0) +
			assists +
			(player.stealsPerGame ?? 0) +
			(player.blocksPerGame ?? 0) -
			fgMissed -
			ftMissed -
			turnovers,
		assistToTurnover: assists / Math.max(turnovers, 0.1),
	};
}

/**
 * Round a number to the specified decimal places.
 */
export function round(value: number, decimals: number = 1): number {
	const factor = Math.pow(10, decimals);
	return Math.round(value * factor) / factor;
}

// Statistical calculation formulas used for computing advanced stats
// Extracted from src/convex/teamStats.ts for reuse across all league functions

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
 * Round a number to the specified decimal places.
 */
export function round(value: number, decimals: number = 1): number {
	const factor = Math.pow(10, decimals);
	return Math.round(value * factor) / factor;
}

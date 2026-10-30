// Pure comparisons for the daily data health check (see health.ts)

export type League = "nba" | "wnba" | "gleague";

export type HealthStatus = "ok" | "repaired" | "failing" | "skipped";

export interface HealthResult {
	league?: League;
	check: string;
	status: HealthStatus;
	message: string;
	details?: string[];
}

/** Team box score fields compared against ESPN, named as on our team events */
export const BOX_SCORE_FIELDS = [
	"score",
	"fieldGoalsMade",
	"fieldGoalsAttempted",
	"threePointMade",
	"threePointAttempted",
	"freeThrowsMade",
	"freeThrowsAttempted",
	"totalRebounds",
	"offensiveRebounds",
	"defensiveRebounds",
	"assists",
	"steals",
	"blocks",
	"turnovers",
] as const;

export type TeamBoxLine = Record<(typeof BOX_SCORE_FIELDS)[number], number>;

/** Fields where our team box score differs from ESPN's, as "field ours→espn" */
export function diffBoxScore(ours: TeamBoxLine, espn: TeamBoxLine): string[] {
	return BOX_SCORE_FIELDS.filter((field) => ours[field] !== espn[field]).map(
		(field) => `${field} ${ours[field]}→${espn[field]}`,
	);
}

/** Players on ESPN's roster we don't list, and players we list that ESPN doesn't */
export function diffRoster(
	ours: Iterable<string>,
	espn: Iterable<string>,
): { missing: string[]; extra: string[] } {
	const ourIds = new Set(ours);
	const espnIds = new Set(espn);
	return {
		missing: [...espnIds].filter((id) => !ourIds.has(id)),
		extra: [...ourIds].filter((id) => !espnIds.has(id)),
	};
}

export interface JobRun {
	job: string;
	league?: League;
	lastRanAt: number;
	lastOk: boolean;
	lastOkAt?: number;
	summary?: string;
}

export interface ExpectedJob {
	job: string;
	league?: League;
}

/**
 * Expected jobs with no successful run within maxAgeMs, each described for the
 * health report. A single failed run inside the window isn't a problem.
 */
export function findStaleJobs(
	runs: JobRun[],
	expected: ExpectedJob[],
	now: number,
	maxAgeMs: number,
): string[] {
	const label = (job: ExpectedJob) => (job.league ? `${job.league} ${job.job}` : job.job);
	const problems: string[] = [];
	for (const job of expected) {
		const run = runs.find((r) => r.job === job.job && r.league === job.league);
		if (!run) {
			problems.push(`${label(job)}: no run recorded`);
			continue;
		}
		if (run.lastOkAt !== undefined && now - run.lastOkAt <= maxAgeMs) continue;
		const since =
			run.lastOkAt === undefined
				? "never succeeded"
				: `last succeeded ${Math.round((now - run.lastOkAt) / (60 * 60 * 1000))}h ago`;
		const lastFailure = run.lastOk ? "" : `; last run failed${run.summary ? ` (${run.summary})` : ""}`;
		problems.push(`${label(job)}: ${since}${lastFailure}`);
	}
	return problems;
}

/**
 * A check's result from what it found and what was still wrong after repairing:
 * ok when nothing was wrong, repaired when everything was fixed, failing otherwise.
 */
export function resultFor(
	league: League,
	check: string,
	found: string[],
	stillWrong: string[],
	describe: { ok: string; repaired: string; failing: string },
): HealthResult {
	if (found.length === 0) return { league, check, status: "ok", message: describe.ok };
	if (stillWrong.length === 0) {
		return { league, check, status: "repaired", message: describe.repaired, details: found };
	}
	return { league, check, status: "failing", message: describe.failing, details: stillWrong };
}

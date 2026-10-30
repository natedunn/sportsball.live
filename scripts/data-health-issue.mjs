#!/usr/bin/env node
// Reports the daily Convex data health check (health:getLatest) as a GitHub
// issue, from the "Data health" workflow. One open issue, labelled data-health
// and assigned to the repo owner, tracks the current problems: it's opened when
// a check is failing or the health check stopped running, updated while that
// lasts, and closed once everything passes again. See docs/data-health.md.
//
// Env: CONVEX_URL (production deployment URL), GH_TOKEN, GITHUB_REPOSITORY,
// GITHUB_REPOSITORY_OWNER. Pass --dry-run to print the report without touching issues.

import { execFileSync } from "node:child_process";

const LABEL = "data-health";
const MAX_AGE_MS = 26 * 60 * 60 * 1000;
const MAX_DETAILS = 15;
const LEAGUE_NAMES = { nba: "NBA", wnba: "WNBA", gleague: "G League" };

const dryRun = process.argv.includes("--dry-run");
const convexUrl = process.env.CONVEX_URL;
if (!convexUrl) throw new Error("CONVEX_URL is required");

function gh(args) {
	return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

async function getLatestOnce() {
	const response = await fetch(`${convexUrl}/api/query`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path: "health:getLatest", args: {}, format: "json" }),
	});
	const body = await response.json();
	if (body.status !== "success") throw new Error(body.errorMessage ?? `HTTP ${response.status}`);
	return body.value;
}

// Retries ride out a brief Convex or network blip
async function getLatest() {
	for (let attempt = 1; ; attempt++) {
		try {
			return await getLatestOnce();
		} catch (e) {
			if (attempt >= 3) throw e;
			await new Promise((resolve) => setTimeout(resolve, attempt * 10_000));
		}
	}
}

function describe(result) {
	const where = result.league ? `${LEAGUE_NAMES[result.league]} · ${result.check}` : result.check;
	const lines = [`- **${where}:** ${result.message}`];
	const details = result.details ?? [];
	for (const detail of details.slice(0, MAX_DETAILS)) lines.push(`  - ${detail}`);
	if (details.length > MAX_DETAILS) lines.push(`  - …and ${details.length - MAX_DETAILS} more`);
	return lines.join("\n");
}

const sameCheck = (a, b) => a.check === b.check && (a.league ?? null) === (b.league ?? null);

// The problem report, or null when there's nothing to report. Failing checks
// only count once they've failed two runs in a row (or while an issue is
// already open), so a one-off ESPN hiccup doesn't page anyone.
function buildReport(latest, error, issueOpen) {
	if (error) {
		return `Couldn't read the health check from Convex (\`${convexUrl}\`):\n\n\`\`\`\n${error}\n\`\`\``;
	}
	if (!latest) return "No data health check has run yet. It's scheduled daily at 19:30 UTC (`health-check` in `src/convex/crons.ts`).";

	const ranAt = new Date(latest.ranAt).toISOString().replace("T", " ").slice(0, 16);
	if (Date.now() - latest.ranAt > MAX_AGE_MS) {
		return `The daily data health check hasn't run since ${ranAt} UTC. Convex's scheduled jobs may have stopped, or the check is crashing; see the \`health-check\` cron in the Convex dashboard logs.`;
	}
	const failing = latest.results.filter(
		(r) =>
			r.status === "failing" &&
			(issueOpen || (latest.previousFailing ?? []).some((previous) => sameCheck(previous, r))),
	);
	if (failing.length === 0) {
		if (latest.failing > 0) console.log(`${latest.failing} checks failing for the first time; reporting if they fail again tomorrow`);
		return null;
	}

	const repaired = latest.results.filter((r) => r.status === "repaired");
	const sections = [
		`The data health check on ${ranAt} UTC found problems it couldn't fix${issueOpen ? "" : " (two runs in a row)"}.`,
		`### Failing\n${failing.map(describe).join("\n")}`,
	];
	if (repaired.length > 0) sections.push(`### Repaired automatically\n${repaired.map(describe).join("\n")}`);
	sections.push("Run the check again after a fix: `npx convex run --deployment harmless-coyote-806 health:runHealthCheck`.");
	return sections.join("\n\n");
}

let latest = null;
let error = null;
try {
	latest = await getLatest();
} catch (e) {
	error = e instanceof Error ? e.message : String(e);
}

const open = dryRun
	? undefined
	: JSON.parse(gh(["issue", "list", "--label", LABEL, "--state", "open", "--json", "number,body", "--limit", "1"]))[0];
const report = buildReport(latest, error, Boolean(open));

if (dryRun) {
	console.log(report ?? "Healthy: no issue needed.");
	process.exit(0);
}

if (report) {
	if (!open) {
		gh(["label", "create", LABEL, "--color", "B60205", "--description", "Daily data health check", "--force"]);
		const url = gh([
			"issue", "create",
			"--title", "Data health check needs attention",
			"--label", LABEL,
			"--assignee", process.env.GITHUB_REPOSITORY_OWNER ?? "",
			"--body", report,
		]);
		console.log(`Opened ${url}`);
	} else if (open.body.trim() !== report.trim()) {
		// Keep the body current and leave a comment, so changes notify
		gh(["issue", "edit", String(open.number), "--body", report]);
		gh(["issue", "comment", String(open.number), "--body", `Updated report:\n\n${report}`]);
		console.log(`Updated #${open.number}`);
	} else {
		console.log(`#${open.number} is already up to date`);
	}
} else if (open) {
	gh(["issue", "close", String(open.number), "--comment", "All data health checks pass again."]);
	console.log(`Closed #${open.number}`);
} else {
	console.log("Healthy: no issue needed.");
}

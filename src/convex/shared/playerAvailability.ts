import type { GameLogPhase } from "./playerGameLog";

// Turns a player's games and raw absence records (injuryHistory.ts) into their
// availability for the season. These rules run on read, so changing them needs
// no backfill.
//
// A game the player's team played without them gets the best reason available:
//   1. the box score's, when it gives a real one
//   2. the injury report open around that date. ESPN leaves long-term injured
//      players off the box score, so this is often the only explanation
//   3. a guess: someone who usually starts is rarely sat for anything else
// and otherwise the reason is unknown. We never know more than that, so the
// wording on the page should promise a reason, not a diagnosis.

export interface GameAbsence {
	espnGameId: string;
	gameDate: string;
	phase: GameLogPhase;
	reason: string;
}

export interface InjuryReportEntry {
	status: string;
	description?: string;
	shortComment?: string;
	returnDate?: string;
	reportedAt?: string;
	firstSeenAt: number;
	clearedAt?: number;
}

export interface TeamGame {
	gameDate: string;
	phase: GameLogPhase;
}

export interface PlayedGame extends TeamGame {
	starter: boolean;
}

type ReasonCategory =
	| "injury"
	| "coach"
	| "g-league"
	| "suspension"
	| "personal"
	| "rest"
	| "trade"
	| "likely-injury"
	| "unknown";

export interface AvailabilityGame extends TeamGame {
	outcome: "started" | "bench" | "missed";
	/** Why they missed it */
	reason?: string;
}

/** One entry in an injury's history */
export interface InjuryUpdate {
	/** YYYYMMDD */
	date: string;
	status: string;
	comment?: string;
}

/** One injury, however many reports and games it ran through */
export interface PlayerInjury {
	label: string;
	/** YYYYMMDD */
	startDate: string;
	endDate: string;
	games: number;
	/** The games it cost them */
	gameDates: string[];
	/** Still on the league's report */
	ongoing: boolean;
	/** Oldest first: everything said along the way, not only the last word */
	updates: InjuryUpdate[];
}

export interface PlayerAvailability {
	/** Oldest first, every phase */
	games: AvailabilityGame[];
	/** The rest cover the regular season */
	played: number;
	started: number;
	missed: number;
	/** Percent of games played; null before any */
	availability: number | null;
	/** Null when there have been no playoff games */
	playoffs: { played: number; games: number } | null;
	/** Newest first. Other reasons for missing games are in `games` */
	injuries: PlayerInjury[];
}

// A report lags the injury. Games this soon before it, since the player last
// played, are put down to it.
const REPORT_LOOKBACK_DAYS = 7;
// How long before the first game an injury still counts toward this season.
// The report log has no seasons of its own.
const OFFSEASON_DAYS = 180;
const USUAL_STARTER_SHARE = 0.75;
const USUAL_STARTER_MIN_GAMES = 3;

const UNKNOWN_LABEL = "Reason unknown";
const LIKELY_INJURY_LABEL = "Likely injury, unconfirmed";

/** What a reason amounts to. "Inactive" says nothing, so it has no category */
function categorize(reason: string): Exclude<ReasonCategory, "likely-injury" | "unknown"> | null {
	if (/\binactive\b|^not injury related$/i.test(reason.trim())) return null;
	if (/coach/i.test(reason)) return "coach";
	if (/g[- ]?league|two[- ]?way|assignment/i.test(reason)) return "g-league";
	if (/suspen/i.test(reason)) return "suspension";
	if (/personal|not with team|family|bereavement/i.test(reason)) return "personal";
	if (/\brest\b/i.test(reason)) return "rest";
	if (/\btrade/i.test(reason)) return "trade";
	return "injury";
}

const BODY_PARTS: Array<[RegExp, string]> = [
	[/\b(acl|mcl|pcl|meniscus|patellar?|knee)\b/i, "knee"],
	[/\b(labrum|rotator|shoulder)\b/i, "shoulder"],
	[/\b(plantar|foot)\b/i, "foot"],
	[/\bconcussion\b|\bhead\b/i, "head"],
	[/\b(nose|nasal|facial|face|eye|orbital|jaw)\b/i, "face"],
	[/\b(oblique|abdomen|abdominal|core)\b/i, "abdomen"],
	[/\b(fibula|tibia|leg)\b/i, "leg"],
	[
		/\b(ankle|achilles|calf|hamstring|quad|groin|adductor|hip|toe|heel|shin|thigh|back|neck|elbow|forearm|wrist|hand|finger|thumb|rib|chest|illness)\b/i,
		"",
	],
];

function bodyPart(text: string) {
	for (const [pattern, part] of BODY_PARTS) {
		const match = text.match(pattern);
		if (match) return part || match[1].toLowerCase();
	}
	return undefined;
}

function side(text: string) {
	return text.match(/\b(left|right)\b/i)?.[1].toLowerCase();
}

function sameInjury(a: string, b: string) {
	if (a === b) return true;
	const part = bodyPart(a);
	if (!part || part !== bodyPart(b)) return false;
	const [sideA, sideB] = [side(a), side(b)];
	return !sideA || !sideB || sideA === sideB;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ACRONYMS = /^(acl|mcl|pcl)$/i;

/** "RIGHT ACL SURGERY" → "Right ACL Surgery" */
function titleCase(reason: string) {
	return reason
		.toLowerCase()
		.split(/\s+/)
		.map((word) =>
			ACRONYMS.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1),
		)
		.join(" ");
}

/** "2026-09-11T16:03Z" or epoch ms → "20260911" */
function toGameDate(value: string | number) {
	return new Date(value).toISOString().slice(0, 10).replaceAll("-", "");
}

function dateMs(gameDate: string) {
	return Date.UTC(Number(gameDate.slice(0, 4)), Number(gameDate.slice(4, 6)) - 1, Number(gameDate.slice(6, 8)));
}

interface Reason {
	label: string;
	category: ReasonCategory;
	report?: InjuryReportEntry;
}

function lastOf<T>(items: T[]): T | undefined {
	return items[items.length - 1];
}

function reportSpan(report: InjuryReportEntry, now: number) {
	return {
		start: toGameDate(report.reportedAt ?? report.firstSeenAt),
		end: toGameDate(report.clearedAt ?? now),
	};
}

function daysBefore(gameDate: string, days: number) {
	return toGameDate(dateMs(gameDate) - days * DAY_MS);
}

/** The newest report that explains a missed game */
function reportFor(
	date: string,
	reports: InjuryReportEntry[],
	playedDates: string[],
	now: number,
): InjuryReportEntry | undefined {
	return reports
		.map((report) => ({ report, ...reportSpan(report, now) }))
		.sort((a, b) => b.start.localeCompare(a.start))
		.find(({ start, end }) => {
			if (date > end) return false;
			if (date >= start) return true;
			const lastPlayed = lastOf(playedDates.filter((played) => played < start).sort());
			if (lastPlayed === undefined) return false;
			return date > lastPlayed && date > daysBefore(start, REPORT_LOOKBACK_DAYS);
		})?.report;
}

function bestReason(
	boxReason: string | undefined,
	report: InjuryReportEntry | undefined,
	usualStarter: boolean,
): Reason {
	const boxCategory = boxReason === undefined ? null : categorize(boxReason);
	if (boxReason !== undefined && boxCategory) {
		return { label: titleCase(boxReason), category: boxCategory, report };
	}
	if (report) {
		const label = report.description ?? "Injury";
		return { label, category: categorize(label) ?? "injury", report };
	}
	return usualStarter
		? { label: LIKELY_INJURY_LABEL, category: "likely-injury" }
		: { label: UNKNOWN_LABEL, category: "unknown" };
}

function reportLabel(report: InjuryReportEntry) {
	return report.description ?? "Injury";
}

/** Consecutive reports for the same injury and what they said, oldest first */
function updatesFrom(reports: InjuryReportEntry[], now: number): InjuryUpdate[] {
	const updates: InjuryUpdate[] = [];
	for (const report of reports) {
		const last = lastOf(updates);
		if (last?.status === report.status && last.comment === report.shortComment) continue;
		updates.push({
			date: reportSpan(report, now).start,
			status: report.status,
			comment: report.shortComment,
		});
	}
	return updates;
}

/**
 * The player's injuries for the season, one entry each: the games lost to it,
 * then anything else on the report. Games out with the same injury are one
 * entry, ended by the player's return. An injury that cost no games stays only
 * if they were ruled out, which keeps off-season surgery and drops the
 * day-to-day knocks they played through.
 */
function buildInjuries(
	missed: Array<{ gameDate: string; reason: Reason }>,
	reports: InjuryReportEntry[],
	playedDates: string[],
	firstGame: string | undefined,
	now: number,
): PlayerInjury[] {
	const earliest = firstGame ? daysBefore(firstGame, OFFSEASON_DAYS) : undefined;
	const spans = reports
		.map((report) => ({ report, ...reportSpan(report, now) }))
		.filter(({ end }) => earliest === undefined || end >= earliest)
		.sort((a, b) => a.start.localeCompare(b.start));
	// The reports that explained its games, which can post-date them
	const injuries: Array<PlayerInjury & { spans: typeof spans; sources: Set<InjuryReportEntry> }> = [];

	for (const { gameDate, reason } of missed) {
		if (reason.category !== "injury") continue;
		const last = lastOf(injuries);
		const samePeriod =
			last &&
			sameInjury(last.label, reason.label) &&
			!playedDates.some((date) => date > last.endDate && date < gameDate);
		if (samePeriod) {
			// The latest wording knows most: "sore knee" became "knee surgery"
			Object.assign(last, { label: reason.label, endDate: gameDate, games: last.games + 1 });
			last.gameDates.push(gameDate);
			if (reason.report) last.sources.add(reason.report);
		} else {
			injuries.push({
				label: reason.label,
				startDate: gameDate,
				endDate: gameDate,
				games: 1,
				gameDates: [gameDate],
				ongoing: false,
				updates: [],
				spans: [],
				sources: new Set(reason.report ? [reason.report] : []),
			});
		}
	}

	const claimed = new Set<(typeof spans)[number]>();
	for (const injury of injuries) {
		const reachBack = daysBefore(injury.startDate, REPORT_LOOKBACK_DAYS);
		for (const span of spans) {
			const sameTime =
				sameInjury(reportLabel(span.report), injury.label) &&
				span.start <= injury.endDate &&
				span.end >= reachBack;
			if (!claimed.has(span) && (injury.sources.has(span.report) || sameTime)) {
				claimed.add(span);
				injury.spans.push(span);
			}
		}
	}

	for (const span of spans) {
		if (claimed.has(span)) continue;
		const label = reportLabel(span.report);
		const open = injuries.find(
			(injury) =>
				injury.games === 0 && sameInjury(injury.label, label) && span.start <= injury.endDate,
		);
		if (open) {
			open.endDate = span.end > open.endDate ? span.end : open.endDate;
			open.label = label;
			open.spans.push(span);
		} else {
			injuries.push({
				label,
				startDate: span.start,
				endDate: span.end,
				games: 0,
				gameDates: [],
				ongoing: false,
				updates: [],
				spans: [span],
				sources: new Set(),
			});
		}
	}

	return injuries
		.filter(({ games, spans: own }) => games > 0 || own.some(({ report }) => /^out$/i.test(report.status)))
		.map(({ spans: own, sources: _sources, ...injury }) => ({
			...injury,
			startDate: own.reduce((date, span) => (span.start < date ? span.start : date), injury.startDate),
			ongoing: own.some(({ report }) => report.clearedAt === undefined),
			updates: updatesFrom(own.map(({ report }) => report), now),
		}))
		.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/** How much a player has played, and the best reason for the games they didn't */
export function summarizeAvailability(args: {
	/** Every game the player appeared in */
	played: PlayedGame[];
	/** The games their team played that they could have been in */
	teamGames: TeamGame[];
	absences: GameAbsence[];
	reports: InjuryReportEntry[];
	/** The latest the data can know of; open reports run up to it */
	now: number;
}): PlayerAvailability {
	const { now } = args;
	const playedDates = args.played.map((game) => game.gameDate);
	const boxReasons = new Map(args.absences.map((absence) => [absence.gameDate, absence.reason]));
	const startedShare = args.played.filter((game) => game.starter).length / args.played.length;
	const usualStarter =
		args.played.length >= USUAL_STARTER_MIN_GAMES && startedShare >= USUAL_STARTER_SHARE;

	// By date: an absence can be from a former team, outside teamGames
	const missedGames = new Map<string, TeamGame>();
	for (const game of [...args.teamGames, ...args.absences]) {
		if (!playedDates.includes(game.gameDate)) {
			missedGames.set(game.gameDate, { gameDate: game.gameDate, phase: game.phase });
		}
	}
	const missed = [...missedGames.values()].map((game) => ({
		...game,
		reason: bestReason(
			boxReasons.get(game.gameDate),
			reportFor(game.gameDate, args.reports, playedDates, now),
			usualStarter,
		),
	}));

	const games: AvailabilityGame[] = [
		...args.played.map(
			(game): AvailabilityGame => ({
				gameDate: game.gameDate,
				phase: game.phase,
				outcome: game.starter ? "started" : "bench",
			}),
		),
		...missed.map(
			(game): AvailabilityGame => ({
				gameDate: game.gameDate,
				phase: game.phase,
				outcome: "missed",
				reason: game.reason.label,
			}),
		),
	].sort((a, b) => a.gameDate.localeCompare(b.gameDate));

	const regular = games.filter((game) => game.phase === "regular");
	const playedRegular = regular.filter((game) => game.outcome !== "missed").length;
	const playoffGames = games.filter((game) => game.phase === "playoffs");

	return {
		games,
		played: playedRegular,
		started: regular.filter((game) => game.outcome === "started").length,
		missed: regular.length - playedRegular,
		availability: regular.length > 0 ? (playedRegular / regular.length) * 100 : null,
		playoffs:
			playoffGames.length > 0
				? {
						played: playoffGames.filter((game) => game.outcome !== "missed").length,
						games: playoffGames.length,
					}
				: null,
		injuries: buildInjuries(
			missed.sort((a, b) => a.gameDate.localeCompare(b.gameDate)),
			args.reports,
			playedDates,
			games[0]?.gameDate,
			now,
		),
	};
}

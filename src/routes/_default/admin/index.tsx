import { createFileRoute, redirect } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { useState, useEffect } from "react";
import { api } from "~api";
import { Button } from "@/components/ui/button";
import { Check, Loader2, AlertCircle, Trash2, Play, Square, Clock } from "lucide-react";
import { format } from "date-fns";
import { isLeagueInSeason } from "@/lib/seasons";

export const Route = createFileRoute("/_default/admin/")({
	component: AdminPage,
	beforeLoad: async ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/auth/sign-in" });
		}

		const isAdmin = await context.queryClient.ensureQueryData(
			convexQuery(api.admin.checkIsAdmin),
		);

		if (!isAdmin) {
			throw redirect({ to: "/" });
		}
	},
});

// Get the start of week (Sunday at midnight UTC)
function getWeekStartDate(date: Date = new Date()): number {
	const d = new Date(date);
	const day = d.getUTCDay(); // 0 = Sunday
	d.setUTCHours(0, 0, 0, 0);
	d.setUTCDate(d.getUTCDate() - day);
	return d.getTime();
}

// Get the next Sunday at 7:30 AM UTC
function getNextSnapshotTime(): Date {
	const now = new Date();
	const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
	const nextSunday = new Date(now);
	nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
	nextSunday.setUTCHours(7, 30, 0, 0);

	// If it's Sunday and before 7:30 AM UTC, use today
	if (now.getUTCDay() === 0 && now.getUTCHours() < 7) {
		nextSunday.setUTCDate(now.getUTCDate());
	}

	return nextSunday;
}

type ActionStatus = "idle" | "loading" | "success" | "error";

type BackfillStatus = "idle" | "collecting" | "fetching" | "processing" | "complete" | "error";

interface BackfillProgress {
	status: BackfillStatus;
	totalGames: number;
	fetchedGames: number;
	currentDate?: string;
	error?: string;
	startedAt?: number;
	completedAt?: number;
}

const LEAGUE_LABELS: Record<string, string> = {
	nba: "NBA",
	wnba: "WNBA",
	gleague: "G-League",
};

function AdminPage() {
	const [snapshotStatus, setSnapshotStatus] = useState<ActionStatus>("idle");
	const [snapshotResult, setSnapshotResult] = useState<string | null>(null);
	const [clearStatus, setClearStatus] = useState<ActionStatus>("idle");
	const [clearResult, setClearResult] = useState<string | null>(null);
	const [showClearConfirm, setShowClearConfirm] = useState(false);
	const [backfillMessages, setBackfillMessages] = useState<Record<string, string>>({});

	const currentWeek = getWeekStartDate();
	const nextSnapshot = getNextSnapshotTime();

	const { data: coverage, refetch: refetchCoverage } = useQuery({
		...convexQuery(api.statsHistory.getSnapshotCoverage, {}),
		staleTime: 30_000,
	});

	const { data: weekSummary } = useQuery({
		...convexQuery(api.statsHistory.getWeekSnapshotSummary, {
			weekStartDate: currentWeek,
		}),
		staleTime: 30_000,
	});

	const { data: backfillProgress, refetch: refetchBackfillProgress } = useQuery({
		...convexQuery(api.statsHistory.getBackfillProgress, {}),
		staleTime: 5_000, // Refresh frequently during backfill
		refetchInterval: (query) => {
			// Auto-refresh every 5s if any backfill is in progress
			const data = query.state.data as Record<string, BackfillProgress> | undefined;
			if (!data) return false;
			const anyActive = Object.values(data).some(
				(p) => p.status === "fetching" || p.status === "processing"
			);
			return anyActive ? 5000 : false;
		},
	});

	const triggerSnapshot = useAction(api.statsHistory.adminTriggerSnapshot);
	const clearSnapshots = useAction(api.statsHistory.adminClearAllSnapshots);
	const startBackfill = useAction(api.statsHistory.startBackfill);
	const cancelBackfill = useAction(api.statsHistory.cancelBackfill);

	const handleTriggerSnapshot = async () => {
		setSnapshotStatus("loading");
		setSnapshotResult(null);

		try {
			const result = await triggerSnapshot({});

			const leagues = Object.entries(result);
			const summary = leagues
				.map(([league, data]) => {
					const d = data as {
						teams: { captured: number; skipped: number };
						players: { captured: number; skipped: number };
					};
					return `${league.toUpperCase()}: ${d.teams.captured} teams, ${d.players.captured} players`;
				})
				.join(" | ");

			setSnapshotResult(summary);
			setSnapshotStatus("success");
			refetchCoverage();
		} catch (error) {
			setSnapshotStatus("error");
			setSnapshotResult(
				error instanceof Error ? error.message : "Unknown error",
			);
		}
	};

	const handleClearSnapshots = async () => {
		setClearStatus("loading");
		setClearResult(null);
		setShowClearConfirm(false);

		try {
			const result = await clearSnapshots({});
			setClearResult(
				`Deleted ${result.teamsDeleted} team records and ${result.playersDeleted} player records`,
			);
			setClearStatus("success");
			refetchCoverage();
		} catch (error) {
			setClearStatus("error");
			setClearResult(
				error instanceof Error ? error.message : "Unknown error",
			);
		}
	};

	const handleStartBackfill = async (league: "nba" | "wnba" | "gleague") => {
		setBackfillMessages((prev) => ({ ...prev, [league]: "" }));

		try {
			await startBackfill({ league });
			refetchBackfillProgress();
			refetchCoverage();
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error";
			setBackfillMessages((prev) => ({ ...prev, [league]: msg }));
		}
	};

	const handleCancelBackfill = async (league: "nba" | "wnba" | "gleague") => {
		try {
			await cancelBackfill({ league });
			refetchBackfillProgress();
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Unknown error";
			setBackfillMessages((prev) => ({ ...prev, [league]: msg }));
		}
	};

	// Check if any backfill is active
	const anyBackfillActive = backfillProgress
		? Object.values(backfillProgress).some(
				(p) => p.status === "collecting" || p.status === "fetching" || p.status === "processing"
			)
		: false;

	// Get all unique weeks from coverage, sorted descending
	const allWeeks = coverage
		? Array.from(
				new Set([
					...(coverage.nba || []),
					...(coverage.wnba || []),
					...(coverage.gleague || []),
				]),
			).sort((a, b) => b - a)
		: [];

	const hasDataForWeek = (week: number, league: string): boolean => {
		if (!coverage) return false;
		return coverage[league]?.includes(week) ?? false;
	};

	const hasCurrentWeekData =
		weekSummary &&
		((weekSummary.nba?.teams ?? 0) > 0 ||
			(weekSummary.wnba?.teams ?? 0) > 0 ||
			(weekSummary.gleague?.teams ?? 0) > 0);

	return (
		<div className="container py-8">
			<div className="mx-auto max-w-4xl space-y-8">
				<div>
					<h1 className="text-3xl font-bold">Admin Dashboard</h1>
					<p className="mt-1 text-muted-foreground">
						Manage stats snapshots and app settings
					</p>
				</div>

				<div className="rounded-lg border border-border bg-card p-6 space-y-6">
					<div>
						<h2 className="text-xl font-semibold">Stats Snapshot Management</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Snapshots capture current stats to track trends over the season.
							They run automatically every Sunday at 7:30 AM UTC.
						</p>
					</div>

					{/* Next automatic snapshot */}
					<div className="rounded-lg bg-muted/50 p-4">
						<div className="text-sm">
							<span className="text-muted-foreground">
								Next automatic snapshot:
							</span>{" "}
							<span className="font-medium">
								{format(nextSnapshot, "EEEE, MMM d 'at' h:mm a")} UTC
							</span>
						</div>
						<div className="text-sm mt-1">
							<span className="text-muted-foreground">Current week:</span>{" "}
							<span className="font-medium">
								{format(new Date(currentWeek), "MMM d, yyyy")}
							</span>
							{hasCurrentWeekData ? (
								<span className="ml-2 text-green-500">(snapshot exists)</span>
							) : (
								<span className="ml-2 text-muted-foreground">
									(no snapshot yet)
								</span>
							)}
						</div>
					</div>

					{/* Snapshot trigger */}
					<div className="flex flex-wrap items-center gap-4">
						<Button
							onClick={handleTriggerSnapshot}
							disabled={snapshotStatus === "loading"}
						>
							{snapshotStatus === "loading" ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Capturing...
								</>
							) : (
								"Capture Snapshot Now"
							)}
						</Button>
						<span className="text-sm text-muted-foreground">
							Takes a snapshot of current stats for this week
						</span>
					</div>

					{/* Snapshot status message */}
					{snapshotResult && (
						<div
							className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
								snapshotStatus === "success"
									? "bg-green-500/10 text-green-500"
									: "bg-red-500/10 text-red-500"
							}`}
						>
							{snapshotStatus === "success" ? (
								<Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
							) : (
								<AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
							)}
							<span>{snapshotResult}</span>
						</div>
					)}

					{/* Coverage grid */}
					{allWeeks.length > 0 && (
						<div>
							<h3 className="text-sm font-medium mb-3">
								Snapshot History ({allWeeks.length} weeks)
							</h3>
							<div className="overflow-x-auto">
								<table className="w-full text-sm border-collapse">
									<thead>
										<tr className="border-b border-border">
											<th className="text-left py-2 pr-4 font-medium">Week</th>
											<th className="text-center py-2 px-4 font-medium">NBA</th>
											<th className="text-center py-2 px-4 font-medium">
												WNBA
											</th>
											<th className="text-center py-2 px-4 font-medium">
												G-League
											</th>
										</tr>
									</thead>
									<tbody>
										{allWeeks.map((week) => (
											<tr
												key={week}
												className={`border-b border-border/50 ${
													week === currentWeek ? "bg-muted/50" : ""
												}`}
											>
												<td className="py-2 pr-4">
													{format(new Date(week), "MMM d, yyyy")}
													{week === currentWeek && (
														<span className="ml-2 text-xs text-muted-foreground">
															(current)
														</span>
													)}
												</td>
												{(["nba", "wnba", "gleague"] as const).map((league) => (
													<td key={league} className="text-center py-2 px-4">
														{hasDataForWeek(week, league) ? (
															<span className="inline-flex items-center text-green-500">
																<Check className="h-4 w-4" />
															</span>
														) : (
															<span className="text-muted-foreground">-</span>
														)}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{allWeeks.length === 0 && (
						<div className="rounded-lg border border-dashed border-border p-8 text-center">
							<p className="text-muted-foreground">
								No snapshots yet. Capture your first snapshot to start tracking
								trends.
							</p>
						</div>
					)}

					{/* Historical Backfill Section */}
					<div className="border-t border-border pt-6 mt-6">
						<h3 className="text-lg font-semibold mb-2">Historical Backfill</h3>
						<p className="text-sm text-muted-foreground mb-4">
							Fetches ALL season games and calculates snapshots for every week.
							Run once per league. Takes ~70 minutes per league with 5-second
							delays between API calls.
						</p>

						<div className="rounded-lg border border-border overflow-hidden">
							<table className="w-full text-sm">
								<thead>
									<tr className="bg-muted/50 border-b border-border">
										<th className="text-left py-2 px-4 font-medium">League</th>
										<th className="text-left py-2 px-4 font-medium">Status</th>
										<th className="text-left py-2 px-4 font-medium">
											Progress
										</th>
										<th className="text-right py-2 px-4 font-medium">
											Action
										</th>
									</tr>
								</thead>
								<tbody>
									{(["nba", "gleague", "wnba"] as const).map((league) => {
										const progress = backfillProgress?.[league];
										const inSeason = isLeagueInSeason(league);
										const isActive =
											progress?.status === "collecting" ||
											progress?.status === "fetching" ||
											progress?.status === "processing";
										const otherActive =
											anyBackfillActive && !isActive;

										return (
											<tr
												key={league}
												className="border-b border-border/50 last:border-0"
											>
												<td className="py-3 px-4 font-medium">
													{LEAGUE_LABELS[league]}
												</td>
												<td className="py-3 px-4">
													{!inSeason ? (
														<span className="inline-flex items-center gap-1.5 text-muted-foreground">
															<span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
															Offseason
														</span>
													) : progress?.status === "complete" ? (
														<span className="inline-flex items-center gap-1.5 text-green-500">
															<Check className="h-4 w-4" />
															Complete
														</span>
													) : progress?.status === "collecting" ? (
														<span className="inline-flex items-center gap-1.5 text-blue-500">
															<Loader2 className="h-4 w-4 animate-spin" />
															Collecting game IDs...
														</span>
													) : progress?.status === "fetching" ? (
														<span className="inline-flex items-center gap-1.5 text-blue-500">
															<Loader2 className="h-4 w-4 animate-spin" />
															Fetching box scores...
														</span>
													) : progress?.status === "processing" ? (
														<span className="inline-flex items-center gap-1.5 text-blue-500">
															<Loader2 className="h-4 w-4 animate-spin" />
															Processing snapshots...
														</span>
													) : progress?.status === "error" ? (
														<span className="inline-flex items-center gap-1.5 text-red-500">
															<AlertCircle className="h-4 w-4" />
															Error
														</span>
													) : (
														<span className="inline-flex items-center gap-1.5 text-muted-foreground">
															<Clock className="h-4 w-4" />
															Not started
														</span>
													)}
												</td>
												<td className="py-3 px-4">
													{progress?.status === "collecting" && progress ? (
														<div className="space-y-1">
															<div className="text-xs text-muted-foreground">
																Scanning dates for games...
															</div>
															{progress.currentDate && (
																<div className="text-xs text-muted-foreground">
																	Date: {progress.currentDate}
																</div>
															)}
														</div>
													) : progress?.status === "fetching" && progress ? (
														<div className="space-y-1">
															<div className="text-xs text-muted-foreground">
																{progress.fetchedGames} /{" "}
																{progress.totalGames || "?"} games
															</div>
															{progress.totalGames > 0 && (
																<div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
																	<div
																		className="h-full bg-blue-500 transition-all"
																		style={{
																			width: `${Math.round((progress.fetchedGames / progress.totalGames) * 100)}%`,
																		}}
																	/>
																</div>
															)}
														</div>
													) : progress?.status === "processing" ? (
														<div className="text-xs text-muted-foreground">
															Generating weekly snapshots...
														</div>
													) : progress?.status === "error" ? (
														<span className="text-xs text-red-500">
															{progress.error}
														</span>
													) : progress?.status === "complete" &&
													  progress.completedAt ? (
														<span className="text-xs text-muted-foreground">
															Completed{" "}
															{format(
																new Date(progress.completedAt),
																"MMM d, h:mm a"
															)}
														</span>
													) : (
														<span className="text-muted-foreground">-</span>
													)}
												</td>
												<td className="py-3 px-4 text-right">
													{!inSeason ? (
														<span className="text-sm text-muted-foreground">
															-
														</span>
													) : isActive ? (
														<Button
															variant="outline"
															size="sm"
															onClick={() => handleCancelBackfill(league)}
															className="text-red-500 border-red-500/50 hover:bg-red-500/10"
														>
															<Square className="h-3 w-3 mr-1" />
															Cancel
														</Button>
													) : (
														<Button
															variant="outline"
															size="sm"
															onClick={() => handleStartBackfill(league)}
															disabled={otherActive}
															title={
																otherActive
																	? "Wait for other backfill to complete"
																	: undefined
															}
														>
															<Play className="h-3 w-3 mr-1" />
															Start Backfill
														</Button>
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>

						{/* Backfill messages */}
						{Object.entries(backfillMessages).map(
							([league, message]) =>
								message && (
									<div
										key={league}
										className="mt-3 flex items-start gap-2 rounded-lg p-3 text-sm bg-red-500/10 text-red-500"
									>
										<AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
										<span>
											{LEAGUE_LABELS[league]}: {message}
										</span>
									</div>
								)
						)}

						<div className="mt-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
							<p className="text-sm text-yellow-600 dark:text-yellow-500">
								<strong>Important:</strong> Wait at least 24 hours between
								running backfills for different leagues to avoid API rate
								limiting. Each backfill takes ~70 minutes for NBA, ~40 minutes
								for G-League.
							</p>
						</div>
					</div>

					{/* Danger zone */}
					{allWeeks.length > 0 && (
						<div className="border-t border-border pt-6 mt-6">
							<h3 className="text-sm font-medium text-red-500 mb-3">
								Danger Zone
							</h3>

							{!showClearConfirm ? (
								<Button
									variant="outline"
									onClick={() => setShowClearConfirm(true)}
									className="text-red-500 border-red-500/50 hover:bg-red-500/10"
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Clear All Snapshots
								</Button>
							) : (
								<div className="flex items-center gap-4">
									<span className="text-sm text-muted-foreground">
										Are you sure? This cannot be undone.
									</span>
									<Button
										variant="destructive"
										onClick={handleClearSnapshots}
										disabled={clearStatus === "loading"}
									>
										{clearStatus === "loading" ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Clearing...
											</>
										) : (
											"Yes, Clear All"
										)}
									</Button>
									<Button
										variant="ghost"
										onClick={() => setShowClearConfirm(false)}
									>
										Cancel
									</Button>
								</div>
							)}

							{/* Clear status message */}
							{clearResult && (
								<div
									className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${
										clearStatus === "success"
											? "bg-green-500/10 text-green-500"
											: "bg-red-500/10 text-red-500"
									}`}
								>
									{clearStatus === "success" ? (
										<Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
									) : (
										<AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
									)}
									<span>{clearResult}</span>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

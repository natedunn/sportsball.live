import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "~api";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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

const LEAGUES = ["nba", "wnba", "gleague"] as const;
type League = (typeof LEAGUES)[number];

const LEAGUE_LABELS: Record<League, string> = {
	nba: "NBA",
	wnba: "WNBA",
	gleague: "G-League",
};

const STEP_LABELS: Record<string, string> = {
	teams: "Teams",
	players: "Players",
	backfill: "Game Backfill",
	recalculate: "Recalculate Stats",
};

const STATUS_STYLES: Record<string, string> = {
	idle: "text-muted-foreground",
	running: "text-amber-600 dark:text-amber-400",
	cancelling: "text-orange-600 dark:text-orange-400",
	completed: "text-green-600 dark:text-green-400",
	failed: "text-red-600 dark:text-red-400",
};

function AdminPage() {
	return (
		<div className="container py-8">
			<div className="mx-auto max-w-4xl space-y-8">
				<div>
					<h1 className="text-3xl font-bold">Admin Dashboard</h1>
					<p className="mt-1 text-muted-foreground">
						Bootstrap controls and data management.
					</p>
				</div>

				<div className="space-y-4">
					{LEAGUES.map((league) => (
						<LeagueCard key={league} league={league} />
					))}
				</div>
			</div>
		</div>
	);
}

function LeagueCard({ league }: { league: League }) {
	const [error, setError] = useState<string | null>(null);

	const { data: statuses } = useQuery(
		convexQuery(api.bootstrapAdmin.getAllBootstrapStatuses, {}),
	);

	const { data: counts } = useQuery(
		convexQuery(api.bootstrapAdmin.getDataCounts, { league }),
	);

	const startMutation = useConvexMutation(api.bootstrapAdmin.startBootstrap);
	const cancelMutation = useConvexMutation(api.bootstrapAdmin.cancelBootstrap);

	const status = statuses?.[league];
	const isRunning = status?.status === "running";
	const isCancelling = status?.status === "cancelling";
	const isBusy = isRunning || isCancelling;

	const handleStart = async () => {
		setError(null);
		try {
			await startMutation({ league });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to start");
		}
	};

	const handleCancel = async () => {
		setError(null);
		try {
			await cancelMutation({ league });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to cancel");
		}
	};

	return (
		<div className="rounded-xl border border-border bg-card p-6">
			<div className="flex items-start justify-between">
				<div>
					<h2 className="text-xl font-semibold">{LEAGUE_LABELS[league]}</h2>
					{counts && (
						<p className="mt-1 text-sm text-muted-foreground">
							{counts.teams} teams &middot; {counts.players} players &middot;{" "}
							{counts.games} games
							<span className="ml-2 text-xs">({counts.season})</span>
						</p>
					)}
				</div>

				<div className="flex gap-2">
					{isBusy ? (
						<Button
							variant="destructive"
							size="sm"
							onClick={handleCancel}
							disabled={isCancelling}
						>
							{isCancelling ? "Cancelling..." : "Cancel"}
						</Button>
					) : (
						<Button size="sm" onClick={handleStart}>
							Start Bootstrap
						</Button>
					)}
				</div>
			</div>

			{status && status.status !== "idle" && (
				<div className="mt-4 rounded-lg border border-border/50 bg-muted/50 px-4 py-3">
					<div className="flex items-center gap-2">
						{isRunning && (
							<span className="relative flex h-2.5 w-2.5">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
								<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
							</span>
						)}
						<span
							className={`text-sm font-medium capitalize ${STATUS_STYLES[status.status] ?? ""}`}
						>
							{status.status}
						</span>
						{status.currentStep && (
							<span className="text-sm text-muted-foreground">
								&mdash; {STEP_LABELS[status.currentStep] ?? status.currentStep}
							</span>
						)}
					</div>

					{status.progress && (
						<p className="mt-1 text-sm text-muted-foreground">
							{status.progress}
						</p>
					)}

					{status.error && (
						<p className="mt-1 text-sm text-red-600 dark:text-red-400">
							{status.error}
						</p>
					)}

					{status.startedAt && (
						<p className="mt-2 text-xs text-muted-foreground">
							Started: {new Date(status.startedAt).toLocaleString()}
							{status.completedAt && (
								<>
									{" "}
									&middot; Finished:{" "}
									{new Date(status.completedAt).toLocaleString()}
								</>
							)}
						</p>
					)}
				</div>
			)}

			{error && (
				<p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
			)}
		</div>
	);
}

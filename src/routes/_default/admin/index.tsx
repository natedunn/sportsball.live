import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import {
	useSuspenseQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "~api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type League = "nba" | "wnba" | "gleague";

const LEAGUES: { value: League; label: string }[] = [
	{ value: "nba", label: "NBA" },
	{ value: "wnba", label: "WNBA" },
	{ value: "gleague", label: "G League" },
];

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

function AdminPage() {
	return (
		<div className="container py-8">
			<div className="mx-auto max-w-4xl space-y-8">
				<div>
					<h1 className="text-3xl font-bold">Admin Dashboard</h1>
					<p className="mt-1 text-muted-foreground">
						Manage seasons and app settings
					</p>
				</div>

				<SeasonManager />
			</div>
		</div>
	);
}

function SeasonManager() {
	const [selectedLeague, setSelectedLeague] = useState<League>("nba");
	const [isCreating, setIsCreating] = useState(false);

	const { data: seasons = [] } = useSuspenseQuery(
		convexQuery(api.admin.getSeasonsByLeague, { league: selectedLeague }),
	);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-semibold">Season Management</h2>
				<Button onClick={() => setIsCreating(true)} disabled={isCreating}>
					Add Season
				</Button>
			</div>

			{/* League Tabs */}
			<div className="flex gap-2">
				{LEAGUES.map((league) => (
					<button
						key={league.value}
						onClick={() => setSelectedLeague(league.value)}
						className={cn(
							"rounded-lg px-4 py-2 text-sm font-medium transition-colors",
							selectedLeague === league.value
								? "bg-primary text-primary-foreground"
								: "bg-muted hover:bg-muted/80",
						)}
					>
						{league.label}
					</button>
				))}
			</div>

			{/* Create Form */}
			{isCreating && (
				<SeasonForm
					league={selectedLeague}
					onCancel={() => setIsCreating(false)}
					onSuccess={() => setIsCreating(false)}
				/>
			)}

			{/* Seasons List */}
			<div className="space-y-3">
				{seasons.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground">
						No seasons configured for {selectedLeague.toUpperCase()}
					</p>
				) : (
					seasons.map((season) => (
						<SeasonCard key={season._id} season={season} />
					))
				)}
			</div>
		</div>
	);
}

interface SeasonFormProps {
	league: League;
	onCancel: () => void;
	onSuccess: () => void;
	initialData?: {
		_id: string;
		name: string;
		startDate: string;
		endDate: string;
		isActive: boolean;
	};
}

function SeasonForm({
	league,
	onCancel,
	onSuccess,
	initialData,
}: SeasonFormProps) {
	const [name, setName] = useState(initialData?.name ?? "");
	const [startDate, setStartDate] = useState(initialData?.startDate ?? "");
	const [endDate, setEndDate] = useState(initialData?.endDate ?? "");
	const [isActive, setIsActive] = useState(initialData?.isActive ?? false);

	const queryClient = useQueryClient();

	const createMutation = useConvexMutation(api.admin.createSeason);
	const updateMutation = useConvexMutation(api.admin.updateSeason);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			if (initialData) {
				await updateMutation({
					id: initialData._id as any,
					name,
					startDate,
					endDate,
					isActive,
				});
			} else {
				await createMutation({
					league,
					name,
					startDate,
					endDate,
					isActive,
				});
			}
			queryClient.invalidateQueries({ queryKey: ["admin"] });
			onSuccess();
		} catch (error) {
			console.error("Failed to save season:", error);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-4 rounded-lg border border-border bg-card p-4"
		>
			<h3 className="font-semibold">
				{initialData ? "Edit Season" : "New Season"} ({league.toUpperCase()})
			</h3>

			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-sm font-medium">Season Name</label>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g., 2024-25"
						className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						required
					/>
				</div>

				<div className="flex items-center gap-2 self-end">
					<input
						type="checkbox"
						id="isActive"
						checked={isActive}
						onChange={(e) => setIsActive(e.target.checked)}
						className="h-4 w-4"
					/>
					<label htmlFor="isActive" className="text-sm font-medium">
						Active Season
					</label>
				</div>

				<div>
					<label className="mb-1 block text-sm font-medium">Start Date</label>
					<input
						type="date"
						value={startDate}
						onChange={(e) => setStartDate(e.target.value)}
						className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						required
					/>
				</div>

				<div>
					<label className="mb-1 block text-sm font-medium">End Date</label>
					<input
						type="date"
						value={endDate}
						onChange={(e) => setEndDate(e.target.value)}
						className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						required
					/>
				</div>
			</div>

			<div className="flex justify-end gap-2">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit">
					{initialData ? "Save Changes" : "Create Season"}
				</Button>
			</div>
		</form>
	);
}

interface SeasonCardProps {
	season: {
		_id: any;
		league: League;
		name: string;
		startDate: string;
		endDate: string;
		isActive: boolean;
		createdAt: number;
		updatedAt: number;
	};
}

function SeasonCard({ season }: SeasonCardProps) {
	const [isEditing, setIsEditing] = useState(false);
	const queryClient = useQueryClient();
	const deleteMutation = useConvexMutation(api.admin.deleteSeason);

	const handleDelete = async () => {
		if (!confirm("Are you sure you want to delete this season?")) return;

		try {
			await deleteMutation({ id: season._id });
			queryClient.invalidateQueries({ queryKey: ["admin"] });
		} catch (error) {
			console.error("Failed to delete season:", error);
		}
	};

	if (isEditing) {
		return (
			<SeasonForm
				league={season.league}
				initialData={{
					_id: season._id,
					name: season.name,
					startDate: season.startDate,
					endDate: season.endDate,
					isActive: season.isActive,
				}}
				onCancel={() => setIsEditing(false)}
				onSuccess={() => setIsEditing(false)}
			/>
		);
	}

	return (
		<div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
			<div className="space-y-1">
				<div className="flex items-center gap-2">
					<span className="font-semibold">{season.name}</span>
					{season.isActive && (
						<span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
							Active
						</span>
					)}
				</div>
				<p className="text-sm text-muted-foreground">
					{season.startDate} to {season.endDate}
				</p>
			</div>

			<div className="flex gap-2">
				<Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
					Edit
				</Button>
				<Button variant="destructive" size="sm" onClick={handleDelete}>
					Delete
				</Button>
			</div>
		</div>
	);
}

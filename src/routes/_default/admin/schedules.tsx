import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Calendar, ChevronDown, Pencil, Plus, Save, X } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "~api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Doc } from "@convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { AdminPageShell } from "./-components/admin-page-shell";

export const Route = createFileRoute("/_default/admin/schedules")({
	component: AdminSchedulesPage,
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
type SeasonType = "tournament" | "pre-season" | "regular-season" | "playoffs";
type SeasonStatus = "confirmed" | "estimated";
type SeasonForm = Omit<Doc<"seasons">, "_id" | "_creationTime" | "updatedAt">;

const LEAGUE_LABELS: Record<League, string> = {
	nba: "NBA",
	wnba: "WNBA",
	gleague: "G-League",
};

const TYPE_LABELS: Record<SeasonType, string> = {
	tournament: "Tournament",
	"pre-season": "Preseason",
	"regular-season": "Regular season",
	playoffs: "Playoffs",
};

const TYPE_ORDER: SeasonType[] = [
	"tournament",
	"pre-season",
	"regular-season",
	"playoffs",
];

const YEAR_OPTIONS = createYearOptions();

function AdminSchedulesPage() {
	const { data: seasons } = useQuery(convexQuery(api.seasons.list, {}));
	const [selectedLeague, setSelectedLeague] = useState<League>("nba");
	const groupedSeasons = useMemo(() => {
		const groups: Record<League, Doc<"seasons">[]> = {
			nba: [],
			wnba: [],
			gleague: [],
		};

		for (const season of seasons ?? []) {
			groups[season.league].push(season);
		}

		for (const league of LEAGUES) {
			groups[league].sort((a, b) => {
				if (a.startYear !== b.startYear) return b.startYear - a.startYear;
				if (a.endYear !== b.endYear) return b.endYear - a.endYear;
				const aOrder = TYPE_ORDER.indexOf(a.type as SeasonType);
				const bOrder = TYPE_ORDER.indexOf(b.type as SeasonType);
				return aOrder - bOrder;
			});
		}

		return groups;
	}, [seasons]);

	return (
		<AdminPageShell
			activePage="schedules"
			title="Season Schedules"
			description="Set date ranges for league season segments and data navigation."
		>
			<Tabs
				value={selectedLeague}
				onValueChange={(value) => setSelectedLeague(value as League)}
				className="space-y-6"
			>
				<TabsList>
					{LEAGUES.map((league) => (
						<TabsTrigger key={league} value={league}>
							{LEAGUE_LABELS[league]}
						</TabsTrigger>
					))}
				</TabsList>

				{LEAGUES.map((league) => (
					<TabsContent key={league} value={league} className="mt-0">
						<LeagueScheduleSection
							league={league}
							seasons={groupedSeasons[league]}
						/>
					</TabsContent>
				))}
			</Tabs>
		</AdminPageShell>
	);
}

// ---------------------------------------------------------------------------
// League section — header + accordion groups
// ---------------------------------------------------------------------------

function LeagueScheduleSection({
	league,
	seasons,
}: {
	league: League;
	seasons: Doc<"seasons">[];
}) {
	const [isAdding, setIsAdding] = useState(false);

	const yearGroups = useMemo(() => {
		const map = new Map<
			string,
			{ startYear: number; endYear: number; segments: Doc<"seasons">[] }
		>();

		for (const season of seasons) {
			const key = `${season.startYear}:${season.endYear}`;
			if (!map.has(key)) {
				map.set(key, {
					startYear: season.startYear,
					endYear: season.endYear,
					segments: [],
				});
			}
			map.get(key)!.segments.push(season);
		}

		return Array.from(map.values());
	}, [seasons]);

	return (
		<section className="space-y-3">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-xl font-semibold">{LEAGUE_LABELS[league]}</h2>
					<p className="text-sm text-muted-foreground">
						{seasons.length} configured segment
						{seasons.length === 1 ? "" : "s"} across {yearGroups.length} season
						{yearGroups.length === 1 ? "" : "s"}
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setIsAdding(true)}
					disabled={isAdding}
				>
					<Plus />
					Add Segment
				</Button>
			</div>

			{/* New segment form */}
			{isAdding && (
				<div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4">
					<p className="mb-3 text-sm font-medium text-primary">New Segment</p>
					<SeasonSegmentForm
						initialForm={createNewSeasonForm(league, seasons[0])}
						onSaved={() => setIsAdding(false)}
						onCancel={() => setIsAdding(false)}
					/>
				</div>
			)}

			{/* Year-group accordions */}
			<div className="space-y-2">
				{yearGroups.map((group) => (
					<YearGroupAccordion
						key={`${group.startYear}:${group.endYear}`}
						startYear={group.startYear}
						endYear={group.endYear}
						segments={group.segments}
						defaultOpen={yearGroups.indexOf(group) === 0}
					/>
				))}
			</div>
		</section>
	);
}

// ---------------------------------------------------------------------------
// Year-group accordion
// ---------------------------------------------------------------------------

function YearGroupAccordion({
	startYear,
	endYear,
	segments,
	defaultOpen,
}: {
	startYear: number;
	endYear: number;
	segments: Doc<"seasons">[];
	defaultOpen: boolean;
}) {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const confirmedCount = segments.filter((s) => s.status === "confirmed").length;
	const estimatedCount = segments.length - confirmedCount;

	return (
		<div className="overflow-hidden rounded-lg border border-border">
			{/* Accordion header */}
			<button
				type="button"
				onClick={() => setIsOpen((prev) => !prev)}
				className="flex w-full items-center gap-3 bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted"
			>
				<ChevronDown
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform duration-200",
						!isOpen && "-rotate-90",
					)}
				/>
				<div className="flex flex-1 items-center gap-3">
					<span className="text-sm font-semibold">
						{formatYearRange(startYear, endYear)}
					</span>
					<span className="text-xs text-muted-foreground">
						{segments.length} segment{segments.length === 1 ? "" : "s"}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{confirmedCount > 0 && (
						<StatusPill status="confirmed" count={confirmedCount} />
					)}
					{estimatedCount > 0 && (
						<StatusPill status="estimated" count={estimatedCount} />
					)}
				</div>
			</button>

			{/* Accordion body */}
			{isOpen && (
				<div className="divide-y divide-border">
					{segments.map((segment) => (
						<SegmentRow key={segment._id} segment={segment} />
					))}
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Segment row — summary + expandable edit form
// ---------------------------------------------------------------------------

function SegmentRow({ segment }: { segment: Doc<"seasons"> }) {
	const [isEditing, setIsEditing] = useState(false);

	return (
		<div className="bg-card">
			{/* Summary row */}
			<div className="flex items-center gap-3 px-4 py-3">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					<Calendar className="size-4 shrink-0 text-muted-foreground" />
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
							<span className="text-sm font-medium">{segment.name}</span>
							<TypeBadge type={segment.type as SeasonType} />
						</div>
						<p className="mt-0.5 text-xs text-muted-foreground">
							{formatDisplayDate(segment.startDate)} &mdash;{" "}
							{formatDisplayDate(segment.endDate)}
						</p>
					</div>
				</div>
				<StatusBadge status={segment.status as SeasonStatus} />
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8 shrink-0"
					onClick={() => setIsEditing((prev) => !prev)}
					aria-label={isEditing ? "Close editor" : "Edit segment"}
				>
					{isEditing ? (
						<X className="size-4" />
					) : (
						<Pencil className="size-4" />
					)}
				</Button>
			</div>

			{/* Inline edit form */}
			{isEditing && (
				<div className="border-t border-border bg-muted/30 px-4 py-4">
					<SeasonSegmentForm
						season={segment}
						initialForm={toForm(segment)}
						onSaved={() => setIsEditing(false)}
					/>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Badges & pills
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: SeasonStatus }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
				status === "confirmed"
					? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
					: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
			)}
		>
			{status === "confirmed" ? "Confirmed" : "Estimated"}
		</span>
	);
}

function StatusPill({
	status,
	count,
}: {
	status: SeasonStatus;
	count: number;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
				status === "confirmed"
					? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
					: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
			)}
		>
			{count} {status}
		</span>
	);
}

function TypeBadge({ type }: { type: SeasonType }) {
	return (
		<span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
			{TYPE_LABELS[type]}
		</span>
	);
}

// ---------------------------------------------------------------------------
// Edit form — shared between new-segment and edit-existing
// ---------------------------------------------------------------------------

function SeasonSegmentForm({
	season,
	initialForm,
	onSaved,
	onCancel,
}: {
	season?: Doc<"seasons">;
	initialForm: SeasonForm;
	onSaved?: () => void;
	onCancel?: () => void;
}) {
	const [form, setForm] = useState<SeasonForm>(() => initialForm);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const upsertSeason = useConvexMutation(api.seasons.upsert);

	useEffect(() => {
		setForm(initialForm);
	}, [initialForm]);

	const isNew = !season;
	const isDirty = isNew || JSON.stringify(form) !== JSON.stringify(initialForm);

	const handleSubmit = useCallback(
		async (event: FormEvent) => {
			event.preventDefault();
			setError(null);
			setMessage(null);
			setIsSaving(true);

			try {
				await upsertSeason(form);
				setMessage("Saved");
				onSaved?.();
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to save segment",
				);
			} finally {
				setIsSaving(false);
			}
		},
		[form, upsertSeason, onSaved],
	);

	const inputClass =
		"h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1";

	return (
		<form onSubmit={handleSubmit}>
			<div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
				{/* Row 1 — Years & Name */}
				<label className="grid gap-1.5 text-sm font-medium">
					<span className="text-muted-foreground">Start year</span>
					<select
						value={form.startYear}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								startYear: Number(event.target.value),
							}))
						}
						className={inputClass}
					>
						{yearOptionsWithCurrent(form.startYear).map((year) => (
							<option key={year} value={year}>
								{year}
							</option>
						))}
					</select>
				</label>
				<label className="grid gap-1.5 text-sm font-medium">
					<span className="text-muted-foreground">End year</span>
					<select
						value={form.endYear}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								endYear: Number(event.target.value),
							}))
						}
						className={inputClass}
					>
						{yearOptionsWithCurrent(form.endYear).map((year) => (
							<option key={year} value={year}>
								{year}
							</option>
						))}
					</select>
				</label>
				<label className="grid gap-1.5 text-sm font-medium">
					<span className="text-muted-foreground">Name</span>
					<input
						value={form.name}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								name: event.target.value,
							}))
						}
						className={inputClass}
					/>
				</label>

				{/* Row 2 — Type, Status & Dates */}
				<label className="grid gap-1.5 text-sm font-medium">
					<span className="text-muted-foreground">Type</span>
					<select
						value={form.type}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								type: event.target.value as SeasonType,
								name: TYPE_LABELS[event.target.value as SeasonType],
							}))
						}
						className={inputClass}
					>
						{Object.entries(TYPE_LABELS).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</label>
				<label className="grid gap-1.5 text-sm font-medium">
					<span className="text-muted-foreground">Start date</span>
					<input
						type="date"
						value={form.startDate}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								startDate: event.target.value,
							}))
						}
						className={inputClass}
					/>
				</label>
				<label className="grid gap-1.5 text-sm font-medium">
					<span className="text-muted-foreground">End date</span>
					<input
						type="date"
						value={form.endDate}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								endDate: event.target.value,
							}))
						}
						className={inputClass}
					/>
				</label>

				{/* Row 3 — Status */}
				<label className="grid gap-1.5 text-sm font-medium">
					<span className="text-muted-foreground">Status</span>
					<select
						value={form.status}
						onChange={(event) =>
							setForm((current) => ({
								...current,
								status: event.target.value as SeasonStatus,
							}))
						}
						className={inputClass}
					>
						<option value="confirmed">Confirmed</option>
						<option value="estimated">Estimated</option>
					</select>
				</label>
			</div>

			{/* Actions */}
			<div className="mt-4 flex items-center justify-end gap-3">
				{message && (
					<p className="text-sm font-medium text-green-600 dark:text-green-400">
						{message}
					</p>
				)}
				{error && (
					<p className="text-sm font-medium text-red-600 dark:text-red-400">
						{error}
					</p>
				)}
				{onCancel && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onCancel}
						disabled={isSaving}
					>
						Cancel
					</Button>
				)}
				<Button type="submit" size="sm" disabled={!isDirty || isSaving}>
					<Save />
					{isSaving ? "Saving..." : "Save"}
				</Button>
			</div>
		</form>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toForm(season: Doc<"seasons">): SeasonForm {
	return {
		league: season.league,
		startYear: season.startYear,
		endYear: season.endYear,
		name: season.name,
		type: season.type,
		startDate: season.startDate,
		endDate: season.endDate,
		status: season.status,
	};
}

function createNewSeasonForm(
	league: League,
	latestSeason?: Doc<"seasons">,
): SeasonForm {
	const currentYear = new Date().getFullYear();
	const startYear = latestSeason ? latestSeason.startYear + 1 : currentYear;
	const endYear = latestSeason ? latestSeason.endYear + 1 : currentYear;

	return {
		league,
		startYear,
		endYear,
		name: "Regular season",
		type: "regular-season",
		startDate: `${startYear}-10-01`,
		endDate: `${endYear}-04-15`,
		status: "estimated",
	};
}

function createYearOptions() {
	const currentYear = new Date().getFullYear();
	const startYear = currentYear - 2;
	const endYear = currentYear + 10;
	const options: number[] = [];

	for (let year = startYear; year <= endYear; year++) {
		options.push(year);
	}

	return options;
}

function yearOptionsWithCurrent(year: number) {
	return YEAR_OPTIONS.includes(year)
		? YEAR_OPTIONS
		: [...YEAR_OPTIONS, year].sort((a, b) => a - b);
}

function formatYearRange(startYear: number, endYear: number) {
	return startYear === endYear ? String(startYear) : `${startYear}-${endYear}`;
}

function formatDisplayDate(dateStr: string) {
	try {
		const [year, month, day] = dateStr.split("-").map(Number);
		const date = new Date(year, month - 1, day);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	} catch {
		return dateStr;
	}
}

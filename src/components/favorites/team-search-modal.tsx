import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Search } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogBody,
} from "@/components/ui/dialog";
import { Image } from "@/components/ui/image";
import { FavoriteStar } from "@/components/ui/favorite-star";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFavorites } from "@/lib/use-favorites";
import { getAllTeams } from "@/lib/teams";
import type { TeamStaticData, League } from "@/lib/teams/types";

interface TeamSearchModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface TeamItemProps {
	team: TeamStaticData;
	league: League;
	isFavorited: boolean;
	onToggle: () => void;
	tabIndex: number;
	onKeyDown: (e: React.KeyboardEvent) => void;
	buttonRef: (el: HTMLButtonElement | null) => void;
}

function TeamItem({
	team,
	league,
	isFavorited,
	onToggle,
	tabIndex,
	onKeyDown,
	buttonRef,
}: TeamItemProps) {
	const logoUrl = `/api/${league}/logo/${team.logoSlug}`;
	const actionLabel = isFavorited
		? `Remove ${team.fullName} from favorites`
		: `Add ${team.fullName} to favorites`;

	return (
		<button
			ref={buttonRef}
			type="button"
			onClick={onToggle}
			onKeyDown={onKeyDown}
			tabIndex={tabIndex}
			aria-pressed={isFavorited}
			aria-label={actionLabel}
			className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-left w-full"
		>
			<Image
				src={logoUrl}
				alt=""
				width={32}
				height={32}
				className="size-8 object-contain"
				aria-hidden="true"
			/>
			<div className="flex flex-1 flex-col">
				<span className="text-sm font-medium">{team.fullName}</span>
				<span className="text-xs text-muted-foreground">
					{team.abbreviation}
				</span>
			</div>
			<FavoriteStar isFavorited={isFavorited} size="md" />
		</button>
	);
}

interface TeamGridProps {
	teams: Array<{ team: TeamStaticData; league: League }>;
	isFavorited: (league: League, teamId: string) => boolean;
	toggleFavorite: (league: League, teamId: string, teamSlug: string) => void;
}

function TeamGrid({ teams, isFavorited, toggleFavorite }: TeamGridProps) {
	const [focusedIndex, setFocusedIndex] = useState(0);
	const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const gridRef = useRef<HTMLDivElement>(null);

	// Reset focused index when teams change
	useEffect(() => {
		setFocusedIndex(0);
	}, [teams.length]);

	// Detect number of columns based on grid layout
	const getColumnCount = useCallback(() => {
		if (!gridRef.current || buttonRefs.current.length < 2) return 1;
		const first = buttonRefs.current[0];
		const second = buttonRefs.current[1];
		if (!first || !second) return 1;
		// If both items have the same top offset, they're in the same row (2 columns)
		return first.offsetTop === second.offsetTop ? 2 : 1;
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent, index: number) => {
			const cols = getColumnCount();
			const total = teams.length;
			let newIndex = index;

			switch (e.key) {
				case "ArrowRight":
					e.preventDefault();
					newIndex = index + 1;
					if (newIndex >= total) newIndex = 0; // Wrap to start
					break;
				case "ArrowLeft":
					e.preventDefault();
					newIndex = index - 1;
					if (newIndex < 0) newIndex = total - 1; // Wrap to end
					break;
				case "ArrowDown":
					e.preventDefault();
					newIndex = index + cols;
					if (newIndex >= total) {
						// Wrap to top, same column
						newIndex = index % cols;
					}
					break;
				case "ArrowUp":
					e.preventDefault();
					newIndex = index - cols;
					if (newIndex < 0) {
						// Wrap to bottom, same column
						const col = index % cols;
						const lastRowStart = Math.floor((total - 1) / cols) * cols;
						newIndex = lastRowStart + col;
						if (newIndex >= total) newIndex = total - 1;
					}
					break;
				case "Home":
					e.preventDefault();
					newIndex = 0;
					break;
				case "End":
					e.preventDefault();
					newIndex = total - 1;
					break;
				default:
					return;
			}

			setFocusedIndex(newIndex);
			buttonRefs.current[newIndex]?.focus();
		},
		[teams.length, getColumnCount],
	);

	const setButtonRef = useCallback(
		(index: number) => (el: HTMLButtonElement | null) => {
			buttonRefs.current[index] = el;
		},
		[],
	);

	if (teams.length === 0) {
		return (
			<p
				className="flex items-center justify-center py-8 text-muted-foreground"
				role="status"
			>
				No teams found
			</p>
		);
	}

	return (
		<div
			ref={gridRef}
			className="-m-1 grid max-h-[50vh] gap-2 overflow-y-auto p-1 sm:grid-cols-2"
			role="listbox"
			aria-label="Teams"
			aria-activedescendant={`team-${teams[focusedIndex]?.league}-${teams[focusedIndex]?.team.api.id}`}
		>
			{teams.map(({ team, league }, index) => (
				<div
					key={`${league}-${team.api.id}`}
					role="option"
					id={`team-${league}-${team.api.id}`}
					aria-selected={isFavorited(league, team.api.id)}
				>
					<TeamItem
						team={team}
						league={league}
						isFavorited={isFavorited(league, team.api.id)}
						onToggle={() => toggleFavorite(league, team.api.id, team.api.slug)}
						tabIndex={index === focusedIndex ? 0 : -1}
						onKeyDown={(e) => handleKeyDown(e, index)}
						buttonRef={setButtonRef(index)}
					/>
				</div>
			))}
		</div>
	);
}

export function TeamSearchModal({ open, onOpenChange }: TeamSearchModalProps) {
	const [search, setSearch] = useState("");
	const [selectedLeague, setSelectedLeague] = useState<"all" | League>("all");
	const { isFavorited, toggleFavorite } = useFavorites();

	// Get all teams from all leagues
	const allTeams = useMemo(() => {
		const leagues: League[] = ["nba", "wnba", "gleague"];
		const teams: Array<{ team: TeamStaticData; league: League }> = [];

		for (const league of leagues) {
			const leagueTeams = getAllTeams(league);
			for (const team of leagueTeams) {
				teams.push({ team, league });
			}
		}

		// Sort alphabetically by full name
		return teams.sort((a, b) => a.team.fullName.localeCompare(b.team.fullName));
	}, []);

	// Filter teams based on search and league
	const filteredTeams = useMemo(() => {
		let teams = allTeams;

		// Filter by league
		if (selectedLeague !== "all") {
			teams = teams.filter(({ league }) => league === selectedLeague);
		}

		// Filter by search
		if (search.trim()) {
			const query = search.toLowerCase();
			teams = teams.filter(({ team }) => {
				return (
					team.fullName.toLowerCase().includes(query) ||
					team.name.toLowerCase().includes(query) ||
					team.city.toLowerCase().includes(query) ||
					team.abbreviation.toLowerCase().includes(query)
				);
			});
		}

		return teams;
	}, [allTeams, selectedLeague, search]);

	// Reset search when modal closes
	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			setSearch("");
			setSelectedLeague("all");
		}
		onOpenChange(newOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Add Favorite Team</DialogTitle>
				</DialogHeader>
				<DialogBody className="space-y-4">
					{/* Search input */}
					<div className="relative">
						<label htmlFor="team-search" className="sr-only">
							Search teams
						</label>
						<Search
							className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
							aria-hidden="true"
						/>
						<input
							id="team-search"
							type="search"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search teams..."
							className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							autoFocus
							autoComplete="off"
						/>
					</div>

					{/* League tabs */}
					<Tabs
						value={selectedLeague}
						onValueChange={(v) => setSelectedLeague(v as "all" | League)}
					>
						<TabsList className="w-full" responsive={false}>
							<TabsTrigger value="all" className="flex-1">
								All
							</TabsTrigger>
							<TabsTrigger value="nba" className="flex-1">
								NBA
							</TabsTrigger>
							<TabsTrigger value="wnba" className="flex-1">
								WNBA
							</TabsTrigger>
							<TabsTrigger value="gleague" className="flex-1">
								G League
							</TabsTrigger>
						</TabsList>

						<div className="mt-4">
							<TeamGrid
								teams={filteredTeams}
								isFavorited={isFavorited}
								toggleFavorite={toggleFavorite}
							/>
						</div>
					</Tabs>
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}

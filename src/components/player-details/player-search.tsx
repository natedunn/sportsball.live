import { useEffect, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { League } from "@/lib/shared/league";
import { api } from "~api";

export interface PlayerOption {
	id: string;
	name: string;
	team: string;
	position: string;
}

const searchPlayersQueries = {
	nba: api.nba.queries.searchPlayers,
	wnba: api.wnba.queries.searchPlayers,
	gleague: api.gleague.queries.searchPlayers,
};

function useDebouncedValue<T>(value: T, delay: number) {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = window.setTimeout(() => setDebounced(value), delay);
		return () => window.clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}

interface PlayerSearchProps {
	id?: string;
	league: League;
	season: string;
	/** Left out of the results (the player whose page this is) */
	excludeId?: string;
	value: PlayerOption | null;
	onValueChange: (player: PlayerOption | null) => void;
	placeholder?: string;
	className?: string;
}

/** Searches the league's players by name as you type */
export function PlayerSearch({
	id,
	league,
	season,
	excludeId,
	value,
	onValueChange,
	placeholder = "Search players",
	className,
}: PlayerSearchProps) {
	const [inputValue, setInputValue] = useState(value?.name ?? "");
	const term = useDebouncedValue(inputValue.trim(), 200);
	// Once a player is picked the input holds their name; don't search for it
	const searchTerm = value && term === value.name ? "" : term;

	const { data, isFetching } = useQuery({
		...convexQuery(searchPlayersQueries[league], { season, term: searchTerm }),
		enabled: !!season && !!searchTerm,
		placeholderData: keepPreviousData,
	});

	// With no search running, the list shows the selected player
	const results = searchTerm
		? (data ?? []).filter((player) => player.id !== excludeId)
		: value
			? [value]
			: [];
	const isSearching = inputValue.trim() !== term || (isFetching && results.length === 0);
	// Base UI drops a selection that isn't among `items`, so the selected player
	// stays in them; the list shows only the search results
	const items =
		value && !results.some((player) => player.id === value.id)
			? [...results, value]
			: results;

	// The selected player can change from outside (a teammate's Compare link)
	useEffect(() => {
		setInputValue(value?.name ?? "");
	}, [value?.id, value?.name]);

	return (
		<Combobox.Root
			items={items}
			filteredItems={results}
			value={value}
			onValueChange={(player) => onValueChange(player)}
			inputValue={inputValue}
			onInputValueChange={setInputValue}
			itemToStringLabel={(player) => player.name}
			isItemEqualToValue={(a, b) => a.id === b.id}
		>
			<div className={cn("relative", className)}>
				<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Combobox.Input
					id={id}
					placeholder={placeholder}
					aria-label={placeholder}
					className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
				/>
				{inputValue && (
					<Combobox.Clear
						aria-label="Clear player"
						className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
					>
						<X className="size-3.5" />
					</Combobox.Clear>
				)}
			</div>

			<Combobox.Portal>
				<Combobox.Positioner sideOffset={4} className="z-50">
					<Combobox.Popup className="max-h-80 w-[var(--anchor-width)] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
						<Combobox.Empty className="px-2 py-3 text-center text-sm text-muted-foreground empty:hidden">
							{!inputValue.trim()
								? "Type a player's name"
								: isSearching
									? "Searching..."
									: "No players found"}
						</Combobox.Empty>
						<Combobox.List>
							{(player: PlayerOption) => (
								<Combobox.Item
									key={player.id}
									value={player}
									className={cn(
										"flex cursor-pointer select-none items-center justify-between gap-3 rounded-sm px-2 py-2 text-sm outline-none",
										"data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
									)}
								>
									<span className="truncate">{player.name}</span>
									<span className="shrink-0 text-xs text-muted-foreground">
										{[player.position, player.team].filter(Boolean).join(" · ")}
									</span>
								</Combobox.Item>
							)}
						</Combobox.List>
					</Combobox.Popup>
				</Combobox.Positioner>
			</Combobox.Portal>
		</Combobox.Root>
	);
}

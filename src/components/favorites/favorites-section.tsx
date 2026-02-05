import { useState } from "react";
import { Plus, X, Star } from "lucide-react";
import { Image } from "@/components/ui/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { useFavorites, type FavoriteTeam } from "@/lib/use-favorites";
import { getTeamStaticData, leagueLabels, type League } from "@/lib/teams";
import { TeamSearchModal } from "./team-search-modal";

interface FavoriteTeamCardProps {
	favorite: FavoriteTeam;
	onRemove: () => void;
}

function FavoriteTeamCard({ favorite, onRemove }: FavoriteTeamCardProps) {
	const teamData = getTeamStaticData(favorite.league, favorite.teamId);
	const logoUrl = teamData
		? `/api/${favorite.league}/logo/${teamData.logoSlug}`
		: undefined;
	const teamName = teamData?.fullName ?? favorite.teamSlug;

	return (
		<div className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3">
			{logoUrl && (
				<Image
					src={logoUrl}
					alt=""
					width={32}
					height={32}
					className="size-8 object-contain"
				/>
			)}
			<div className="flex flex-1 flex-col">
				<span className="text-sm font-medium">{teamName}</span>
				<span className="text-xs text-muted-foreground">
					{leagueLabels[favorite.league]}
				</span>
			</div>
			<button
				type="button"
				onClick={onRemove}
				className="rounded p-1.5 opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={`Remove ${teamName} from favorites`}
			>
				<X className="size-4 text-destructive" />
			</button>
		</div>
	);
}

interface LeagueGroupProps {
	league: League;
	favorites: FavoriteTeam[];
	onRemove: (favorite: FavoriteTeam) => void;
}

function LeagueGroup({ league, favorites, onRemove }: LeagueGroupProps) {
	if (favorites.length === 0) return null;

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
				{leagueLabels[league]}
			</h3>
			<div className="grid gap-2 sm:grid-cols-2">
				{favorites.map((fav) => (
					<FavoriteTeamCard
						key={fav._id}
						favorite={fav}
						onRemove={() => onRemove(fav)}
					/>
				))}
			</div>
		</div>
	);
}

export function FavoritesSection() {
	const { favorites, toggleFavorite, isLoading } = useFavorites();
	const [searchOpen, setSearchOpen] = useState(false);

	// Group favorites by league
	const nbaFavorites = favorites.filter((f) => f.league === "nba");
	const wnbaFavorites = favorites.filter((f) => f.league === "wnba");
	const gleagueFavorites = favorites.filter((f) => f.league === "gleague");

	const handleRemove = (favorite: FavoriteTeam) => {
		toggleFavorite(favorite.league, favorite.teamId, favorite.teamSlug);
	};

	if (isLoading) {
		return (
			<section aria-labelledby="favorites-heading">
				<div className="mb-4">
					<SectionTitle id="favorites-heading" icon={Star}>Favorite Teams</SectionTitle>
				</div>
				<Card classNames={{ inner: "flex-col p-4" }}>
					<div className="h-24 flex items-center justify-center text-muted-foreground">
						Loading favorites...
					</div>
				</Card>
			</section>
		);
	}

	return (
		<section aria-labelledby="favorites-heading">
			<div className="flex items-center justify-between mb-4">
				<SectionTitle id="favorites-heading" icon={Star}>Favorite Teams</SectionTitle>
				<Button variant="outline" size="sm" onClick={() => setSearchOpen(true)}>
					<Plus className="size-4" aria-hidden="true" />
					Add Team
				</Button>
			</div>

			<Card classNames={{ inner: "flex-col p-4" }}>
				{favorites.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground">
						No favorites added. Add a team to get started.
					</p>
				) : (
					<div className="space-y-4">
						<LeagueGroup
							league="nba"
							favorites={nbaFavorites}
							onRemove={handleRemove}
						/>
						<LeagueGroup
							league="wnba"
							favorites={wnbaFavorites}
							onRemove={handleRemove}
						/>
						<LeagueGroup
							league="gleague"
							favorites={gleagueFavorites}
							onRemove={handleRemove}
						/>
					</div>
				)}
			</Card>

			<TeamSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
		</section>
	);
}

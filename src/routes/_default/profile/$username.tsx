import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { User, Star, Calendar, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
import { Image } from "@/components/ui/image";
import { getTeamStaticData, leagueLabels, type League } from "@/lib/teams";

export const Route = createFileRoute("/_default/profile/$username")({
	component: PublicProfilePage,
});

interface FavoriteTeam {
	_id: string;
	league: League;
	teamId: string;
	teamSlug: string;
}

function FavoriteTeamCard({ favorite }: { favorite: FavoriteTeam }) {
	const teamData = getTeamStaticData(favorite.league, favorite.teamId);
	const logoUrl = teamData
		? `/api/${favorite.league}/logo/${teamData.logoSlug}`
		: undefined;
	const teamName = teamData?.fullName ?? favorite.teamSlug;

	return (
		<Link
			to={`/${favorite.league}/team/$teamId`}
			params={{ teamId: teamData?.api.slug ?? favorite.teamSlug }}
			className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			{logoUrl && (
				<Image
					src={logoUrl}
					alt=""
					width={32}
					height={32}
					className="size-8 object-contain"
				/>
			)}
			<div className="flex flex-col">
				<span className="text-sm font-medium">{teamName}</span>
				<span className="text-xs text-muted-foreground">
					{leagueLabels[favorite.league]}
				</span>
			</div>
		</Link>
	);
}

function LeagueGroup({ league, favorites }: { league: League; favorites: FavoriteTeam[] }) {
	if (favorites.length === 0) return null;

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
				{leagueLabels[league]}
			</h3>
			<div className="grid gap-2 sm:grid-cols-2">
				{favorites.map((fav) => (
					<FavoriteTeamCard key={fav._id} favorite={fav} />
				))}
			</div>
		</div>
	);
}

function PublicProfilePage() {
	const { username } = Route.useParams();

	const { data: user } = useSuspenseQuery(
		convexQuery(api.auth.getUserByUsername, { username }),
	);

	const { data: favorites = [] } = useSuspenseQuery(
		convexQuery(api.favorites.getFavoritesByUsername, {
			username,
		}),
	) as { data: FavoriteTeam[] };

	if (!user) {
		return (
			<div className="container py-12">
				<div className="mx-auto max-w-2xl text-center">
					<User className="mx-auto mb-4 size-12 text-muted-foreground" />
					<h1 className="text-2xl font-bold">User not found</h1>
					<p className="mt-2 text-muted-foreground">
						The user @{username} doesn't exist or may have been removed.
					</p>
					<Link
						to="/"
						className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline"
					>
						<ArrowLeft className="size-4" />
						Back to home
					</Link>
				</div>
			</div>
		);
	}

	// Group favorites by league
	const nbaFavorites = favorites.filter((f) => f.league === "nba") as FavoriteTeam[];
	const wnbaFavorites = favorites.filter((f) => f.league === "wnba") as FavoriteTeam[];
	const gleagueFavorites = favorites.filter((f) => f.league === "gleague") as FavoriteTeam[];
	const hasFavorites = favorites.length > 0;

	const joinDate = new Date(user.createdAt).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});

	return (
		<div className="container py-8">
			<div className="mx-auto max-w-2xl">
				{/* Profile Header */}
				<Card classNames={{ inner: "p-6 flex-col items-center text-center" }}>
					{user.image ? (
						<img
							src={user.image}
							alt=""
							className="size-24 rounded-full"
						/>
					) : (
						<div className="flex size-24 items-center justify-center rounded-full bg-muted">
							<User className="size-12 text-muted-foreground" />
						</div>
					)}
					<div className="mt-4">
						<h1 className="text-2xl font-bold">{user.name || "Anonymous"}</h1>
						<p className="text-muted-foreground">
							@{user.displayUsername || user.username}
						</p>
					</div>
					<div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
						<Calendar className="size-4" />
						<span>Joined {joinDate}</span>
					</div>
				</Card>

				{/* Favorite Teams */}
				<section className="mt-8" aria-labelledby="favorites-heading">
					<div className="mb-4">
						<SectionTitle id="favorites-heading" icon={Star}>
							Favorite Teams
						</SectionTitle>
					</div>
					<Card classNames={{ inner: "flex-col p-4" }}>
						{hasFavorites ? (
							<div className="space-y-4">
								<LeagueGroup league="nba" favorites={nbaFavorites} />
								<LeagueGroup league="wnba" favorites={wnbaFavorites} />
								<LeagueGroup league="gleague" favorites={gleagueFavorites} />
							</div>
						) : (
							<p className="py-8 text-center text-muted-foreground">
								No favorite teams yet.
							</p>
						)}
					</Card>
				</section>
			</div>
		</div>
	);
}

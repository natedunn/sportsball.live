import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "~api";
import { Image } from "@/components/ui/image";
import { FavoriteStar } from "@/components/ui/favorite-star";
import { TeamFlickeringGrid } from "@/components/team-flickering-grid";
import { useFavorites } from "@/lib/use-favorites";
import { getTeamStaticData } from "@/lib/teams";
import type { League } from "@/lib/shared/league";
import type { TeamOverview } from "@/lib/types/team";

interface TeamHeaderProps {
	overview: TeamOverview;
	league: League;
}

export function TeamHeader({ overview, league }: TeamHeaderProps) {
	const { wins, losses, winPct } = overview.record;
	const record = `${wins}-${losses}`;
	const teamName = overview.name.replace(overview.location, "").trim();

	// Favorites
	const { isFavorited, toggleFavorite, isLoading: favoritesLoading } = useFavorites();
	const teamData = getTeamStaticData(league, overview.id);
	const teamSlug = teamData?.api.slug ?? "";
	const favorited = isFavorited(league, overview.id);
	const { data: currentUser } = useQuery(
		convexQuery(api.auth.getCurrentUser, {}),
	);
	const isAuthenticated = !!currentUser;

	return (
		<div className="relative overflow-hidden border-b bg-card">
			{/* Background grid effect - spans full width */}
			<div className="absolute inset-0 flex items-start justify-center pointer-events-none">
				<div className="flex">
					<div className="relative">
						<div className="absolute inset-0 z-1 bg-linear-to-r from-card via-card/80 to-transparent" />
						<TeamFlickeringGrid
							dark={overview.darkColor}
							light={overview.lightColor}
							grid={{ height: 250, width: 300 }}
						/>
					</div>
					<div className="relative">
						<div className="absolute inset-0 z-1 bg-linear-to-l from-card via-card/80 to-transparent" />
						<TeamFlickeringGrid
							dark={overview.darkColor}
							light={overview.lightColor}
							grid={{ height: 250, width: 300 }}
						/>
					</div>
				</div>
			</div>

			<div className="container relative z-10">
				<div className="py-6 md:py-8">
					{/* Main content - left aligned on desktop, centered on mobile */}
					<div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
						{/* Logo */}
						<div className="flex justify-center md:justify-start">
							<Image
								src={overview.logo}
								alt={overview.name}
								className="size-16 md:size-20 object-contain drop-shadow-lg"
							/>
						</div>

						{/* Team info */}
						<div className="flex flex-col items-center md:items-start flex-1">
							<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
								{overview.location}
							</span>
							<div className="flex items-center gap-2 mb-2">
								<h1 className="text-2xl md:text-4xl font-bold tracking-tight">
									{teamName}
								</h1>
								{isAuthenticated && !favoritesLoading && teamSlug && (
									<FavoriteStar
										isFavorited={favorited}
										onToggle={() => toggleFavorite(league, overview.id, teamSlug)}
										size="lg"
									/>
								)}
							</div>

							{/* Record and standing row */}
							<div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2">
								{/* Record */}
								<div className="flex items-baseline gap-2">
									<span className="md:text-xl text-foreground font-bold tabular-nums">
										{record}
									</span>
									{winPct > 0 && (
										<span className="text-sm text-muted-foreground">
											({(winPct * 100).toFixed(1)}%)
										</span>
									)}
								</div>

								{/* Divider */}
								{overview.standings.conferenceRank && (
									<span className="hidden sm:block text-muted-foreground/50">
										|
									</span>
								)}

								{/* Conference standing */}
								{overview.standings.conferenceRank &&
									overview.standings.conference && (
										<span className="text-muted-foreground">
											<span className="md:text-xl font-semibold text-foreground">
												{getOrdinal(overview.standings.conferenceRank)}
											</span>{" "}
											in {overview.standings.conference.toLowerCase()}
										</span>
									)}

							</div>
						</div>

					</div>
				</div>
			</div>
		</div>
	);
}

function getOrdinal(n: number): string {
	const s = ["th", "st", "nd", "rd"];
	const v = n % 100;
	const suffix = s[(v - 20) % 10] || s[v] || s[0];
	return `${n}${suffix}`;
}

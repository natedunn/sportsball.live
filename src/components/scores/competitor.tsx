import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { TeamFlickeringGrid } from "@/components/team-flickering-grid";
import { Image } from "@/components/ui/image";
import { FavoriteStar } from "@/components/ui/favorite-star";
import { leagueTeamRoutes } from "@/lib/league-routes";
import type { League } from "@/lib/shared/league";
import type { GameData } from "@/lib/types";

type Team = GameData["home"] | GameData["away"];

interface CompetitorProps {
	team: Team;
	homeAway: "home" | "away";
	league: League;
	isFavorited?: boolean;
	classes?: {
		wrapper?: string;
		logo?: string;
		team?: string;
		seasonRecord?: string;
	};
}

export function Competitor({
	team,
	homeAway,
	league,
	isFavorited = false,
	classes,
}: CompetitorProps) {
	const isJazz = team.name === "Jazz";

	const content = (
		<>
			<div
				className={cn(
					"absolute inset-0 z-10 from-card from-40% to-transparent",
					homeAway === "home" && "bg-linear-to-tr",
					homeAway === "away" && "bg-linear-to-tl",
				)}
			/>
			<TeamFlickeringGrid
				className="absolute inset-0 z-0"
				dark={team.darkColor}
				light={team.lightColor}
			/>
			<div className="z-10 flex h-full flex-col items-center justify-center gap-2">
				<div className="relative">
					<Image
						src={team.logo}
						alt={team.name ?? "Team logo"}
						width={40}
						height={40}
						className={cn(
							"w-7 sm:w-8 md:w-10 group-hover:scale-110 transition-transform",
							classes?.logo,
							isJazz && "dark:invert",
						)}
					/>
					{isFavorited && (
						<div className="absolute -top-1 -right-1">
							<FavoriteStar isFavorited size="sm" showOnlyWhenFavorited />
						</div>
					)}
				</div>
				<div className="flex flex-col items-center">
					<span
						className={cn(
							"text-sm font-bold group-hover:underline decoration-2 decoration-foreground/75",
							classes?.team,
						)}
					>
						{team.name}
					</span>
					<span
						className={cn(
							"font-mono text-sm text-muted-foreground",
							classes?.seasonRecord,
						)}
					>
						{team.seasonRecord}
					</span>
				</div>
			</div>
		</>
	);

	const wrapperClassName = cn(
		"relative flex flex-col items-center gap-2 overflow-hidden",
		classes?.wrapper,
	);

	if (team.slug) {
		return (
			<Link
				to={leagueTeamRoutes[league]}
				params={{ teamId: team.slug }}
				className={cn(wrapperClassName, "group")}
			>
				{content}
			</Link>
		);
	}

	return <div className={wrapperClassName}>{content}</div>;
}

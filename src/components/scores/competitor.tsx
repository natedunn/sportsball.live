import { cn } from "@/lib/utils";
import { TeamFlickeringGrid } from "@/components/team-flickering-grid";
import { Image } from "@/components/ui/image";
import { FavoriteStar } from "@/components/ui/favorite-star";
import type { GameData } from "@/lib/types";

type Team = GameData["home"] | GameData["away"];

interface CompetitorProps {
	team: Team;
	homeAway: "home" | "away";
	isFavorited?: boolean;
	classes?: {
		wrapper?: string;
		logo?: string;
		team?: string;
		seasonRecord?: string;
	};
}

export function Competitor({ team, homeAway, isFavorited = false, classes }: CompetitorProps) {
	const isJazz = team.name === "Jazz";

	return (
		<div
			className={cn(
				"relative flex flex-col items-center gap-2 overflow-hidden",
				classes?.wrapper,
			)}
		>
			<div
				className={cn(
					"absolute inset-0 z-10 from-card from-40% to-transparent",
					homeAway === "home" && "bg-gradient-to-tr",
					homeAway === "away" && "bg-gradient-to-tl",
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
							"w-7 sm:w-8 md:w-10",
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
					<span className={cn("text-sm font-bold", classes?.team)}>
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
		</div>
	);
}

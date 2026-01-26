import { cn } from "@/lib/utils";
import { TeamFlickeringGrid } from "./team-flickering-grid";
import { Image } from "./ui/image";
import type { GameData } from "@/lib/types";

type Team = GameData["home"] | GameData["away"];

interface CompetitorProps {
	team: Team;
	homeAway: "home" | "away";
	classes?: {
		wrapper?: string;
		logo?: string;
		team?: string;
		seasonRecord?: string;
	};
}

export function Competitor({ team, homeAway, classes }: CompetitorProps) {
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
			<TeamFlickeringGrid dark={team.darkColor} light={team.lightColor} />
			<div className="z-10 flex h-full flex-col items-center justify-center gap-2">
				<Image
					src={team.logo}
					alt={team.name ?? "Team logo"}
					width={48}
					height={48}
					className={cn(
						"w-8 sm:w-10 md:w-12",
						classes?.logo,
						isJazz && "dark:invert",
					)}
				/>
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

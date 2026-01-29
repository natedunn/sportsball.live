import { Image } from "@/components/ui/image";
import { TeamFlickeringGrid } from "@/components/team-flickering-grid";
import type { GameDetailsTeam } from "@/lib/nba/game-details.server";

interface GameTeamHeaderProps {
	team: GameDetailsTeam;
}

export function GameTeamHeader({ team }: GameTeamHeaderProps) {
	return (
		<div className="flex flex-1 flex-col items-center relative" id={team.uid}>
			<Image
				src={team.logo}
				alt={team.name ?? "Team"}
				className="h-10 w-10 z-2 relative object-contain md:h-12 md:w-12"
			/>
			<span className="inline-block mt-2 text-lg relative z-2 font-semibold md:text-xl">
				{team.name}
			</span>
			{team.record && (
				<span className="relative z-2 font-mono font-bold text-sm text-foreground/50 md:text-base">
					{team.record}
				</span>
			)}
			<div className="flex items-center absolute -bottom-13">
				<div className="relative">
					<div className="absolute inset-0 z-1 from-card from-40% to-transparent bg-linear-to-br" />
					<TeamFlickeringGrid dark={team.darkColor} light={team.lightColor} />
				</div>
				<div className="relative">
					<div className="absolute inset-0 z-1 from-card from-40% to-transparent bg-linear-to-bl" />
					<TeamFlickeringGrid dark={team.darkColor} light={team.lightColor} />
				</div>
			</div>
		</div>
	);
}

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Image } from "@/components/ui/image";
import { TeamFlickeringGrid } from "@/components/team-flickering-grid";
import { getTeamStaticData } from "@/lib/teams";
import { TEAM_COLOR_CLASS, teamColorVars } from "@/lib/shared/team-color-vars";
import { readableTeamColor } from "@/lib/shared/team-color-contrast";
import type { League } from "@/lib/shared/league";
import type { PlayerProfileData } from "@/lib/players/mock-data";
import { formatExperience, getPlayerAge } from "@/lib/players/mock-data";
import type { PlayerStatus } from "@/lib/players/player-status";
import { Tooltip } from "@/components/ui/tooltip";

interface PlayerHeaderProps {
	player: PlayerProfileData;
	league: League;
	status: PlayerStatus | null;
}

// Solid backgrounds: the badge sits on the team's pixel grid, which would show
// through a tint and could wash out the text
const GREEN = { badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300", dot: "bg-green-500" };
const YELLOW = { badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300", dot: "bg-yellow-500" };

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
	Active: GREEN,
	Probable: GREEN,
	Questionable: YELLOW,
	"Day-To-Day": YELLOW,
	Doubtful: { badge: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300", dot: "bg-orange-500" },
	Out: { badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", dot: "bg-red-500" },
};
// ESPN's report can carry others, such as a suspension
const OTHER_STATUS = { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" };

function StatusBadge({ status }: { status: PlayerStatus }) {
	const styles = STATUS_STYLES[status.label] ?? OTHER_STATUS;
	const badge = (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
				styles.badge,
			)}
		>
			<span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
			{status.label}
		</span>
	);
	if (!status.description && !status.comment) return badge;
	return (
		<Tooltip
			content={
				<div className="max-w-[280px] space-y-1 text-left text-xs leading-relaxed">
					{status.description && <p className="font-semibold">{status.description}</p>}
					{status.comment && <p>{status.comment}</p>}
				</div>
			}
			side="bottom"
			delay={0}
			closeDelay={0}
			hoverable={false}
		>
			{badge}
		</Tooltip>
	);
}

export function PlayerHeader({ player, league, status }: PlayerHeaderProps) {
	const team = getTeamStaticData(league, player.team);
	// Readable team colors (3:1 on the card), for the ring and the pixel grid
	const colors = team
		? {
				dark: readableTeamColor(team.colors.display.dark, "dark", "graphic"),
				light: readableTeamColor(team.colors.display.light, "light", "graphic"),
			}
		: undefined;
	const age = getPlayerAge(player.bio);
	const experience = formatExperience(player.bio.experienceYears);
	const initials = player.name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase();

	return (
		<div className="relative overflow-hidden border-b bg-card">
			{/* Team color pixel grid, as on the team page header */}
			{colors && (
				<div className="pointer-events-none absolute inset-0 flex items-start justify-center">
					<div className="flex">
						<div className="relative">
							<div className="absolute inset-0 z-1 bg-linear-to-r from-card via-card/80 to-transparent" />
							<TeamFlickeringGrid dark={colors.dark} light={colors.light} grid={{ height: 250, width: 300 }} />
						</div>
						<div className="relative">
							<div className="absolute inset-0 z-1 bg-linear-to-l from-card via-card/80 to-transparent" />
							<TeamFlickeringGrid dark={colors.dark} light={colors.light} grid={{ height: 250, width: 300 }} />
						</div>
					</div>
				</div>
			)}

			<div className="container relative z-10">
				<div className="py-6 md:py-8">
					<div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
						{/* Avatar */}
						<div className="flex justify-center md:justify-start">
							<div
								className={cn(TEAM_COLOR_CLASS, "flex size-16 md:size-20 items-center justify-center overflow-hidden rounded-full bg-muted border border-border text-xl md:text-2xl font-bold text-muted-foreground")}
								style={
									colors
										? ({
												...teamColorVars(league, player.team),
												outline: "2px solid var(--team)",
												outlineOffset: 3,
											} as CSSProperties)
										: undefined
								}
							>
								{player.headshot ? (
									<Image
										src={player.headshot}
										alt={player.name}
										className="h-full w-full object-cover"
									/>
								) : (
									initials
								)}
							</div>
						</div>

						{/* Player info */}
						<div className="flex flex-col items-center md:items-start flex-1">
							<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
								{player.team}
							</span>
							<h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-2">
								{player.name}
							</h1>

							<div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-2">
								<span className="text-muted-foreground">{player.position}</span>
								{age !== undefined && (
									<>
										<span className="text-muted-foreground/50">|</span>
										<span className="text-muted-foreground">Age {age}</span>
									</>
								)}
								{experience !== undefined && (
									<>
										<span className="text-muted-foreground/50">|</span>
										<span className="text-muted-foreground">{experience}</span>
									</>
								)}
								{status && (
									<>
										<span className="text-muted-foreground/50">|</span>
										<StatusBadge status={status} />
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

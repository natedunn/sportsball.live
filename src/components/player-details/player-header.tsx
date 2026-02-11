import { cn } from "@/lib/utils";
import type { PlayerProfileData } from "@/lib/players/mock-data";
import { getPlayerAge } from "@/lib/players/mock-data";

interface PlayerHeaderProps {
	player: PlayerProfileData;
}

function StatusBadge({ status }: { status: PlayerProfileData["bio"]["status"] }) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
				status === "Active" && "bg-green-500/10 text-green-700 dark:text-green-400",
				status === "Questionable" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
				status === "Out" && "bg-red-500/10 text-red-700 dark:text-red-400",
			)}
		>
			<span
				className={cn(
					"h-1.5 w-1.5 rounded-full",
					status === "Active" && "bg-green-500",
					status === "Questionable" && "bg-yellow-500",
					status === "Out" && "bg-red-500",
				)}
			/>
			{status}
		</span>
	);
}

export function PlayerHeader({ player }: PlayerHeaderProps) {
	const age = getPlayerAge(player.bio.birthDate);
	const initials = player.name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase();

	return (
		<div className="relative overflow-hidden border-b bg-card">
			{/* Subtle gradient background */}
			<div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

			<div className="container relative z-10">
				<div className="py-6 md:py-8">
					<div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
						{/* Avatar */}
						<div className="flex justify-center md:justify-start">
							<div className="flex size-16 md:size-20 items-center justify-center rounded-full bg-muted border border-border text-xl md:text-2xl font-bold text-muted-foreground">
								{initials}
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
								<span className="text-muted-foreground/50">|</span>
								<span className="text-muted-foreground">Age {age}</span>
								<span className="text-muted-foreground/50">|</span>
								<StatusBadge status={player.bio.status} />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

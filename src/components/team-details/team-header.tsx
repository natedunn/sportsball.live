import { Image } from "@/components/ui/image";
import { TeamFlickeringGrid } from "@/components/team-flickering-grid";
import { cn } from "@/lib/utils";
import type { TeamOverview } from "@/lib/types/team";

interface TeamHeaderProps {
	overview: TeamOverview;
}

export function TeamHeader({ overview }: TeamHeaderProps) {
	const { wins, losses, winPct, streak } = overview.record;
	const record = `${wins}-${losses}`;
	const teamName = overview.name.replace(overview.location, "").trim();

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
							<h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-2">
								{teamName}
							</h1>

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
											in {overview.standings.conference}
										</span>
									)}

								{/* Streak */}
								{streak && (
									<>
										<span className="hidden sm:block text-border">|</span>
										<span
											className={cn(
												"text-sm font-medium",
												streak.startsWith("W")
													? "text-green-600 dark:text-green-400"
													: streak.startsWith("L")
														? "text-red-600 dark:text-red-400"
														: "text-muted-foreground",
											)}
										>
											{streak}
										</span>
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

function getOrdinal(n: number): string {
	const s = ["th", "st", "nd", "rd"];
	const v = n % 100;
	const suffix = s[(v - 20) % 10] || s[v] || s[0];
	return `${n}${suffix}`;
}

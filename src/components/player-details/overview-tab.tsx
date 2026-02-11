import { Link } from "@tanstack/react-router";
import {
	Target,
	Grab,
	HandHelping,
	Gauge,
	User,
	Calculator,
	Users,
} from "lucide-react";
import { StatCard } from "@/components/team-details/stat-card";
import { SectionHeader } from "@/components/team-details/section-header";
import { Card } from "@/components/ui/card";
import { leaguePlayerRoutes } from "@/lib/league-routes";
import type { League } from "@/lib/shared/league";
import { getPlayerAge, type PlayerProfileData } from "@/lib/players/mock-data";

interface OverviewTabProps {
	player: PlayerProfileData;
	teammates: PlayerProfileData[];
	league: League;
	onCompareTeammate: (teammateId: string) => void;
}

function InfoField({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="font-medium">{value}</p>
		</div>
	);
}

export function OverviewTab({ player, teammates, league, onCompareTeammate }: OverviewTabProps) {
	const age = getPlayerAge(player.bio.birthDate);

	return (
		<div className="space-y-8">
			{/* Quick Stats */}
			<section>
				<SectionHeader icon={Gauge} title="Quick Stats" />
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						label="Points"
						value={player.basicStats.points.toFixed(1)}
						rawValue={player.basicStats.points}
						formatValue={(v) => v.toFixed(1)}
						subtitle="Per game"
						icon={Target}
						delay={0}
					/>
					<StatCard
						label="Rebounds"
						value={player.basicStats.rebounds.toFixed(1)}
						rawValue={player.basicStats.rebounds}
						formatValue={(v) => v.toFixed(1)}
						subtitle="Per game"
						icon={Grab}
						delay={75}
					/>
					<StatCard
						label="Assists"
						value={player.basicStats.assists.toFixed(1)}
						rawValue={player.basicStats.assists}
						formatValue={(v) => v.toFixed(1)}
						subtitle="Per game"
						icon={HandHelping}
						delay={150}
					/>
					<StatCard
						label="PER"
						value={player.calculatedStats.playerEfficiency.toFixed(1)}
						rawValue={player.calculatedStats.playerEfficiency}
						formatValue={(v) => v.toFixed(1)}
						subtitle="Calculated"
						icon={Gauge}
						delay={225}
					/>
				</div>
			</section>

			{/* Bio + Calculated Stats */}
			<div className="grid gap-6 lg:grid-cols-3">
				<div className="lg:col-span-2 space-y-6">
					{/* Player Bio */}
					<section>
						<SectionHeader icon={User} title="Player Bio" />
						<Card>
							<div className="p-4 w-full">
								<div className="grid grid-cols-2 gap-4 text-sm">
									<InfoField label="Birthdate" value={player.bio.birthDate} />
									<InfoField label="Age" value={`${age}`} />
									<InfoField label="College" value={player.bio.college} />
									<InfoField label="Draft" value={player.bio.draftInfo} />
									<InfoField label="Height" value={player.bio.height} />
									<InfoField label="Weight" value={player.bio.weight} />
								</div>
							</div>
						</Card>
					</section>

					{/* Calculated Stats */}
					<section>
						<SectionHeader icon={Calculator} title="Calculated Stats" />
						<Card>
							<div className="p-4 w-full">
								<div className="grid grid-cols-2 gap-4 text-sm">
									<InfoField
										label="TS%"
										value={`${player.calculatedStats.trueShootingPct.toFixed(1)}%`}
									/>
									<InfoField
										label="USG%"
										value={`${player.calculatedStats.usagePct.toFixed(1)}%`}
									/>
									<InfoField
										label="AST/TO"
										value={player.calculatedStats.assistToTurnover.toFixed(2)}
									/>
									<InfoField
										label="Defensive events"
										value={`${(player.basicStats.steals + player.basicStats.blocks).toFixed(1)} STL+BLK`}
									/>
								</div>
							</div>
						</Card>
					</section>
				</div>

				{/* Teammates */}
				<div className="lg:col-span-1">
					<section>
						<SectionHeader icon={Users} title="Teammates" />
						<Card classNames={{ inner: "flex-col p-0" }}>
							<div className="p-3 border-b border-border/50">
								<p className="text-xs text-muted-foreground">
									Switch to a teammate or open a head-to-head comparison.
								</p>
							</div>
							<div className="divide-y divide-border/50">
								{teammates.map((teammate) => (
									<div key={teammate.id} className="flex items-center justify-between px-3 py-2.5">
										<div>
											<p className="text-sm font-medium">{teammate.name}</p>
											<p className="text-xs text-muted-foreground">
												{teammate.position} · {teammate.basicStats.points.toFixed(1)} PPG
											</p>
										</div>
										<div className="flex gap-3 text-xs">
											<Link
												to={leaguePlayerRoutes[league]}
												params={{ id: teammate.id }}
												className="text-muted-foreground hover:underline"
											>
												Open
											</Link>
											<button
												type="button"
												onClick={() => onCompareTeammate(teammate.id)}
												className="text-orange-600 hover:underline dark:text-orange-400"
											>
												Compare
											</button>
										</div>
									</div>
								))}
								{teammates.length === 0 && (
									<div className="px-3 py-4 text-sm text-muted-foreground text-center">
										No teammates available
									</div>
								)}
							</div>
						</Card>
					</section>
				</div>
			</div>
		</div>
	);
}

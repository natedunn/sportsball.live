import { GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/team-details/section-header";
import { Card } from "@/components/ui/card";
import type { PlayerProfileData } from "@/lib/players/mock-data";
import { TabContentMotion } from "./tab-content-motion";

interface ComparisonTabProps {
	player: PlayerProfileData;
	allPlayers: PlayerProfileData[];
	compareId: string;
	onCompareChange: (playerId: string) => void;
	isLoading: boolean;
	comparedPlayer: PlayerProfileData | undefined;
}

function comparisonRows(left: PlayerProfileData, right: PlayerProfileData) {
	return [
		{ label: "PPG", left: left.basicStats.points, right: right.basicStats.points },
		{ label: "RPG", left: left.basicStats.rebounds, right: right.basicStats.rebounds },
		{ label: "APG", left: left.basicStats.assists, right: right.basicStats.assists },
		{ label: "TS%", left: left.calculatedStats.trueShootingPct, right: right.calculatedStats.trueShootingPct },
		{ label: "USG%", left: left.calculatedStats.usagePct, right: right.calculatedStats.usagePct },
		{ label: "PER", left: left.calculatedStats.playerEfficiency, right: right.calculatedStats.playerEfficiency },
		{ label: "AST/TO", left: left.calculatedStats.assistToTurnover, right: right.calculatedStats.assistToTurnover },
	];
}

export function ComparisonTab({
	player,
	allPlayers,
	compareId,
	onCompareChange,
	isLoading,
	comparedPlayer,
}: ComparisonTabProps) {
	return (
		<div className="space-y-4">
			<SectionHeader icon={GitCompareArrows} title="Player Comparison" />
			<TabContentMotion>
				<Card classNames={{ inner: "flex-col p-0" }}>
					{/* Selector */}
					<div className="flex flex-col gap-2 border-b border-border/50 p-3 md:flex-row md:items-center">
						<label htmlFor="compare-player" className="text-sm font-medium">
							Compare against:
						</label>
						<select
							id="compare-player"
							value={compareId}
							onChange={(event) => onCompareChange(event.target.value)}
							className="rounded-md border border-border bg-background px-3 py-2 text-sm md:min-w-72"
						>
							<option value="">Select player</option>
							{allPlayers
								.filter((option) => option.id !== player.id)
								.map((option) => (
									<option key={option.id} value={option.id}>
										{option.name} ({option.team})
									</option>
								))}
						</select>
					</div>

					{/* Loading state */}
					{isLoading && (
						<div className="px-3 py-6 text-center">
							<div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
								<div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
								Loading comparison...
							</div>
						</div>
					)}

					{/* Comparison table */}
					{!isLoading && comparedPlayer && (
						<div className="overflow-x-auto">
							<table className="w-full min-w-[720px] text-sm">
								<thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
									<tr>
										<th className="px-3 py-2 text-left">{player.name}</th>
										<th className="px-3 py-2 text-left">Stat</th>
										<th className="px-3 py-2 text-left">{comparedPlayer.name}</th>
									</tr>
								</thead>
								<tbody>
									{comparisonRows(player, comparedPlayer).map((row) => {
										const leftWins = row.left >= row.right;
										return (
											<tr key={row.label} className="border-t border-border/70">
												<td className={cn("px-3 py-2", leftWins && "font-semibold text-orange-700 dark:text-orange-300")}>
													{row.left.toFixed(1)}
												</td>
												<td className="px-3 py-2 text-muted-foreground">{row.label}</td>
												<td className={cn("px-3 py-2", !leftWins && "font-semibold text-orange-700 dark:text-orange-300")}>
													{row.right.toFixed(1)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}

					{/* Empty state */}
					{!isLoading && !comparedPlayer && !compareId && (
						<div className="px-3 py-6 text-center text-sm text-muted-foreground">
							Select a player above to start comparing
						</div>
					)}
				</Card>
			</TabContentMotion>
		</div>
	);
}

import { ListOrdered } from "lucide-react";
import { SectionHeader } from "@/components/team-details/section-header";
import { Card } from "@/components/ui/card";
import type { LastTenGameLine } from "@/lib/players/mock-data";
import { TabContentMotion } from "./tab-content-motion";

interface Last10TabProps {
	games: LastTenGameLine[];
}

export function Last10Tab({ games }: Last10TabProps) {
	return (
		<div className="space-y-4">
			<SectionHeader icon={ListOrdered} title="Last 10 Games" />
			<TabContentMotion>
				<Card classNames={{ inner: "flex-col p-0" }}>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[980px] text-left text-sm">
							<thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
								<tr>
									<th className="px-3 py-2">Game</th>
									<th className="px-3 py-2">MIN</th>
									<th className="px-3 py-2">FG%</th>
									<th className="px-3 py-2">3P%</th>
									<th className="px-3 py-2">FT%</th>
									<th className="px-3 py-2">REB</th>
									<th className="px-3 py-2">AST</th>
									<th className="px-3 py-2">BLK</th>
									<th className="px-3 py-2">PTS</th>
								</tr>
							</thead>
							<tbody>
								{games.map((game) => (
									<tr key={game.gameLabel} className="border-t border-border/70 hover:bg-muted/40">
										<td className="px-3 py-2 font-medium">{game.gameLabel}</td>
										<td className="px-3 py-2">{game.minutes}</td>
										<td className="px-3 py-2">{game.fieldGoalPct.toFixed(1)}%</td>
										<td className="px-3 py-2">{game.threePointPct.toFixed(1)}%</td>
										<td className="px-3 py-2">{game.freeThrowPct.toFixed(1)}%</td>
										<td className="px-3 py-2">{game.rebounds}</td>
										<td className="px-3 py-2">{game.assists}</td>
										<td className="px-3 py-2">{game.blocks}</td>
										<td className="px-3 py-2 font-semibold">{game.points}</td>
									</tr>
								))}
								{games.length === 0 && (
									<tr>
										<td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
											No recent game data available
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</Card>
			</TabContentMotion>
		</div>
	);
}

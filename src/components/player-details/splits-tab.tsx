import { SplitSquareVertical } from "lucide-react";
import { SectionHeader } from "@/components/team-details/section-header";
import { Card } from "@/components/ui/card";
import type { PlayerSplitLine } from "@/lib/players/mock-data";
import { TabContentMotion } from "./tab-content-motion";

interface SplitsTabProps {
	splits: PlayerSplitLine[];
}

function formatSplitValue(value: number): string {
	return value.toFixed(1);
}

export function SplitsTab({ splits }: SplitsTabProps) {
	return (
		<div className="space-y-4">
			<SectionHeader icon={SplitSquareVertical} title="Splits" />
			<TabContentMotion>
				<Card classNames={{ inner: "flex-col p-0" }}>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[760px] text-left text-sm">
							<thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
								<tr>
									<th className="px-3 py-2">Split</th>
									<th className="px-3 py-2">MIN</th>
									<th className="px-3 py-2">PTS</th>
									<th className="px-3 py-2">REB</th>
									<th className="px-3 py-2">AST</th>
									<th className="px-3 py-2">FG%</th>
									<th className="px-3 py-2">3P%</th>
									<th className="px-3 py-2">FT%</th>
								</tr>
							</thead>
							<tbody>
								{splits.map((row) => (
									<tr key={row.label} className="border-t border-border/70 hover:bg-muted/40">
										<td className="px-3 py-2 font-medium">{row.label}</td>
										<td className="px-3 py-2">{formatSplitValue(row.minutes)}</td>
										<td className="px-3 py-2">{formatSplitValue(row.points)}</td>
										<td className="px-3 py-2">{formatSplitValue(row.rebounds)}</td>
										<td className="px-3 py-2">{formatSplitValue(row.assists)}</td>
										<td className="px-3 py-2">{formatSplitValue(row.fieldGoalPct)}%</td>
										<td className="px-3 py-2">{formatSplitValue(row.threePointPct)}%</td>
										<td className="px-3 py-2">{formatSplitValue(row.freeThrowPct)}%</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Card>
			</TabContentMotion>
		</div>
	);
}

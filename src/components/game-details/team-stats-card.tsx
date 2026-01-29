import { Card } from "@/components/ui/card";
import {
	StatComparison,
	StatComparisonGroup,
} from "./stat-comparison";

interface TeamStats {
	pointsInPaint: number;
	fastBreakPoints: number;
	largestLead: number;
	fieldGoalPct: number;
	fieldGoalsMade: number;
	fieldGoalsAttempted: number;
	threePointPct: number;
	threePointMade: number;
	threePointAttempted: number;
	freeThrowPct: number;
	freeThrowsMade: number;
	freeThrowsAttempted: number;
	totalRebounds: number;
	offensiveRebounds: number;
	defensiveRebounds: number;
	assists: number;
	turnovers: number;
	steals: number;
	blocks: number;
	fouls: number;
}

interface TeamColors {
	darkColor: string;
	lightColor: string;
}

interface TeamStatsCardProps {
	away: {
		stats: TeamStats;
	} & TeamColors;
	home: {
		stats: TeamStats;
	} & TeamColors;
}

export function TeamStatsCard({ away, home }: TeamStatsCardProps) {
	const formatMadeAttempted = (made: number, attempted: number) =>
		`${made}-${attempted}`;

	return (
		<Card classNames={{ inner: "flex-col" }}>
			<StatComparisonGroup title="Scoring" isFirst>
				<StatComparison
					label="Points in Paint"
					awayValue={away.stats.pointsInPaint}
					homeValue={home.stats.pointsInPaint}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
				/>
				<StatComparison
					label="Fast Break Pts"
					awayValue={away.stats.fastBreakPoints}
					homeValue={home.stats.fastBreakPoints}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
				/>
				<StatComparison
					label="Largest Lead"
					awayValue={away.stats.largestLead}
					homeValue={home.stats.largestLead}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
				/>
			</StatComparisonGroup>

			<StatComparisonGroup title="Shooting">
				<StatComparison
					label="FG%"
					awayValue={away.stats.fieldGoalPct}
					homeValue={home.stats.fieldGoalPct}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
					format="percent"
					awaySubValue={formatMadeAttempted(
						away.stats.fieldGoalsMade,
						away.stats.fieldGoalsAttempted,
					)}
					homeSubValue={formatMadeAttempted(
						home.stats.fieldGoalsMade,
						home.stats.fieldGoalsAttempted,
					)}
				/>
				<StatComparison
					label="3P%"
					awayValue={away.stats.threePointPct}
					homeValue={home.stats.threePointPct}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
					format="percent"
					awaySubValue={formatMadeAttempted(
						away.stats.threePointMade,
						away.stats.threePointAttempted,
					)}
					homeSubValue={formatMadeAttempted(
						home.stats.threePointMade,
						home.stats.threePointAttempted,
					)}
				/>
				<StatComparison
					label="FT%"
					awayValue={away.stats.freeThrowPct}
					homeValue={home.stats.freeThrowPct}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
					format="percent"
					awaySubValue={formatMadeAttempted(
						away.stats.freeThrowsMade,
						away.stats.freeThrowsAttempted,
					)}
					homeSubValue={formatMadeAttempted(
						home.stats.freeThrowsMade,
						home.stats.freeThrowsAttempted,
					)}
				/>
			</StatComparisonGroup>

			<StatComparisonGroup title="Rebounding">
				<StatComparison
					label="Total Rebounds"
					awayValue={away.stats.totalRebounds}
					homeValue={home.stats.totalRebounds}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
				/>
				<StatComparison
					label="Offensive Reb"
					awayValue={away.stats.offensiveRebounds}
					homeValue={home.stats.offensiveRebounds}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
				/>
				<StatComparison
					label="Defensive Reb"
					awayValue={away.stats.defensiveRebounds}
					homeValue={home.stats.defensiveRebounds}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
				/>
			</StatComparisonGroup>

			<StatComparisonGroup title="Playmaking">
				<StatComparison
					label="Assists"
					awayValue={away.stats.assists}
					homeValue={home.stats.assists}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
				/>
				<StatComparison
					label="Turnovers"
					awayValue={away.stats.turnovers}
					homeValue={home.stats.turnovers}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
					higherIsBetter={false}
				/>
			</StatComparisonGroup>

			<StatComparisonGroup title="Defense">
				<StatComparison
					label="Steals"
					awayValue={away.stats.steals}
					homeValue={home.stats.steals}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
				/>
				<StatComparison
					label="Blocks"
					awayValue={away.stats.blocks}
					homeValue={home.stats.blocks}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
				/>
				<StatComparison
					label="Fouls"
					awayValue={away.stats.fouls}
					homeValue={home.stats.fouls}
					awayDarkColor={away.darkColor}
					awayLightColor={away.lightColor}
					homeDarkColor={home.darkColor}
					homeLightColor={home.lightColor}
					higherIsBetter={false}
				/>
			</StatComparisonGroup>
		</Card>
	);
}

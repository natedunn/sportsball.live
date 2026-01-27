import { cn } from "@/lib/utils";
import type { State } from "@/schema/nba-scoreboard";

interface ScoreProps {
	homeScore: number;
	awayScore: number;
	gameState: State;
	classes?: {
		wrapper?: string;
		score?: string;
	};
}

type TeamState = "active" | "winner" | "loser";

function getTeamState(
	homeAway: "home" | "away",
	homeScore: number,
	awayScore: number,
	gameState: State,
): TeamState {
	if (gameState === "in" || gameState === "pre") {
		return "active";
	}

	if (
		(homeAway === "home" && homeScore > awayScore) ||
		(homeAway === "away" && awayScore > homeScore)
	) {
		return "winner";
	}
	return "loser";
}

function PaddedScore({
	score,
	maxDigits,
}: {
	score: number;
	maxDigits: number;
}) {
	const scoreStr = score.toString();
	const paddingCount = maxDigits - scoreStr.length;
	const padding = "0".repeat(Math.max(0, paddingCount));

	return (
		<>
			{padding && (
				<span className="pointer-events-none select-none opacity-0">
					{padding}
				</span>
			)}
			{scoreStr}
		</>
	);
}

function TeamScore({
	score,
	maxDigits,
	state,
	className,
}: {
	score: number;
	maxDigits: number;
	state: TeamState;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-2 font-mono text-2xl font-bold sm:text-3xl md:text-4xl",
				state === "loser" && "opacity-50",
				className,
			)}
		>
			<PaddedScore score={score} maxDigits={maxDigits} />
		</div>
	);
}

export function Score({
	homeScore,
	awayScore,
	gameState,
	classes,
}: ScoreProps) {
	const homeState = getTeamState("home", homeScore, awayScore, gameState);
	const awayState = getTeamState("away", homeScore, awayScore, gameState);
	const maxDigits = Math.max(
		homeScore.toString().length,
		awayScore.toString().length,
	);

	return (
		<div className={cn("flex items-center gap-2", classes?.wrapper)}>
			<TeamScore
				score={awayScore}
				maxDigits={maxDigits}
				state={awayState}
				className={classes?.score}
			/>
			<div className="text-xl font-bold opacity-50 sm:text-2xl md:text-3xl">
				—
			</div>
			<TeamScore
				score={homeScore}
				maxDigits={maxDigits}
				state={homeState}
				className={classes?.score}
			/>
		</div>
	);
}

// Export for use in other components
export { PaddedScore };

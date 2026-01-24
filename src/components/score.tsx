import { cn } from "~/lib/utils";
import type { State } from "~/schema/nba-scoreboard";

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
  gameState: State
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

function TeamScore({
  score,
  state,
  className,
}: {
  score: number;
  state: TeamState;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-2xl font-bold sm:text-3xl md:text-4xl",
        state === "loser" && "opacity-50",
        className
      )}
    >
      {score}
    </div>
  );
}

export function Score({ homeScore, awayScore, gameState, classes }: ScoreProps) {
  const homeState = getTeamState("home", homeScore, awayScore, gameState);
  const awayState = getTeamState("away", homeScore, awayScore, gameState);

  return (
    <div className={cn("flex items-center gap-2", classes?.wrapper)}>
      <TeamScore score={awayScore} state={awayState} className={classes?.score} />
      <div className="text-xl font-bold opacity-50 sm:text-2xl md:text-3xl">
        —
      </div>
      <TeamScore score={homeScore} state={homeState} className={classes?.score} />
    </div>
  );
}

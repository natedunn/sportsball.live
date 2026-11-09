import type { CSSProperties } from "react";
import { getTeamStaticData } from "@/lib/teams";
import type { League } from "@/lib/shared/league";
import { readableTeamColor, type TeamColorUse } from "./team-color-contrast";

/**
 * Sets `--team` to the team's readable color for whichever theme is active.
 * Put both on the element: the class picks the light or dark value.
 *
 * Inline colors picked in JavaScript break on the first load: the server
 * doesn't know the theme and renders light colors, and React keeps those
 * style attributes when it hydrates in dark mode. CSS switches with the
 * `dark` class instead, so the server and browser render the same markup.
 */
export const TEAM_COLOR_CLASS = "[--team:var(--team-light)] dark:[--team:var(--team-dark)]";

export function teamColorVars(
	league: League,
	abbreviation: string,
	use: TeamColorUse = "graphic",
): CSSProperties | undefined {
	const team = getTeamStaticData(league, abbreviation);
	if (!team) return undefined;
	return {
		"--team-light": `#${readableTeamColor(team.colors.display.light, "light", use)}`,
		"--team-dark": `#${readableTeamColor(team.colors.display.dark, "dark", use)}`,
	} as CSSProperties;
}

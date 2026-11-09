import { describe, expect, it } from "vitest";
import { getAllTeams } from "@/lib/teams";
import type { League } from "./league";
import {
	MIN_APCA,
	MIN_CONTRAST,
	apcaOnCard,
	contrastOnCard,
	readableTeamColor,
	type ColorMode,
	type TeamColorUse,
} from "./team-color-contrast";

const LEAGUES: League[] = ["nba", "wnba", "gleague"];
const MODES: ColorMode[] = ["light", "dark"];
const USES: TeamColorUse[] = ["graphic", "text"];

describe("readableTeamColor", () => {
	it("leaves colors that already pass alone", () => {
		// Black on the light card, white on the dark card
		expect(readableTeamColor("000000", "light")).toBe("000000");
		expect(readableTeamColor("FFFFFF", "dark")).toBe("FFFFFF");
	});

	it("matches APCA's reference values", () => {
		// Black on white is Lc 106, white on black Lc 108 (reported as magnitude)
		expect(apcaOnCard("000000", "light")).toBeGreaterThan(100);
		expect(apcaOnCard("FFFFFF", "dark")).toBeGreaterThan(100);
	});

	it("lightens dark colors for the dark card and keeps their hue", () => {
		const navy = "0B56BC"; // Orlando's dark-mode blue, about 3:1
		const lifted = readableTeamColor(navy, "dark", "text");
		expect(contrastOnCard(lifted, "dark")).toBeGreaterThanOrEqual(4.5);
		const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(lifted.slice(i, i + 2), 16));
		expect(b).toBeGreaterThan(r);
		expect(b).toBeGreaterThan(g);
	});

	it("darkens light colors for the light card", () => {
		const teal = "5AA191";
		expect(contrastOnCard(teal, "light")).toBeLessThan(3);
		expect(contrastOnCard(readableTeamColor(teal, "light", "graphic"), "light")).toBeGreaterThanOrEqual(3);
	});

	// Every team, every league, both modes: so a new team can't ship unreadable
	for (const league of LEAGUES) {
		it(`makes every ${league} team readable`, () => {
			for (const team of getAllTeams(league)) {
				for (const mode of MODES) {
					for (const use of USES) {
						const color = readableTeamColor(team.colors.display[mode], mode, use);
						const label = `${team.abbreviation} ${mode} ${use}: #${color}`;
						expect(contrastOnCard(color, mode), label).toBeGreaterThanOrEqual(MIN_CONTRAST[use]);
						expect(apcaOnCard(color, mode), label).toBeGreaterThanOrEqual(MIN_APCA[use]);
					}
				}
			}
		});
	}
});

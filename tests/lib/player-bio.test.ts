import { describe, it, expect } from "vitest";
import { formatDraft, formatExperience } from "@/lib/players/mock-data";

describe("formatDraft", () => {
	it("formats a pick with the drafting team", () => {
		expect(formatDraft({ year: 2015, round: 1, pick: 13, team: "PHX" })).toBe(
			"2015 · Rd 1, Pk 13 (PHX)",
		);
	});

	it("leaves out an unknown team", () => {
		expect(formatDraft({ year: 2017, round: 2, pick: 45 })).toBe("2017 · Rd 2, Pk 45");
	});

	it("says Undrafted for null and nothing when unknown", () => {
		expect(formatDraft(null)).toBe("Undrafted");
		expect(formatDraft(undefined)).toBeUndefined();
	});
});

describe("formatExperience", () => {
	it("shows rookies as Rookie", () => {
		expect(formatExperience(0)).toBe("Rookie");
	});

	it("uses ordinal seasons", () => {
		expect(formatExperience(1)).toBe("1st season");
		expect(formatExperience(2)).toBe("2nd season");
		expect(formatExperience(3)).toBe("3rd season");
		expect(formatExperience(11)).toBe("11th season");
		expect(formatExperience(12)).toBe("12th season");
		expect(formatExperience(21)).toBe("21st season");
	});

	it("returns nothing when unknown", () => {
		expect(formatExperience(undefined)).toBeUndefined();
	});
});

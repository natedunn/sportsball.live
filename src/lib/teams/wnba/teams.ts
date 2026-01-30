import type { TeamDefinition } from "../types";

// TODO: Populate with all 13 WNBA teams
// This is a starter with a few teams as examples
export const WNBA_TEAMS: TeamDefinition[] = [
	{
		name: "Aces",
		city: "Las Vegas",
		fullName: "Las Vegas Aces",
		abbreviation: "LVA",
		logoSlug: "lva",
		colors: {
			brand: { primary: "000000", secondary: "C4CED4" },
			display: { dark: "C4CED4", light: "000000" },
		},
		social: { twitter: "lvaces", instagram: "lvaces" },
		espn: { id: "18", slug: "lva" },
	},
	{
		name: "Liberty",
		city: "New York",
		fullName: "New York Liberty",
		abbreviation: "NYL",
		logoSlug: "nyl",
		colors: {
			brand: { primary: "6ECEB2", secondary: "000000" },
			display: { dark: "6ECEB2", light: "000000" },
		},
		social: { twitter: "nyliberty", instagram: "nyliberty" },
		espn: { id: "9", slug: "nyl" },
	},
	{
		name: "Valkyries",
		city: "Golden State",
		fullName: "Golden State Valkyries",
		abbreviation: "GSV",
		logoSlug: "gs",
		colors: {
			brand: { primary: "5E2C83", secondary: "F4C01E" },
			display: { dark: "F4C01E", light: "5E2C83" },
		},
		social: { twitter: "gsvalkyries", instagram: "gsvalkyries" },
		espn: { id: "20", slug: "gs" },
	},
	// Add remaining teams...
];

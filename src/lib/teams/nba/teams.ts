import type { TeamDefinition } from "../types";

// TODO: Populate with all 30 NBA teams
// This is a starter with a few teams as examples
export const NBA_TEAMS: TeamDefinition[] = [
	{
		name: "Lakers",
		city: "Los Angeles",
		fullName: "Los Angeles Lakers",
		abbreviation: "LAL",
		logoSlug: "lal",
		colors: {
			brand: { primary: "552583", secondary: "FDB927" },
			display: { dark: "FDB927", light: "552583" },
		},
		social: { twitter: "lakers", instagram: "lakers" },
		espn: { id: "13", slug: "lal" },
	},
	{
		name: "Celtics",
		city: "Boston",
		fullName: "Boston Celtics",
		abbreviation: "BOS",
		logoSlug: "bos",
		colors: {
			brand: { primary: "007A33", secondary: "BA9653" },
			display: { dark: "BA9653", light: "007A33" },
		},
		social: { twitter: "celtics", instagram: "celtics" },
		espn: { id: "2", slug: "bos" },
	},
	{
		name: "Warriors",
		city: "Golden State",
		fullName: "Golden State Warriors",
		abbreviation: "GSW",
		logoSlug: "gs",
		colors: {
			brand: { primary: "1D428A", secondary: "FFC72C" },
			display: { dark: "FFC72C", light: "1D428A" },
		},
		social: { twitter: "warriors", instagram: "warriors" },
		espn: { id: "9", slug: "gs" },
	},
	// Add remaining teams...
];

export type League = "nba" | "wnba" | "gleague";

export interface TeamStaticData {
	// Identity
	name: string;
	city: string;
	fullName: string;
	abbreviation: string;

	// Visual
	logoSlug: string;
	colors: {
		brand: {
			primary: string;
			secondary: string;
		};
		display: {
			dark: string;
			light: string;
		};
	};

	// Social (optional)
	social?: {
		twitter?: string;
		instagram?: string;
	};

	// API identifiers
	api: {
		id: string;
		slug: string;
	};
	// Secondary API identifiers (for leagues using the stats API)
	statsApi?: {
		id: string;
		slug: string;
	};
}

// Helper type for defining teams (makes nba optional clearer)
export interface TeamDefinition extends TeamStaticData {}

import { createServerFn } from "@tanstack/react-start";
import type { League } from "./league";
import { getLeagueSiteApi } from "./league";

export interface NewsArticle {
	id: string;
	headline: string;
	description: string;
	published: string;
	link: string;
	image?: string;
}

interface ApiImage {
	url?: string;
	width?: number;
	height?: number;
}

interface ApiArticle {
	dataSourceIdentifier?: string;
	headline?: string;
	description?: string;
	published?: string;
	links?: {
		web?: {
			href?: string;
		};
	};
	images?: ApiImage[];
}

interface ApiResponse {
	articles?: ApiArticle[];
}

async function fetchNewsForLeague(league: League): Promise<NewsArticle[]> {
	const baseUrl = getLeagueSiteApi(league);

	const response = await fetch(`${baseUrl}/news?limit=10`, {
		headers: { "Content-Type": "application/json" },
	});

	if (!response.ok) {
		throw new Error(`News API error: ${response.status}`);
	}

	const apiData = (await response.json()) as ApiResponse;

	if (!apiData.articles) {
		return [];
	}

	return apiData.articles.map(
		(article): NewsArticle => ({
			id: article.dataSourceIdentifier ?? crypto.randomUUID(),
			headline: article.headline ?? "",
			description: article.description ?? "",
			published: article.published ?? "",
			link: article.links?.web?.href ?? "",
			image: article.images?.[0]?.url,
		}),
	);
}

export const fetchNbaNews = createServerFn({ method: "GET" }).handler(
	async (): Promise<NewsArticle[]> => {
		return fetchNewsForLeague("nba");
	},
);

export const fetchWnbaNews = createServerFn({ method: "GET" }).handler(
	async (): Promise<NewsArticle[]> => {
		return fetchNewsForLeague("wnba");
	},
);

export const fetchGLeagueNews = createServerFn({ method: "GET" }).handler(
	async (): Promise<NewsArticle[]> => {
		return fetchNewsForLeague("gleague");
	},
);

import { createServerFn } from "@tanstack/react-start";

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

export const fetchGLeagueNews = createServerFn({ method: "GET" })
  .handler(async (): Promise<NewsArticle[]> => {
    const baseUrl = process.env.GLEAGUE_API_BASE;
    if (!baseUrl) {
      throw new Error("GLEAGUE_API_BASE not configured");
    }

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

    return apiData.articles.map((article): NewsArticle => ({
      id: article.dataSourceIdentifier ?? crypto.randomUUID(),
      headline: article.headline ?? "",
      description: article.description ?? "",
      published: article.published ?? "",
      link: article.links?.web?.href ?? "",
      image: article.images?.[0]?.url,
    }));
  });

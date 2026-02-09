import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { NewsCard } from "@/components/news-card";
import { SectionHeader } from "../section-header";
import { teamNewsQueryOptions } from "@/lib/shared/team-news.queries";
import type { League } from "@/lib/shared/league";

interface NewsSectionProps {
	league: League;
	teamSlug: string;
}

export function NewsSection({ league, teamSlug }: NewsSectionProps) {
	const { data: news = [] } = useQuery(teamNewsQueryOptions(league, teamSlug));

	if (news.length === 0) {
		return null;
	}

	return (
		<div>
			<SectionHeader icon={Newspaper} title="Latest News" />
			<div className="space-y-3">
				{news.slice(0, 4).map((article) => (
					<NewsCard key={article.id} article={article} />
				))}
			</div>
		</div>
	);
}

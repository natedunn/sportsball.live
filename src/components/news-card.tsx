import { formatDistanceToNow } from "date-fns";
import type { NewsArticle } from "@/lib/shared/news.server";

export function NewsCard({ article }: { article: NewsArticle }) {
	const timeAgo = article.published
		? formatDistanceToNow(new Date(article.published), { addSuffix: true })
		: "";

	return (
		<a
			href={article.link}
			target="_blank"
			rel="noopener noreferrer"
			className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
		>
			<h3 className="font-medium leading-snug">{article.headline}</h3>
			{article.description && (
				<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
					{article.description}
				</p>
			)}
			{timeAgo && (
				<p className="mt-2 text-xs text-muted-foreground/70">{timeAgo}</p>
			)}
		</a>
	);
}

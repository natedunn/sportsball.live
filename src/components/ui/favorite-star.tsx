import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface FavoriteStarProps {
	isFavorited: boolean;
	onToggle?: () => void;
	size?: "sm" | "md" | "lg";
	showOnlyWhenFavorited?: boolean;
	className?: string;
}

const sizeClasses = {
	sm: "size-3",
	md: "size-4",
	lg: "size-5",
};

export function FavoriteStar({
	isFavorited,
	onToggle,
	size = "md",
	showOnlyWhenFavorited = false,
	className,
}: FavoriteStarProps) {
	// Hide if showOnlyWhenFavorited is true and not favorited
	if (showOnlyWhenFavorited && !isFavorited) {
		return null;
	}

	const isInteractive = !!onToggle;

	const starElement = (
		<Star
			className={cn(
				sizeClasses[size],
				isFavorited
					? "fill-amber-400 text-amber-400"
					: "text-muted-foreground/50",
				className,
			)}
		/>
	);

	if (isInteractive) {
		return (
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onToggle();
				}}
				className={cn(
					"inline-flex items-center justify-center rounded p-1.5 transition-colors",
					"hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					!isFavorited && "opacity-50 hover:opacity-100",
				)}
				aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
				aria-pressed={isFavorited}
			>
				{starElement}
			</button>
		);
	}

	return starElement;
}

import { Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, type PanInfo } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GameData } from "@/lib/types";
import { formatGameDate } from "@/lib/date";
import { Image } from "./ui/image";
import { cn } from "@/lib/utils";

type League = "nba" | "wnba" | "gleague";

const leagueGameRoutes: Record<League, string> = {
	nba: "/nba/game/$gameId",
	wnba: "/wnba/game/$gameId",
	gleague: "/gleague/game/$gameId",
};

const MIN_CARD_WIDTH = 140;
const CARD_GAP = 12;
const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 500;

function TickerItem({ game, league }: { game: GameData; league: League }) {
	return (
		<Link
			to={leagueGameRoutes[league]}
			params={{ gameId: game.id }}
			className="flex h-full w-full flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<Image
						src={game.away.logo}
						alt={game.away.name ?? "Away team"}
						width={16}
						height={16}
						className="size-4 shrink-0 object-contain"
					/>
					<span className="truncate text-xs font-medium">{game.away.name}</span>
				</div>
				<span className="shrink-0 text-xs font-bold tabular-nums">
					{game.state !== "pre" ? game.away.score : "-"}
				</span>
			</div>
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<Image
						src={game.home.logo}
						alt={game.home.name ?? "Home team"}
						width={16}
						height={16}
						className="size-4 shrink-0 object-contain"
					/>
					<span className="truncate text-xs font-medium">{game.home.name}</span>
				</div>
				<span className="shrink-0 text-xs font-bold tabular-nums">
					{game.state !== "pre" ? game.home.score : "-"}
				</span>
			</div>
			<div className="mt-1 text-[10px] text-muted-foreground">
				{game.state === "in" && (
					<span className="font-medium text-green-600 dark:text-green-400">
						LIVE
					</span>
				)}
				{game.state === "post" && "Final"}
				{game.state === "pre" &&
					(game.time.start
						? formatGameDate(new Date(game.time.start), true)
						: game.time.detail)}
			</div>
		</Link>
	);
}

export function ScoreTicker({
	games,
	league,
}: {
	games: GameData[];
	league: League;
}) {
	const contentRef = useRef<HTMLDivElement>(null);
	const [currentPage, setCurrentPage] = useState(0);
	const [itemsPerPage, setItemsPerPage] = useState(2);
	const [itemWidth, setItemWidth] = useState(MIN_CARD_WIDTH);
	const [isDragging, setIsDragging] = useState(false);
	const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

	const totalPages = Math.ceil(games.length / itemsPerPage);

	// Calculate items per page and item width based on content area width
	useEffect(() => {
		const content = contentRef.current;
		if (!content) return;

		const calculate = () => {
			const styles = getComputedStyle(content);
			const paddingLeft = parseFloat(styles.paddingLeft);
			const paddingRight = parseFloat(styles.paddingRight);
			const contentWidth = content.offsetWidth - paddingLeft - paddingRight;
			const minItemWidth = MIN_CARD_WIDTH + CARD_GAP;
			const items = Math.max(
				1,
				Math.floor((contentWidth + CARD_GAP) / minItemWidth),
			);
			// Calculate exact width to fill container
			const width = (contentWidth - (items - 1) * CARD_GAP) / items;
			setItemsPerPage(items);
			setItemWidth(width);
		};

		calculate();

		const resizeObserver = new ResizeObserver(calculate);
		resizeObserver.observe(content);

		return () => resizeObserver.disconnect();
	}, []);

	// Clamp page when items per page changes
	useEffect(() => {
		const maxPage = Math.max(0, totalPages - 1);
		if (currentPage > maxPage) {
			setCurrentPage(maxPage);
		}
	}, [totalPages, currentPage]);

	const goToPage = useCallback(
		(page: number, dir?: number) => {
			const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
			if (clampedPage !== currentPage) {
				setDirection(dir ?? (clampedPage > currentPage ? 1 : -1));
				setCurrentPage(clampedPage);
			}
		},
		[totalPages, currentPage],
	);

	const handleDragEnd = useCallback(
		(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
			setIsDragging(false);
			const { offset, velocity } = info;

			// Determine swipe direction based on velocity or offset
			if (
				velocity.x < -SWIPE_VELOCITY_THRESHOLD ||
				offset.x < -SWIPE_THRESHOLD
			) {
				goToPage(currentPage + 1, 1);
			} else if (
				velocity.x > SWIPE_VELOCITY_THRESHOLD ||
				offset.x > SWIPE_THRESHOLD
			) {
				goToPage(currentPage - 1, -1);
			}
		},
		[currentPage, goToPage],
	);

	if (games.length === 0) {
		return <div className="text-sm text-muted-foreground">No games today</div>;
	}

	// Get current page items
	const startIndex = currentPage * itemsPerPage;
	const currentItems = games.slice(startIndex, startIndex + itemsPerPage);

	return (
		<div className="relative">
			{/* Arrow buttons - hidden on mobile */}
			<button
				type="button"
				onClick={() => goToPage(currentPage - 1, -1)}
				disabled={currentPage === 0}
				className={cn(
					"absolute -left-3 top-[44%] z-10 hidden -translate-y-1/2 rounded-full border border-border bg-background/90 p-3 shadow-sm backdrop-blur-sm transition-opacity sm:block",
					currentPage === 0
						? "opacity-0 pointer-events-none"
						: "hover:bg-accent",
				)}
				aria-label="Previous page"
			>
				<ChevronLeft className="size-4" />
			</button>

			<button
				type="button"
				onClick={() => goToPage(currentPage + 1, 1)}
				disabled={currentPage >= totalPages - 1}
				className={cn(
					"absolute -right-3 top-[44%] z-10 hidden -translate-y-1/2 rounded-full border border-border bg-background/90 p-3 shadow-sm backdrop-blur-sm transition-opacity sm:block",
					currentPage >= totalPages - 1
						? "opacity-0 pointer-events-none"
						: "hover:bg-accent",
				)}
				aria-label="Next page"
			>
				<ChevronRight className="size-4" />
			</button>

			{/* Carousel container */}
			<div ref={contentRef} className="overflow-hidden px-10 py-3 bg-halftone rounded-lg">
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={currentPage}
						className="flex w-full gap-3"
						initial={{ opacity: 0, x: direction * -50 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: direction * 50 }}
						transition={{
							type: "spring",
							stiffness: 300,
							damping: 30,
						}}
						drag="x"
						dragConstraints={{ left: 0, right: 0 }}
						dragElastic={0.2}
						onDragStart={() => setIsDragging(true)}
						onDragEnd={handleDragEnd}
						whileDrag={{ cursor: "grabbing" }}
					>
						{currentItems.map((game) => (
							<div
								key={game.id}
								style={{ width: itemWidth }}
								className="shrink-0"
								onClickCapture={(e) => {
									// Prevent navigation when dragging
									if (isDragging) {
										e.preventDefault();
										e.stopPropagation();
									}
								}}
							>
								<TickerItem game={game} league={league} />
							</div>
						))}
					</motion.div>
				</AnimatePresence>
			</div>

			{/* Dot indicators */}
			{totalPages > 1 && (
				<div className="mt-3 flex justify-center gap-1.5">
					{Array.from({ length: totalPages }).map((_, index) => (
						<button
							key={index}
							type="button"
							onClick={() => goToPage(index)}
							className={cn(
								"size-1.5 rounded-full transition-all",
								index === currentPage
									? "bg-foreground"
									: "bg-foreground/20 hover:bg-foreground/40",
							)}
							aria-label={`Go to page ${index + 1}`}
						/>
					))}
				</div>
			)}
		</div>
	);
}

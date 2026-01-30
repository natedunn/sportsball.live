import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import BasketballIcon from "./basketball-icon";

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
	src?: string;
	alt: string;
	width?: number;
	height?: number;
	fallback?: string;
	proxy?: boolean;
	showFallbackIcon?: boolean;
}

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL;

function getProxiedUrl(src: string): string {
	// Skip proxying for data URLs, blob URLs, and local API routes
	if (
		!CONVEX_SITE_URL ||
		src.startsWith("data:") ||
		src.startsWith("blob:") ||
		src.startsWith("/api/")
	) {
		return src;
	}
	return `${CONVEX_SITE_URL}/image?url=${encodeURIComponent(src)}`;
}

export function Image({
	src,
	alt,
	width,
	height,
	fallback,
	proxy = true,
	showFallbackIcon = true,
	className,
	style,
	...props
}: ImageProps) {
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState(false);
	const imgRef = useRef<HTMLImageElement>(null);

	const hasSrc = src && src.length > 0;
	const imageSrc = hasSrc ? (proxy ? getProxiedUrl(src) : src) : undefined;

	// Reset state when src changes
	useEffect(() => {
		setLoaded(false);
		setError(false);
	}, [src]);

	// Handle cached images that load before onLoad can fire
	useEffect(() => {
		if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
			setLoaded(true);
		}
	}, [imageSrc]);

	const handleLoad = () => {
		setLoaded(true);
	};

	const handleError = () => {
		setError(true);
		if (fallback && imgRef.current) {
			imgRef.current.src = fallback;
		}
	};

	// Show fallback icon if no src or on error
	if ((!hasSrc || error) && showFallbackIcon) {
		const size = width || height || 24;
		return (
			<BasketballIcon
				size={`${size}px`}
				className={className}
				style={style}
			/>
		);
	}

	return (
		<img
			ref={imgRef}
			src={imageSrc}
			alt={alt}
			width={width}
			height={height}
			loading="lazy"
			onLoad={handleLoad}
			onError={handleError}
			className={cn(
				"transition-opacity duration-200",
				loaded ? "opacity-100" : "opacity-0",
				className,
			)}
			style={style}
			{...props}
		/>
	);
}

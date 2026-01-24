import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
	src: string;
	alt: string;
	width?: number;
	height?: number;
	fallback?: string;
	proxy?: boolean;
}

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL;

function getProxiedUrl(src: string): string {
	if (!CONVEX_SITE_URL || src.startsWith("data:") || src.startsWith("blob:")) {
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
	className,
	style,
	...props
}: ImageProps) {
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState(false);
	const imgRef = useRef<HTMLImageElement>(null);

	const imageSrc = proxy ? getProxiedUrl(src) : src;

	// Reset state when src changes
	useEffect(() => {
		setLoaded(false);
		setError(false);
	}, [src]);

	const handleLoad = () => {
		setLoaded(true);
	};

	const handleError = () => {
		setError(true);
		if (fallback && imgRef.current) {
			imgRef.current.src = fallback;
		}
	};

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

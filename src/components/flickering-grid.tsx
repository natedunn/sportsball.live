import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "~/lib/utils";

export interface FlickeringGridProps {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  maxOpacity?: number;
}

function toRGBA(color: string): string {
  if (typeof window === "undefined") {
    return `rgba(0, 0, 0,`;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "rgba(255, 0, 0,";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b},`;
}

export function FlickeringGrid({
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.3,
  color = "rgb(255, 255, 255)",
  width,
  height,
  className,
  maxOpacity = 0.3,
}: FlickeringGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInView, setIsInView] = useState(false);

  const memoizedColor = useMemo(() => toRGBA(color), [color]);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const canvasWidth = width || canvas.clientWidth;
    const canvasHeight = height || canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    const cols = Math.floor(canvasWidth / (squareSize + gridGap));
    const rows = Math.floor(canvasHeight / (squareSize + gridGap));

    const squares = new Float32Array(cols * rows);
    for (let i = 0; i < squares.length; i++) {
      squares[i] = Math.random() * maxOpacity;
    }

    return { canvasWidth, canvasHeight, cols, rows, squares, dpr };
  }, [width, height, squareSize, gridGap, maxOpacity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let setup = setupCanvas();
    if (!setup) return;

    let { canvasWidth, canvasHeight, cols, rows, squares, dpr } = setup;
    let animationFrameId: number;
    let lastTime = 0;

    const updateSquares = (deltaTime: number) => {
      for (let i = 0; i < squares.length; i++) {
        if (Math.random() < flickerChance * deltaTime) {
          squares[i] = Math.random() * maxOpacity;
        }
      }
    };

    const drawGrid = () => {
      ctx.clearRect(0, 0, canvasWidth * dpr, canvasHeight * dpr);
      ctx.fillStyle = "transparent";
      ctx.fillRect(0, 0, canvasWidth * dpr, canvasHeight * dpr);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const opacity = squares[i * rows + j];
          ctx.fillStyle = `${memoizedColor}${opacity})`;
          ctx.fillRect(
            i * (squareSize + gridGap) * dpr,
            j * (squareSize + gridGap) * dpr,
            squareSize * dpr,
            squareSize * dpr
          );
        }
      }
    };

    const animate = (time: number) => {
      if (!isInView) return;
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      updateSquares(deltaTime);
      drawGrid();
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      const newSetup = setupCanvas();
      if (newSetup) {
        ({ canvasWidth, canvasHeight, cols, rows, squares, dpr } = newSetup);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(canvas);
    window.addEventListener("resize", handleResize);

    if (isInView) {
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, [
    isInView,
    setupCanvas,
    memoizedColor,
    squareSize,
    gridGap,
    flickerChance,
    maxOpacity,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none size-full", className)}
      style={{
        width: width || "100%",
        height: height || "100%",
      }}
    />
  );
}

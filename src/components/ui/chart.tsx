import * as React from "react";
import { Tooltip } from "recharts";
import { cn } from "@/lib/utils";

/**
 * Hook that measures a container's dimensions via ResizeObserver.
 * Returns null until the element has non-zero size, so charts can
 * defer their first render until real dimensions are available.
 * This avoids the ResponsiveContainer double-render that kills animations.
 *
 * Dimensions are rounded and only update state when they actually change,
 * preventing unnecessary re-renders that would interrupt chart animations.
 */
export function useChartSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const w = Math.round(width);
      const h = Math.round(height);
      if (w > 0 && h > 0) {
        setSize((prev) => {
          if (prev && prev.width === w && prev.height === h) return prev;
          return { width: w, height: h };
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

// Chart configuration type
export type ChartConfig = Record<
  string,
  {
    label: string;
    color: string;
    icon?: React.ComponentType;
  }
>;

// Chart context for sharing config
type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

// Chart Container
interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig;
  children: React.ReactNode;
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ config, children, className, ...props }, ref) => {
    // Generate CSS variables for colors
    const cssVars = React.useMemo(() => {
      const vars: Record<string, string> = {};
      Object.entries(config).forEach(([key, value]) => {
        vars[`--color-${key}`] = value.color;
      });
      return vars;
    }, [config]);

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          className={cn(
            "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
            className
          )}
          style={cssVars as React.CSSProperties}
          {...props}
        >
          {children}
        </div>
      </ChartContext.Provider>
    );
  }
);
ChartContainer.displayName = "ChartContainer";

// Chart Tooltip
interface ChartTooltipContentProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    dataKey: string;
    color: string;
    payload: Record<string, unknown>;
  }>;
  label?: string;
  labelFormatter?: (label: string, payload: unknown[]) => React.ReactNode;
  formatter?: (value: number, name: string) => React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  nameKey?: string;
  labelKey?: string;
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(
  (
    {
      active,
      payload,
      label,
      labelFormatter,
      formatter,
      hideLabel = false,
      hideIndicator = false,
      indicator = "dot",
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart();

    if (!active || !payload?.length) {
      return null;
    }

    const displayLabel = labelKey
      ? (payload[0]?.payload?.[labelKey] as React.ReactNode)
      : label;

    return (
      <div
        ref={ref}
        className="grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
      >
        {!hideLabel && displayLabel && (
          <div className="font-medium">
            {labelFormatter
              ? labelFormatter(String(displayLabel), payload)
              : displayLabel}
          </div>
        )}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = nameKey ? item.payload?.[nameKey] : item.dataKey;
            const itemConfig = config[key as string];
            const indicatorColor = item.color || itemConfig?.color;

            return (
              <div
                key={index}
                className="flex w-full flex-wrap items-center gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground"
              >
                {!hideIndicator && (
                  <div
                    className={cn(
                      "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                      indicator === "dot" && "h-2.5 w-2.5 rounded-full",
                      indicator === "line" && "w-1 h-4",
                      indicator === "dashed" &&
                        "w-4 border-[1.5px] border-dashed bg-transparent"
                    )}
                    style={
                      {
                        "--color-bg": indicatorColor,
                        "--color-border": indicatorColor,
                      } as React.CSSProperties
                    }
                  />
                )}
                <div className="flex flex-1 justify-between items-center gap-2 leading-none">
                  <span className="text-muted-foreground">
                    {itemConfig?.label || item.name}
                  </span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {formatter
                      ? formatter(item.value, item.name)
                      : item.value?.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = "ChartTooltipContent";

// Re-export Recharts Tooltip with our content as default
const ChartTooltip = Tooltip;

// Chart Legend
interface ChartLegendContentProps {
  payload?: Array<{
    value: string;
    dataKey?: string;
    color?: string;
  }>;
  verticalAlign?: "top" | "bottom";
  nameKey?: string;
}

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendContentProps
>(({ payload, nameKey }, ref) => {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="flex items-center justify-center gap-4 pt-3"
    >
      {payload.map((item) => {
        const key = nameKey ? item.dataKey : item.value;
        const itemConfig = config[key as string];

        return (
          <div
            key={item.value}
            className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
          >
            <div
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{
                backgroundColor: item.color || itemConfig?.color,
              }}
            />
            <span className="text-muted-foreground">
              {itemConfig?.label || item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegendContent";

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegendContent,
  useChart,
};

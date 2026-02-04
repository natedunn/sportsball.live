import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  description?: string;
  subtitle?: string; // For custom subtitle text (e.g., "85% win rate")
  icon?: React.ComponentType<{ className?: string }>;
  rank?: number; // If provided, generates subtitle like "3rd in league"
  highlight?: boolean; // Force highlight regardless of rank
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function StatCard({
  label,
  value,
  description,
  subtitle,
  icon: Icon,
  rank,
  highlight: forceHighlight,
}: StatCardProps) {
  const isTopTen = rank !== undefined && rank > 0 && rank <= 10;
  const isHighlighted = forceHighlight || isTopTen;

  // Generate subtitle from rank if not provided directly
  const displaySubtitle = subtitle ?? (rank && rank > 0 ? `${getOrdinalSuffix(rank)} in league` : undefined);

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-muted p-4 transition-all hover:shadow-md",
        isHighlighted && "bg-primary/5 border-primary/20"
      )}
    >
      {/* Icon badge */}
      {Icon && (
        <div
          className={cn(
            "absolute -top-2 -right-2 h-8 w-8 rounded-full border bg-background flex items-center justify-center overflow-hidden",
            isHighlighted && "border-primary/30"
          )}
        >
          {/* Primary overlay for highlighted */}
          {isHighlighted && (
            <div className="absolute inset-0 bg-primary/10" />
          )}
          <Icon
            className={cn(
              "h-4 w-4 relative",
              isHighlighted ? "text-primary" : "text-muted-foreground"
            )}
          />
        </div>
      )}

      {/* Label */}
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {label}
      </div>

      {/* Value */}
      <div className="text-2xl font-bold tabular-nums">
        {value}
      </div>

      {/* Subtitle (rank or custom) */}
      {displaySubtitle && (
        <div
          className={cn(
            "text-xs mt-1 tabular-nums",
            isTopTen ? "text-primary font-medium" : "text-muted-foreground"
          )}
        >
          {displaySubtitle}
        </div>
      )}

      {/* Tooltip on hover - description */}
      {description && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border z-10">
          {description}
        </div>
      )}
    </div>
  );
}

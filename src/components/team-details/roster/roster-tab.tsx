import { useState, useMemo, useEffect, useRef } from "react";
import { Image } from "@/components/ui/image";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, Settings2, Check } from "lucide-react";
import { useHasTabAnimated } from "../animation-context";
import type { RosterPlayer } from "@/lib/types/team";
import type { League } from "@/lib/shared/league";

// Column definition type
interface StatColumn {
  key: string;
  label: string;
  shortLabel: string;
  getValue: (player: RosterPlayer) => number;
  format: (value: number) => string;
  isPercentage?: boolean;
  defaultVisible?: boolean;
}

// All available stat columns
const STAT_COLUMNS: StatColumn[] = [
  {
    key: "gp",
    label: "Games Played",
    shortLabel: "GP",
    getValue: (p) => p.stats.gp,
    format: (v) => (v > 0 ? String(v) : "—"),
    defaultVisible: true,
  },
  {
    key: "gs",
    label: "Games Started",
    shortLabel: "GS",
    getValue: (p) => p.stats.gs,
    format: (v) => (v > 0 ? String(v) : "—"),
    defaultVisible: false,
  },
  {
    key: "mpg",
    label: "Minutes Per Game",
    shortLabel: "MPG",
    getValue: (p) => p.stats.mpg,
    format: (v) => (v > 0 ? v.toFixed(1) : "—"),
    defaultVisible: true,
  },
  {
    key: "ppg",
    label: "Points Per Game",
    shortLabel: "PPG",
    getValue: (p) => p.stats.ppg,
    format: (v) => (v > 0 ? v.toFixed(1) : "—"),
    defaultVisible: true,
  },
  {
    key: "rpg",
    label: "Rebounds Per Game",
    shortLabel: "RPG",
    getValue: (p) => p.stats.rpg,
    format: (v) => (v > 0 ? v.toFixed(1) : "—"),
    defaultVisible: true,
  },
  {
    key: "apg",
    label: "Assists Per Game",
    shortLabel: "APG",
    getValue: (p) => p.stats.apg,
    format: (v) => (v > 0 ? v.toFixed(1) : "—"),
    defaultVisible: true,
  },
  {
    key: "spg",
    label: "Steals Per Game",
    shortLabel: "SPG",
    getValue: (p) => p.stats.spg,
    format: (v) => (v > 0 ? v.toFixed(1) : "—"),
    defaultVisible: false,
  },
  {
    key: "bpg",
    label: "Blocks Per Game",
    shortLabel: "BPG",
    getValue: (p) => p.stats.bpg,
    format: (v) => (v > 0 ? v.toFixed(1) : "—"),
    defaultVisible: false,
  },
  {
    key: "topg",
    label: "Turnovers Per Game",
    shortLabel: "TO",
    getValue: (p) => p.stats.topg,
    format: (v) => (v > 0 ? v.toFixed(1) : "—"),
    defaultVisible: false,
  },
  {
    key: "fgPct",
    label: "Field Goal %",
    shortLabel: "FG%",
    getValue: (p) => p.stats.fgPct,
    format: (v) => (v > 0 ? `${(v * 100).toFixed(1)}%` : "—"),
    isPercentage: true,
    defaultVisible: true,
  },
  {
    key: "threePct",
    label: "3-Point %",
    shortLabel: "3P%",
    getValue: (p) => p.stats.threePct,
    format: (v) => (v > 0 ? `${(v * 100).toFixed(1)}%` : "—"),
    isPercentage: true,
    defaultVisible: true,
  },
  {
    key: "ftPct",
    label: "Free Throw %",
    shortLabel: "FT%",
    getValue: (p) => p.stats.ftPct,
    format: (v) => (v > 0 ? `${(v * 100).toFixed(1)}%` : "—"),
    isPercentage: true,
    defaultVisible: false,
  },
];

// Info columns (non-stat columns that can be toggled)
interface InfoColumn {
  key: string;
  label: string;
  shortLabel: string;
  defaultVisible: boolean;
}

const INFO_COLUMNS: InfoColumn[] = [
  {
    key: "htWt",
    label: "Height / Weight",
    shortLabel: "Ht/Wt",
    defaultVisible: true,
  },
  {
    key: "exp",
    label: "Experience",
    shortLabel: "EXP",
    defaultVisible: false,
  },
];

const STORAGE_KEY = "roster-visible-columns";

function getDefaultVisibleColumns(): string[] {
  const statDefaults = STAT_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
  const infoDefaults = INFO_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
  return [...statDefaults, ...infoDefaults];
}

type SortField = "name" | "jersey" | "position" | string;
type SortDirection = "asc" | "desc";

interface RosterTabProps {
  roster: RosterPlayer[];
  league: League;
}

export function RosterTab({ roster, league }: RosterTabProps) {
  // G-League doesn't have detailed player stats from the cron job
  const hasDetailedStats = league !== "gleague";

  // Fade-up animation (only on first tab visit)
  const hasTabAnimated = useHasTabAnimated();
  const animate = useRef(!hasTabAnimated).current;
  const [cardVisible, setCardVisible] = useState(!animate);
  const [visibleRows, setVisibleRows] = useState(!animate ? roster.length : 0);
  useEffect(() => {
    if (!animate) return;
    const cardTimeout = setTimeout(() => setCardVisible(true), 100);
    return () => clearTimeout(cardTimeout);
  }, [animate]);
  useEffect(() => {
    if (!animate || !cardVisible) return;
    if (visibleRows >= roster.length) return;
    const rowTimeout = setTimeout(() => setVisibleRows((v) => v + 1), 10);
    return () => clearTimeout(rowTimeout);
  }, [animate, cardVisible, visibleRows, roster.length]);

  const [sortField, setSortField] = useState<SortField>(hasDetailedStats ? "ppg" : "name");
  const [sortDirection, setSortDirection] = useState<SortDirection>(hasDetailedStats ? "desc" : "asc");
  const [visibleColumns, setVisibleColumns] = useState<string[]>(getDefaultVisibleColumns);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Load saved column preferences
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleColumns(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save column preferences
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {
      // Ignore localStorage errors
    }
  }, [visibleColumns]);

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const activeColumns = useMemo(
    () => STAT_COLUMNS.filter((c) => visibleColumns.includes(c.key)),
    [visibleColumns]
  );

  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case "name":
          aVal = a.lastName.toLowerCase();
          bVal = b.lastName.toLowerCase();
          break;
        case "jersey":
          aVal = parseInt(a.jersey) || 0;
          bVal = parseInt(b.jersey) || 0;
          break;
        case "position":
          aVal = a.position;
          bVal = b.position;
          break;
        default: {
          // Find the stat column and get its value
          const column = STAT_COLUMNS.find((c) => c.key === sortField);
          if (column) {
            aVal = column.getValue(a);
            bVal = column.getValue(b);
          } else {
            return 0;
          }
        }
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [roster, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortHeader = ({
    field,
    children,
    className,
    align = "left",
    tooltip,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
    align?: "left" | "center" | "right";
    tooltip?: string;
  }) => {
    const isActive = sortField === field;

    const headerContent = (
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive && (
          <span className="text-primary">
            {sortDirection === "asc" ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </span>
        )}
      </span>
    );

    return (
      <th
        className={cn(
          "px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap",
          align === "center" && "text-center",
          align === "right" && "text-right",
          isActive && "text-foreground",
          className
        )}
        onClick={() => handleSort(field)}
      >
        {tooltip ? (
          <Tooltip content={tooltip} side="top">
            {headerContent}
          </Tooltip>
        ) : (
          headerContent
        )}
      </th>
    );
  };

  return (
    <div className="space-y-4">
      {/* Column Picker - only show for leagues with detailed stats */}
      {hasDetailedStats && (
        <div className="flex justify-end">
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                showColumnPicker
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-muted border-border"
              )}
            >
              <Settings2 className="h-4 w-4" />
              Columns
            </button>

            {showColumnPicker && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowColumnPicker(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border bg-popover p-2 shadow-lg">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-1.5 mb-1">
                    Show/Hide Columns
                  </div>
                  <div className="space-y-0.5">
                    {/* Info columns */}
                    {INFO_COLUMNS.map((column) => {
                      const isVisible = visibleColumns.includes(column.key);
                      return (
                        <button
                          key={column.key}
                          onClick={() => toggleColumn(column.key)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
                            isVisible
                              ? "bg-primary/10 text-foreground"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border",
                              isVisible
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {isVisible && <Check className="h-3 w-3" />}
                          </span>
                          <span className="font-medium w-10">{column.shortLabel}</span>
                          <span className="text-muted-foreground">{column.label}</span>
                        </button>
                      );
                    })}
                    {/* Stat columns */}
                    {STAT_COLUMNS.map((column) => {
                      const isVisible = visibleColumns.includes(column.key);
                      return (
                        <button
                          key={column.key}
                          onClick={() => toggleColumn(column.key)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
                            isVisible
                              ? "bg-primary/10 text-foreground"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border",
                              isVisible
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {isVisible && <Check className="h-3 w-3" />}
                          </span>
                          <span className="font-medium w-10">{column.shortLabel}</span>
                          <span className="text-muted-foreground">{column.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="border-t mt-2 pt-2 flex gap-2">
                    <button
                      onClick={() => setVisibleColumns([...STAT_COLUMNS.map((c) => c.key), ...INFO_COLUMNS.map((c) => c.key)])}
                      className="flex-1 px-2 py-1 text-xs font-medium rounded bg-muted hover:bg-accent transition-colors"
                    >
                      Show All
                    </button>
                    <button
                      onClick={() => setVisibleColumns(getDefaultVisibleColumns())}
                      className="flex-1 px-2 py-1 text-xs font-medium rounded bg-muted hover:bg-accent transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <Card
        classNames={{
          wrapper: animate
            ? cn(
                "transition-[opacity,transform] duration-700 ease-out",
                cardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
              )
            : undefined,
          inner: "flex-col p-0",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="border-b border-border">
                <SortHeader field="name" className="min-w-[200px] sticky left-0 z-10 bg-muted shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Player
                </SortHeader>
                <SortHeader field="position" className="w-14" align="center" tooltip="Position">
                  Pos
                </SortHeader>
                {visibleColumns.includes("htWt") && (
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    <Tooltip content="Height / Weight" side="top">
                      <span>Ht / Wt</span>
                    </Tooltip>
                  </th>
                )}
                {visibleColumns.includes("exp") && (
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Tooltip content="Experience" side="top">
                      <span>Exp</span>
                    </Tooltip>
                  </th>
                )}
                {hasDetailedStats && activeColumns.map((column) => (
                  <SortHeader key={column.key} field={column.key} align="center" tooltip={column.label}>
                    {column.shortLabel}
                  </SortHeader>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {sortedRoster.map((player, index) => (
                <tr
                  key={player.id}
                  className={animate
                    ? cn(
                        "transition-opacity duration-300 ease-out",
                        index < visibleRows ? "opacity-100" : "opacity-0",
                      )
                    : undefined
                  }
                >
                  {/* Player name, photo, jersey, and college */}
                  <td className="px-3 py-3 sticky left-0 z-10 bg-card shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-background">
                        {player.headshot ? (
                          <Image
                            src={player.headshot}
                            alt={player.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                            {player.firstName.charAt(0)}
                            {player.lastName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <span>{player.name}</span>
                          {player.injured && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900">
                              {player.injuryStatus}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {player.jersey && <span className="font-mono">#{player.jersey}</span>}
                          {player.jersey && player.college && <span className="mx-1">·</span>}
                          {player.college && <span>{player.college}</span>}
                          {!player.jersey && !player.college && <span>—</span>}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Position */}
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex items-center justify-center h-6 w-8 rounded bg-muted text-xs font-medium">
                      {player.position || "—"}
                    </span>
                  </td>

                  {/* Height / Weight - conditional */}
                  {visibleColumns.includes("htWt") && (
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {player.height || "—"} / {player.weight || "—"}
                    </td>
                  )}

                  {/* Experience - conditional */}
                  {visibleColumns.includes("exp") && (
                    <td className="px-3 py-3 text-muted-foreground text-xs">
                      {player.experience}
                    </td>
                  )}

                  {/* Dynamic stat columns - only for leagues with detailed stats */}
                  {hasDetailedStats && activeColumns.map((column) => {
                    const value = column.getValue(player);
                    return (
                      <td
                        key={column.key}
                        className="px-3 py-3 text-center tabular-nums text-muted-foreground"
                      >
                        {column.format(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

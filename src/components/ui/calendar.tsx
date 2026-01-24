import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { cn } from "~/lib/utils";
import { Button, getButtonClasses } from "./button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("bg-background p-3", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          getButtonClasses("ghost", "icon"),
          "h-8 w-8 select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          getButtonClasses("ghost", "icon"),
          "h-8 w-8 select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-8 w-full items-center justify-center px-8",
          defaultClassNames.month_caption
        ),
        caption_label: cn(
          "select-none text-sm font-medium",
          defaultClassNames.caption_label
        ),
        month_grid: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal w-8",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        day: cn(
          "relative p-0 text-center text-sm select-none aspect-square",
          "[&:first-child[data-selected=true]_button]:rounded-l-md",
          "[&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day
        ),
        day_button: cn(
          getButtonClasses("ghost", "icon"),
          "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
          "data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground",
          "data-[today=true]:bg-accent data-[today=true]:text-accent-foreground",
          defaultClassNames.day_button
        ),
        range_start: cn("bg-accent rounded-l-md", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        selected: "bg-primary text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground rounded-md",
        outside: cn(
          "text-muted-foreground opacity-50 aria-selected:opacity-30",
          defaultClassNames.outside
        ),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...props }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("size-4", className)} {...props} />;
        },
      }}
      {...props}
    />
  );
}

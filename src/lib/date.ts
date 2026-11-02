import { addDays, format, parseISO, subDays, subHours } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getUserTimeZone } from "@/lib/timezone";

export function formatDate(
  date: Date | string,
  dateFormat: "YYYYMMDD" | "YYYY-MM-DD" = "YYYYMMDD"
): string {
  let dateObj: Date;
  if (typeof date === "string") {
    dateObj = fromZonedTime(
      parseISO(date),
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  } else {
    dateObj = date;
  }

  if (dateFormat === "YYYYMMDD") {
    return format(dateObj, "yyyyMMdd");
  } else {
    return format(dateObj, "yyyy-MM-dd");
  }
}

// Late games can end after midnight, so the scoreboard keeps showing the
// previous day's games until this hour in the visitor's time zone.
const GAME_DAY_ROLLOVER_HOUR = 3;

/** Today's scoreboard date for the visitor, which rolls over at 3am instead of midnight. */
export function getGameDay(
  dateFormat: "YYYYMMDD" | "YYYY-MM-DD" = "YYYYMMDD",
  { now = new Date(), timeZone = getUserTimeZone() }: { now?: Date; timeZone?: string } = {}
): string {
  return formatInTimeZone(
    subHours(now, GAME_DAY_ROLLOVER_HOUR),
    timeZone,
    dateFormat === "YYYYMMDD" ? "yyyyMMdd" : "yyyy-MM-dd"
  );
}

/** Short time zone name for `date` in `timeZone`, e.g. "EST" or "GMT+1". */
export function timeZoneAbbreviation(date: Date, timeZone: string): string {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  );
}

const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

// Date format presets - extensible for future user preferences (locale, etc.)
export type DateFormatPreset = "full" | "short" | "time-only";

interface FormatGameDateOptions {
  format?: DateFormatPreset;
}

export const formatGameDate = (
  date: Date,
  options: FormatGameDateOptions | boolean = {}
): string => {
  // Support legacy boolean param for backwards compatibility
  const opts: FormatGameDateOptions =
    typeof options === "boolean" ? { format: options ? "time-only" : "full" } : options;
  const formatPreset = opts.format ?? "full";

  const timeZone = getUserTimeZone();

  // Short format: M/D/YY (US) - future: support other locales
  if (formatPreset === "short") {
    return formatInTimeZone(date, timeZone, "M/d/yy");
  }

  const time = formatInTimeZone(date, timeZone, "h:mm a");
  const tz = timeZoneAbbreviation(date, timeZone);

  if (formatPreset === "time-only") {
    return `${time} ${tz}`;
  }

  const dateYear = formatInTimeZone(date, timeZone, "yyyy");
  const currentYear = formatInTimeZone(new Date(), timeZone, "yyyy");
  const yearSuffix = dateYear !== currentYear ? `, ${dateYear}` : "";
  const day = Number(formatInTimeZone(date, timeZone, "d"));

  return `${formatInTimeZone(date, timeZone, "EEEE, MMMM")} ${day}${getOrdinalSuffix(day)}${yearSuffix} at ${time} ${tz}`;
};

type DateParam = string;

export const moveDate = (
  date: DateParam,
  direction: "prev" | "next" | "today"
): DateParam => {
  if (direction === "today") {
    return getGameDay("YYYY-MM-DD");
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const utcDate = fromZonedTime(date, timeZone);
  const newDate =
    direction === "next" ? addDays(utcDate, 1) : subDays(utcDate, 1);

  return format(newDate, "yyyy-MM-dd");
};

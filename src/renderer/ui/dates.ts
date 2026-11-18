/**
 * Calendar-day helpers shared by the date pickers. A day is a 'YYYY-MM-DD' string, the
 * same form the reports filter on; a month is 'YYYY-MM'. All arithmetic runs in UTC so a
 * day never shifts across a time-zone or daylight-saving boundary. Weeks start on Sunday,
 * like every other calendar in the app.
 */
export type Day = string;
export type Month = string;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, "0");
const fromDate = (d: Date): Day => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** The UTC midnight of a valid day, or null for anything else (including '2026-02-30'). */
export function parseDay(s: string): Date | null {
  const m = DAY_RE.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return fromDate(d) === s ? d : null;
}
export const isDay = (s: string) => parseDay(s) !== null;
/** Today as a day, in UTC or in the local time zone (the reports use either, per their data). */
export function todayIn(utc: boolean, now = Date.now()): Day {
  const d = new Date(now);
  return utc ? fromDate(d) : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Builds a day from a year, a zero-based month and a day of the month, rolling over like Date does. */
export const makeDay = (y: number, m0: number, d: number): Day => fromDate(new Date(Date.UTC(y, m0, d)));
export function addDays(day: Day, n: number): Day {
  const d = parseDay(day)!;
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}
export const monthOf = (day: Day): Month => day.slice(0, 7);
export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split("-").map(Number);
  return makeDay(y, m - 1 + n, 1).slice(0, 7);
}
/** The same day of the month n months away, clamped to that month's last day. */
export function shiftMonths(day: Day, n: number): Day {
  const month = addMonths(monthOf(day), n),
    [y, m] = month.split("-").map(Number),
    last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${pad(Math.min(Number(day.slice(8)), last))}`;
}
/** 0 = Sunday … 6 = Saturday. */
export const weekday = (day: Day) => parseDay(day)!.getUTCDay();
export const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
/** Six full weeks (42 days) covering a month, starting on the Sunday on or before the 1st; a fixed height keeps the popover still while paging. */
export function monthGrid(month: Month): Day[] {
  const first = `${month}-01`,
    start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

const utc = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...o, timeZone: "UTC" });
const fmtDay = utc({ month: "short", day: "numeric", year: "numeric" }),
  fmtDayNoYear = utc({ month: "short", day: "numeric" }),
  fmtLong = utc({ weekday: "long", month: "long", day: "numeric", year: "numeric" }),
  fmtMonth = utc({ month: "long", year: "numeric" });
/** "Jan 3, 2026" */
export const formatDay = (day: Day) => fmtDay.format(parseDay(day)!);
/** "Saturday, January 3, 2026": the accessible name of a calendar cell. */
export const formatLongDay = (day: Day) => fmtLong.format(parseDay(day)!);
/** "January 2026" */
export const formatMonth = (month: Month) => fmtMonth.format(parseDay(month + "-01")!);
/** A short label for a range: "Jan 3 – 9, 2026", "Dec 28, 2025 – Jan 3, 2026", "From Jan 3, 2026", "All time". */
export function formatRange(since: Day, until: Day): string {
  const a = isDay(since) ? since : "",
    b = isDay(until) ? until : "";
  if (!a && !b) return "All time";
  if (!b) return "From " + formatDay(a);
  if (!a) return "Until " + formatDay(b);
  if (a === b) return formatDay(a);
  if (a.slice(0, 4) !== b.slice(0, 4)) return `${formatDay(a)} – ${formatDay(b)}`;
  if (a.slice(0, 7) === b.slice(0, 7)) return `${fmtDayNoYear.format(parseDay(a)!)} – ${Number(b.slice(8))}, ${b.slice(0, 4)}`;
  return `${fmtDayNoYear.format(parseDay(a)!)} – ${formatDay(b)}`;
}

export const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "last90", label: "Last 90 days" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisYear", label: "This year" },
  { id: "all", label: "All time" },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];
export const presetLabel = (id: PresetId) => PRESETS.find((p) => p.id === id)!.label;
export const isPreset = (s: unknown): s is PresetId => PRESETS.some((p) => p.id === s);

/** A report range: a named preset (resolved against today each time), or custom days when preset is "". */
export interface RangeValue {
  preset: PresetId | "";
  since: Day;
  until: Day;
}
/** The days a preset covers, counted back from `today` (inclusive); "all" has no bounds. */
export function resolvePreset(id: PresetId, today: Day): { since: Day; until: Day } {
  const month = monthOf(today);
  switch (id) {
    case "today":
      return { since: today, until: today };
    case "yesterday": {
      const d = addDays(today, -1);
      return { since: d, until: d };
    }
    case "last7":
      return { since: addDays(today, -6), until: today };
    case "last30":
      return { since: addDays(today, -29), until: today };
    case "last90":
      return { since: addDays(today, -89), until: today };
    case "thisMonth":
      return { since: month + "-01", until: today };
    case "lastMonth": {
      const prev = addMonths(month, -1);
      return { since: prev + "-01", until: addDays(month + "-01", -1) };
    }
    case "thisYear":
      return { since: today.slice(0, 4) + "-01-01", until: today };
    case "all":
      return { since: "", until: "" };
  }
}
/** The since/until a range filters on today. */
export const resolveRange = (v: RangeValue, today: Day) => (v.preset ? resolvePreset(v.preset, today) : { since: v.since, until: v.until });
/** The trigger's label: the preset's name, or the custom days. */
export const rangeLabel = (v: RangeValue) => (v.preset ? presetLabel(v.preset) : formatRange(v.since, v.until));


import type {
  AiResult,
  DailyLog,
  Settings,
  WidgetData,
  WidgetProject,
  WidgetRange,
  WidgetTotals,
} from "../shared/contracts";
import { dayParts, tokens } from "../ai/model";
import { sessionVector } from "../ai/aggregate";
import { effectiveLines, normalizedUsagePath } from "../domain/daily";
export const widgetRanges: WidgetRange[] = ["today", "d30", "all"];
const dayMs = 86400000;
interface Day {
  tokens: number;
  minutes: number;
  requests: number;
}
/** Adds whole days to a YYYY-MM-DD date without involving the local clock. */
export function shiftDay(date: string, days: number): string {
  return new Date(Date.parse(date + "T00:00:00Z") + days * dayMs)
    .toISOString()
    .slice(0, 10);
}
/**
 * The daily log keeps days after agents delete their records; the current
 * report has today's partial day. Each day keeps the larger of the two.
 */
function daySeries(ai: AiResult | null, daily: DailyLog): Map<string, Day> {
  const days = new Map<string, Day>(),
    put = (date: string, d: Day) => {
      const old = days.get(date);
      days.set(
        date,
        old
          ? {
              tokens: Math.max(old.tokens, d.tokens),
              minutes: Math.max(old.minutes, d.minutes),
              requests: Math.max(old.requests, d.requests),
            }
          : d,
      );
    };
  for (const d of daily.days)
    if (d.ai)
      put(d.date, {
        tokens: d.ai.total.tokens,
        minutes: d.ai.minutes ?? 0,
        requests: d.ai.total.requests,
      });
  const combined = ai?.combined;
  if (combined)
    for (const [date, hours] of Object.entries(combined.hours)) {
      let t = 0,
        requests = 0;
      for (const h of Object.values(hours))
        for (const v of Object.values(h)) {
          t += tokens(v);
          requests += v[4];
        }
      put(date, {
        tokens: t,
        minutes: ai?.activity?.byDay[date] ?? 0,
        requests,
      });
    }
  return days;
}
const active = (d: Day | undefined) => !!d && (d.tokens > 0 || d.minutes > 0);
export function streaks(
  days: Map<string, Day>,
  today: string,
): WidgetData["streak"] {
  let d = active(days.get(today)) ? today : shiftDay(today, -1),
    current = 0;
  while (active(days.get(d))) {
    current++;
    d = shiftDay(d, -1);
  }
  let best = 0,
    run = 0,
    previous = "";
  for (const date of [...days.keys()]
    .filter((k) => active(days.get(k)))
    .sort()) {
    run = previous && shiftDay(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return { current, best: Math.max(best, current) };
}
/** Registered CodeLines projects name sessions under their folders; others use the folder name. */
function projectName(
  cwd: string,
  roots: { name: string; root: string }[],
): string {
  const p = normalizedUsagePath(cwd);
  if (!p) return "Other";
  const match = roots.find((r) => p === r.root || p.startsWith(r.root + "/"));
  if (match) return match.name;
  return (
    cwd
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() || "Other"
  );
}
export function widgetSummary(
  input: { ai: AiResult | null; daily: DailyLog; settings: Settings },
  now = Date.now(),
  dark = false,
): WidgetData {
  const { ai, daily, settings } = input,
    combined = ai?.combined ?? null,
    utc = combined ? combined.meta.tz === "utc" : settings.aiUsage.useUtc,
    today = dayParts(now, utc).day,
    cut = shiftDay(today, -30),
    inRange = (range: WidgetRange, date: string) =>
      range === "all" || (range === "today" ? date === today : date > cut),
    days = daySeries(ai, daily),
    activeDays = [...days.keys()].filter((k) => active(days.get(k))).sort();
  const roots = settings.projects
    .map((p) => ({ name: p.name, root: normalizedUsagePath(p.rootPath) }))
    .filter((p) => p.root)
    .sort((a, b) => b.root.length - a.root.length);
  const ranges = {} as Record<WidgetRange, WidgetTotals>,
    projects = {} as Record<WidgetRange, WidgetProject[]>;
  for (const range of widgetRanges) {
    const t: WidgetTotals = { tokens: 0, minutes: 0, requests: 0, sessions: 0 };
    for (const date of activeDays)
      if (inRange(range, date)) {
        const d = days.get(date)!;
        t.tokens += d.tokens;
        t.minutes += d.minutes;
        t.requests += d.requests;
      }
    const byName = new Map<string, WidgetProject>();
    for (const s of combined?.sessions ?? []) {
      if (!inRange(range, dayParts(s[2], utc).day)) continue;
      t.sessions++;
      const name = projectName(s[4], roots),
        key = name.toLowerCase(),
        p = byName.get(key) ?? { name, minutes: 0, tokens: 0, sessions: 0 };
      p.sessions++;
      p.tokens += tokens(sessionVector(s));
      p.minutes +=
        ai?.activity?.bySession[s[0] + "::" + (s[1] || "unknown")] ?? 0;
      byName.set(key, p);
    }
    t.minutes = Math.round(t.minutes * 10) / 10;
    ranges[range] = t;
    projects[range] = [...byName.values()]
      .map((p) => ({ ...p, minutes: Math.round(p.minutes * 10) / 10 }))
      .sort(
        (a, b) =>
          b.minutes - a.minutes ||
          b.tokens - a.tokens ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 50);
  }
  const record = activeDays.reduce<{ date: string; tokens: number } | null>(
    (best, date) => {
      const t = days.get(date)!.tokens;
      return !best || t > best.tokens ? { date, tokens: t } : best;
    },
    null,
  );
  return {
    generatedAt: ai?.generatedAt ?? null,
    aiEnabled: settings.aiUsage.enabled,
    today,
    dark,
    ranges,
    streak: streaks(days, today),
    days: activeDays
      .filter((date) => date > shiftDay(today, -371))
      .map((date) => {
        const d = days.get(date)!;
        return { date, tokens: d.tokens, minutes: d.minutes };
      }),
    projects,
    total: {
      firstDay: activeDays[0] ?? null,
      activeDays: activeDays.length,
      record,
    },
    code: codeSummary(settings, daily),
  };
}
function codeSummary(settings: Settings, daily: DailyLog): WidgetData["code"] {
  const s = settings.lastSnapshot;
  if (!s) return null;
  const scanned = daily.days
    .filter((d) => d.lines.length)
    .map((d) => d.date)
    .sort();
  let codeLinesDelta: number | null = null;
  if (scanned.length > 1) {
    const sum = (date: string) =>
      effectiveLines(daily, date).reduce((n, e) => n + e.entry.codeLines, 0);
    codeLinesDelta =
      sum(scanned[scanned.length - 1]) - sum(scanned[scanned.length - 2]);
  }
  return {
    projects: s.projects.length,
    files: s.fileCount,
    codeLines: s.codeLines,
    physicalLines: s.physicalLines,
    scannedAt: s.scannedAt,
    codeLinesDelta,
  };
}

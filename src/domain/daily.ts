import type {
  AgentPayload,
  DailyLog,
  DailyDay,
  DailyEntry,
  ProjectMetric,
  Scope,
  AiAmount,
  ProjectUsage,
  AgentSession,
  Project,
} from "../shared/contracts";
import { add, vec, tokens, dayParts } from "../ai/model";
import { sessionVector } from "../ai/aggregate";
export function normalizedUsagePath(value: string): string {
  let p = value.trim().replaceAll("\\", "/");
  p = p.replace(/^\/mnt\/([a-z])\//i, "$1:/").replace(/^\/([a-z])\//i, "$1:/");
  return p.replace(/\/+$/, "").toLowerCase();
}
export function matchProjects(
  sessions: AgentSession[],
  projects: Pick<Project, "id" | "rootPath">[],
): ProjectUsage[] {
  const normalized = projects
      .map((p) => ({ ...p, root: normalizedUsagePath(p.rootPath) }))
      .filter((p) => p.root)
      .sort((a, b) => b.root.length - a.root.length),
    amounts = new Map(projects.map((p) => [p.id, { sessions: 0, v: vec() }]));
  for (const s of sessions) {
    const cwd = normalizedUsagePath(s[4]);
    if (!cwd) continue;
    const p = normalized.find(
      (p) => cwd === p.root || cwd.startsWith(p.root + "/"),
    );
    if (!p) continue;
    const a = amounts.get(p.id)!;
    a.sessions++;
    add(a.v, sessionVector(s));
  }
  return [...amounts].map(([projectId, a]) => ({
    projectId,
    sessions: a.sessions,
    tokens: tokens(a.v),
    cost: a.v[6],
    costPartial: a.v[7] < tokens(a.v) * 0.999,
  }));
}
function getDay(log: DailyLog, date: string): DailyDay {
  let d = log.days.find((d) => d.date === date);
  if (!d) {
    d = { date, lines: [], ai: null };
    log.days.push(d);
    log.days.sort((a, b) => a.date.localeCompare(b.date));
  }
  return d;
}
// Scan day follows the DateTimeOffset's written date, independent of the AI UTC setting.
export function scanDay(now: string): string {
  return now.slice(0, 10);
}
export function recordLines(
  log: DailyLog,
  projects: ProjectMetric[],
  scope: Scope,
  tokenizer: string,
  now: string,
): void {
  const d = getDay(log, scanDay(now));
  for (const p of projects) {
    d.lines = d.lines.filter((e) => e.projectId !== p.projectId);
    d.lines.push({
      projectId: p.projectId,
      name: p.projectName,
      rootPath: p.rootPath,
      scannedAt: now,
      scope,
      tokenizer,
      files: p.fileCount,
      bytes: p.totalBytes,
      tokens: p.totalTokens,
      physicalLines: p.physicalLines,
      blankLines: p.blankLines,
      codeLines: p.codeLines,
      commentLines: p.commentLines,
      contentLines: p.contentLines,
      languages: p.languages.map((l) => ({
        language: l.language,
        category: l.category,
        files: l.files,
        tokens: l.tokens,
        physicalLines: l.physicalLines,
        codeLines: l.codeLines,
        commentLines: l.commentLines,
        contentLines: l.contentLines,
      })),
    });
  }
}
function amount(v: number[]): AiAmount {
  return {
    input: v[0],
    cacheWrite: v[1],
    cacheRead: v[2],
    output: v[3],
    requests: v[4],
    cost: v[6],
    costPartial: v[7] < tokens(v) * 0.999,
    tokens: tokens(v),
  };
}
export function recordAi(
  log: DailyLog,
  payload: AgentPayload,
  projects: Project[],
  now = new Date().toISOString(),
): void {
  const utc = payload.meta.tz === "utc",
    today = dayParts(Date.parse(now), utc).day;
  for (const [date, hours] of Object.entries(payload.hours)) {
    const total = vec(),
      byAgent: Record<string, ReturnType<typeof vec>> = Object.create(null);
    for (const h of Object.values(hours))
      for (const [key, v] of Object.entries(h)) {
        const agent = key.split("::")[0];
        add(total, v);
        add((byAgent[agent] ??= vec()), v);
      }
    const existing = log.days.find((d) => d.date === date)?.ai,
      a = amount(total);
    if (existing && date !== today && a.tokens < existing.total.tokens)
      continue;
    getDay(log, date).ai = {
      updatedAt: now,
      tz: payload.meta.tz,
      total: a,
      byAgent: Object.fromEntries(
        Object.entries(byAgent).map(([k, v]) => [k, amount(v)]),
      ),
      projects: matchProjects(
        payload.sessions.filter((s) => dayParts(s[2], utc).day === date),
        projects,
      ).filter((p) => p.sessions > 0),
    };
  }
}
export interface Effective {
  entry: DailyEntry;
  scannedOn: string;
  isCarried: boolean;
}
export function effectiveLines(
  log: DailyLog,
  date: string,
  projects?: string[],
): Effective[] {
  const latest = new Map<string, Effective>();
  for (const d of [...log.days].sort((a, b) => a.date.localeCompare(b.date)))
    if (d.date <= date)
      for (const entry of d.lines)
        if (!projects || projects.includes(entry.projectId))
          latest.set(entry.projectId, {
            entry,
            scannedOn: d.date,
            isCarried: d.date !== date,
          });
  return [...latest.values()].sort((a, b) =>
    a.entry.name.localeCompare(b.entry.name),
  );
}
export const dailyKeys = [
  "files",
  "bytes",
  "tokens",
  "physicalLines",
  "blankLines",
  "codeLines",
  "commentLines",
  "contentLines",
] as const;
export type DailyTotals = Record<(typeof dailyKeys)[number], number>;
const totals = (entries: DailyEntry[]): DailyTotals | null =>
  entries.length
    ? (Object.fromEntries(
        dailyKeys.map((k) => [k, entries.reduce((n, e) => n + e[k], 0)]),
      ) as DailyTotals)
    : null;
export function dailyAi(
  day: DailyDay | undefined,
  projects?: string[],
  allAgents = true,
): Pick<ProjectUsage, "tokens" | "cost" | "costPartial"> | null {
  if (!day?.ai) return null;
  if (allAgents || !projects) return day.ai.total;
  const rows = day.ai.projects.filter((p) => projects.includes(p.projectId));
  return {
    tokens: rows.reduce((n, p) => n + p.tokens, 0),
    cost: rows.reduce((n, p) => n + p.cost, 0),
    costPartial: rows.some((p) => p.costPartial),
  };
}
const contract = (entries: DailyEntry[]) =>
  [...new Set(entries.map((e) => `${e.scope}/${e.tokenizer.toLowerCase()}`))]
    .sort()
    .join("+");
export interface TimelineRow {
  date: string;
  projects: number;
  carriedProjects: number;
  lines: DailyTotals | null;
  previous: DailyTotals | null;
  ai: ReturnType<typeof dailyAi>;
  scopeChanged: boolean;
  deltaLines: number | null;
  deltaCode: number | null;
  deltaTokens: number | null;
  notes: string;
}
export function timeline(
  log: DailyLog,
  projects?: string[],
  allAgents = true,
): TimelineRow[] {
  const result: TimelineRow[] = [],
    latest = new Map<string, DailyEntry>();
  let previous: DailyTotals | null = null,
    previousContract: string | null = null;
  for (const d of [...log.days].sort((a, b) => a.date.localeCompare(b.date))) {
    const real = d.lines.filter(
      (e) => !projects || projects.includes(e.projectId),
    );
    for (const e of real) latest.set(e.projectId, e);
    const ai = dailyAi(d, projects, allAgents);
    if (!real.length && !(ai && ai.tokens > 0)) continue;
    const entries = [...latest.values()],
      lines = totals(entries),
      c = entries.length ? contract(entries) : null,
      scopeChanged =
        c !== null &&
        (c.includes("+") ||
          (previousContract !== null && c !== previousContract)),
      carriedProjects = entries.length - real.length;
    const notes = [
      !lines
        ? "Not scanned yet"
        : carriedProjects === entries.length
          ? "Not scanned this day; latest earlier scan shown"
          : carriedProjects
            ? `${carriedProjects} of ${entries.length} projects from earlier days`
            : "",
      scopeChanged ? "Counting scope or tokenizer changed" : "",
    ]
      .filter(Boolean)
      .join(" • ");
    result.push({
      date: d.date,
      projects: entries.length,
      carriedProjects,
      lines,
      previous,
      ai,
      scopeChanged,
      deltaLines:
        lines && previous ? lines.physicalLines - previous.physicalLines : null,
      deltaCode:
        lines && previous ? lines.codeLines - previous.codeLines : null,
      deltaTokens: lines && previous ? lines.tokens - previous.tokens : null,
      notes,
    });
    if (lines) {
      previous = lines;
      previousContract = c;
    }
  }
  return result;
}
export function compareDays(
  log: DailyLog,
  dateA: string,
  dateB: string,
  projects?: string[],
  allAgents = true,
) {
  const a = effectiveLines(log, dateA, projects),
    b = effectiveLines(log, dateB, projects),
    ta = totals(a.map((e) => e.entry)),
    tb = totals(b.map((e) => e.entry)),
    aiA = dailyAi(
      log.days.find((d) => d.date === dateA),
      projects,
      allAgents,
    ),
    aiB = dailyAi(
      log.days.find((d) => d.date === dateB),
      projects,
      allAgents,
    );
  const row = (metric: string, av: number | null, bv: number | null) => ({
    metric,
    a: av,
    b: bv,
    delta: av !== null && bv !== null ? bv - av : null,
    deltaPercent:
      av !== null && bv !== null && av !== 0 ? (bv - av) / av : null,
  });
  const metrics = dailyKeys
    .filter((k) => k !== "bytes")
    .map((k) => row(k, ta?.[k] ?? null, tb?.[k] ?? null));
  metrics.push(
    row("AI tokens (that day)", aiA?.tokens ?? null, aiB?.tokens ?? null),
    row("AI cost (that day)", aiA?.cost ?? null, aiB?.cost ?? null),
  );
  const la = a.flatMap((e) => e.entry.languages),
    lb = b.flatMap((e) => e.entry.languages),
    keys = [
      ...new Set([...la, ...lb].map((l) => l.language + "::" + l.category)),
    ];
  const languages = keys
    .map((key) => {
      const [language, category] = key.split("::"),
        aa = la.filter(
          (l) => l.language === language && l.category === category,
        ),
        bb = lb.filter(
          (l) => l.language === language && l.category === category,
        );
      const linesA = aa.reduce((n, l) => n + l.physicalLines, 0),
        linesB = bb.reduce((n, l) => n + l.physicalLines, 0),
        codeA = aa.reduce((n, l) => n + l.codeLines, 0),
        codeB = bb.reduce((n, l) => n + l.codeLines, 0);
      return {
        language,
        category,
        linesA,
        linesB,
        codeA,
        codeB,
        deltaLines: linesB - linesA,
        deltaCode: codeB - codeA,
      };
    })
    .sort(
      (a, b) => Math.max(b.linesA, b.linesB) - Math.max(a.linesA, a.linesB),
    );
  const warnings: string[] = [];
  if (new Set([...a, ...b].map((e) => contract([e.entry]))).size > 1)
    warnings.push(
      "The counting scope or tokenizer differs between these days, so line and token numbers are not directly comparable.",
    );
  if ([...a, ...b].some((e) => e.isCarried))
    warnings.push(
      "Some projects were not scanned on the selected dates; their latest earlier scan is used.",
    );
  return { metrics, languages, warning: warnings.join(" ") };
}

import type { AiResult, ClaudePayload, Vector } from "../shared/contracts";
import { vec, add, tokens, dayParts } from "../ai/model";
import { sessionVector } from "../ai/aggregate";
import { rateCost } from "../ai/pricing";
export interface ReportSession {
  id: string;
  agent: string;
  start: number;
  end: number;
  cwd: string;
  branch: string;
  model: string;
  v: Vector;
}
export interface ReportFact {
  day: string;
  hour: number;
  agent: string;
  model: string;
  v: Vector;
  cw5: number;
  cw1: number;
}
export interface ReportModel {
  facts: ReportFact[];
  sessions: ReportSession[];
  claude: ClaudePayload | null;
  utc: boolean;
  labels: Record<string, string>;
}
export function reportModel(result: AiResult, agent = "all"): ReportModel {
  const combined = result.combined,
    utc = combined?.meta.tz === "utc",
    facts: ReportFact[] = [],
    sessions: ReportSession[] = [];
  const claude = agent === "claude" ? result.claude : null;
  if (claude) {
    for (const [day, hours] of Object.entries(claude.hours))
      for (const [hour, models] of Object.entries(hours))
        for (const [model, v] of Object.entries(models)) {
          const cost = rateCost(
            claude.rates[model],
            v[0],
            v[1],
            v[2],
            v[3],
            v[4],
          );
          facts.push({
            day,
            hour: Number(hour),
            agent: "claude",
            model,
            v: [
              v[0],
              v[1] + v[2],
              v[3],
              v[4],
              v[5],
              v[6],
              cost,
              v[0] + v[1] + v[2] + v[3] + v[4],
            ],
            cw5: v[1],
            cw1: v[2],
          });
        }
    for (const s of claude.sessions) {
      const tk = s[4] + s[5] + s[6] + s[7] + s[8],
        // Older saved reports lack per-request session cost; price them at the top model.
        cost =
          s[12] ??
          rateCost(claude.rates[s[11]], s[4], s[5], s[6], s[7], s[8]);
      sessions.push({
        id: s[0],
        agent: "claude",
        start: s[1],
        end: s[2],
        cwd: s[9],
        branch: s[10],
        model: s[11],
        v: [s[4], s[5] + s[6], s[7], s[8], s[3], 0, cost, tk],
      });
    }
  } else if (combined) {
    for (const [day, hours] of Object.entries(combined.hours))
      for (const [hour, models] of Object.entries(hours))
        for (const [key, v] of Object.entries(models)) {
          const separator = key.indexOf("::"),
            id = key.slice(0, separator);
          if (agent !== "all" && agent !== id) continue;
          facts.push({
            day,
            hour: Number(hour),
            agent: id,
            model: key.slice(separator + 2),
            v,
            cw5: 0,
            cw1: 0,
          });
        }
    for (const s of combined.sessions)
      if (agent === "all" || s[0] === agent)
        sessions.push({
          id: s[1],
          agent: s[0],
          start: s[2],
          end: s[3],
          cwd: s[4],
          branch: "",
          model: s[5].slice(s[5].indexOf("::") + 2),
          v: sessionVector(s),
        });
  }
  return {
    facts,
    sessions,
    claude,
    utc,
    labels: Object.fromEntries(
      Object.entries(combined?.agents ?? {}).map(([k, a]) => [k, a.label]),
    ),
  };
}
export interface ReportFilter {
  range: number;
  since: string;
  until: string;
  group: "agent" | "model";
}
export interface ReportBucket {
  key: string;
  v: Vector;
  cw5: number;
  cw1: number;
  sessions: number;
}
export function selectReport(model: ReportModel, filter: ReportFilter) {
  const days = [...new Set(model.facts.map((f) => f.day))].sort();
  let cutoff = "";
  if (filter.range && days.length) {
    const d = new Date(days.at(-1)! + "T12:00:00");
    d.setDate(d.getDate() - (filter.range - 1));
    cutoff = dayParts(d.getTime(), false).day;
  }
  const selectedDays = days.filter(
      (d) =>
        (!cutoff || d >= cutoff) &&
        (!filter.since || d >= filter.since) &&
        (!filter.until || d <= filter.until),
    ),
    allowed = new Set(selectedDays),
    total = vec(),
    byGroup = new Map<string, ReportBucket>(),
    byAgent = new Map<string, ReportBucket>(),
    byDay = new Map<string, ReportBucket>(),
    byMonth = new Map<string, ReportBucket>(),
    byHour = Array.from({ length: 24 }, vec),
    weekday = Array.from({ length: 7 }, () => Array.from({ length: 24 }, vec)),
    dailyGroups = new Map<string, Map<string, Vector>>();
  let cw5 = 0,
    cw1 = 0;
  const plus = (map: Map<string, ReportBucket>, key: string, f: ReportFact) => {
    let b = map.get(key);
    if (!b) {
      b = { key, v: vec(), cw5: 0, cw1: 0, sessions: 0 };
      map.set(key, b);
    }
    add(b.v, f.v);
    b.cw5 += f.cw5;
    b.cw1 += f.cw1;
  };
  for (const f of model.facts) {
    if (!allowed.has(f.day)) continue;
    add(total, f.v);
    cw5 += f.cw5;
    cw1 += f.cw1;
    const key = filter.group === "agent" ? f.agent : f.agent + "::" + f.model;
    plus(byGroup, key, f);
    plus(byAgent, f.agent, f);
    plus(byDay, f.day, f);
    plus(byMonth, f.day.slice(0, 7), f);
    add(byHour[f.hour], f.v);
    add(weekday[new Date(f.day + "T12:00:00Z").getUTCDay()][f.hour], f.v);
    let groups = dailyGroups.get(f.day);
    if (!groups) {
      groups = new Map();
      dailyGroups.set(f.day, groups);
    }
    let v = groups.get(key);
    if (!v) {
      v = vec();
      groups.set(key, v);
    }
    add(v, f.v);
  }
  const sessions = model.sessions.filter((s) =>
      allowed.has(dayParts(s.start, model.utc).day),
    ),
    projects = new Map<
      string,
      ReportBucket & { agents: Set<string>; branches: Set<string> }
    >();
  for (const s of sessions) {
    let key = s.cwd || "(unknown)";
    if (!model.claude && s.cwd) {
      key = key.replaceAll("/", "\\").replace(/\\+$/, "");
      if (/^[a-zA-Z]:/.test(key)) key = key[0].toUpperCase() + key.slice(1);
    }
    let p = projects.get(key);
    if (!p) {
      p = {
        key,
        v: vec(),
        cw5: 0,
        cw1: 0,
        sessions: 0,
        agents: new Set(),
        branches: new Set(),
      };
      projects.set(key, p);
    }
    p.sessions++;
    p.agents.add(s.agent);
    if (s.branch) p.branches.add(s.branch);
    add(p.v, s.v);
  }
  for (const a of byAgent.values())
    a.sessions = sessions.filter((s) => s.agent === a.key).length;
  const groups = [...byGroup.values()].sort(
    (a, b) => tokens(b.v) - tokens(a.v),
  );
  return {
    selectedDays,
    total,
    cw5,
    cw1,
    groups,
    agents: [...byAgent.values()].sort((a, b) => tokens(b.v) - tokens(a.v)),
    days: [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key)),
    months: [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)),
    byHour,
    weekday,
    dailyGroups,
    sessions,
    projects: [...projects.values()].sort((a, b) => tokens(b.v) - tokens(a.v)),
    heaviest: [...sessions]
      .sort((a, b) => tokens(b.v) - tokens(a.v))
      .slice(0, 40),
  };
}
export function calendarDays(
  days: ReportBucket[],
): { day: string; v: Vector; month: string }[] {
  if (!days.length) return [];
  const first = new Date(days[0].key + "T12:00:00Z"),
    last = new Date(days.at(-1)!.key + "T12:00:00Z");
  first.setUTCDate(first.getUTCDate() - first.getUTCDay());
  last.setUTCDate(last.getUTCDate() + 6 - last.getUTCDay());
  const map = new Map(days.map((d) => [d.key, d.v]));
  const result: { day: string; v: Vector; month: string }[] = [];
  for (
    const date = new Date(first);
    date <= last;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const day = date.toISOString().slice(0, 10);
    result.push({
      day,
      v: map.get(day) ?? vec(),
      month:
        date.getUTCDate() === 1
          ? date.toLocaleDateString("en-US", {
              month: "short",
              timeZone: "UTC",
            })
          : "",
    });
  }
  return result;
}
export function claudeComparison(payload: ClaudePayload) {
  const real = new Map<string, number>();
  for (const h of Object.values(payload.hours))
    for (const models of Object.values(h))
      for (const [m, v] of Object.entries(models))
        real.set(m, (real.get(m) ?? 0) + v[0] + v[1] + v[2] + v[3] + v[4]);
  const output = Object.values(payload.appBasis).reduce((n, v) => n + v[4], 0),
    total = [...real.values()].reduce((n, v) => n + v, 0);
  return Object.entries(payload.appBasis)
    .map(([model, v]) => ({
      model,
      input: v[0],
      output: v[4],
      cardShare: output ? v[4] / output : 0,
      actual: real.get(model) ?? 0,
      realShare: total ? (real.get(model) ?? 0) / total : 0,
      hidden: v[0] ? (real.get(model) ?? 0) / v[0] : null,
    }))
    .sort((a, b) => b.output - a.output);
}
export function claudeCostRows(
  payload: ClaudePayload,
  groups: ReportBucket[],
  includeTotal = false,
) {
  const rows = groups
    .flatMap((g) => {
      const separator = g.key.indexOf("::"),
        model = separator < 0 ? g.key : g.key.slice(separator + 2),
        r = payload.rates[model];
      // Only model-grouped buckets carry a Claude rate.
      if (!r) return [];
      return {
        model: r.label,
        known: r.known,
        rate: `$${r.input} / $${r.output}`,
        input: (g.v[0] * r.input) / 1e6,
        cacheWrite: (g.cw5 * r.write5m + g.cw1 * r.write1h) / 1e6,
        cacheRead: (g.v[2] * r.cacheRead) / 1e6,
        output: (g.v[3] * r.output) / 1e6,
        total: g.v[6],
      };
    })
    .sort((a, b) => b.total - a.total);
  if (includeTotal) {
    const total = {
      model: "Total",
      known: true,
      rate: "",
      input: 0,
      cacheWrite: 0,
      cacheRead: 0,
      output: 0,
      total: 0,
    };
    for (const r of rows)
      for (const key of [
        "input",
        "cacheWrite",
        "cacheRead",
        "output",
        "total",
      ] as const)
        total[key] += r[key];
    rows.push(total);
  }
  return rows;
}

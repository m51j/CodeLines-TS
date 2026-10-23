import type {
  AgentPayload,
  AgentSession,
  ClaudePayload,
  ClaudeSession,
  Hours,
  Vector,
  ClaudeVector,
} from "../shared/contracts";
import {
  type AgentRecord,
  type ClaudeRecord,
  record,
  vec,
  cv,
  add,
  dayParts,
  timezoneLabel,
  plausibleTs,
  partialCost,
} from "./model";
import { claudeCost, claudeRate, costOf } from "./pricing";
export interface AgentSource {
  id: string;
  label: string;
  note?: string;
  records: AgentRecord[];
}
const top = (weights: Map<string, number>) => {
  let key = "",
    best = -Infinity;
  for (const [k, v] of weights)
    if (v > best) {
      best = v;
      key = k;
    }
  return key;
};
function bucket<V>(
  hours: Hours<V>,
  day: string,
  hour: number,
  key: string,
  empty: () => V,
): V {
  const d = (hours[day] ??= Object.create(null) as Record<
    string,
    Record<string, V>
  >);
  const h = (d[hour] ??= Object.create(null) as Record<string, V>);
  return (h[key] ??= empty());
}
const cvector = (r: ClaudeRecord): ClaudeVector => [
  r.input,
  r.cacheWrite5m,
  r.cacheWrite1h,
  r.cacheRead,
  r.output,
  1,
  r.thinking,
];
export function aggregateClaude(
  records: ClaudeRecord[],
  utc: boolean,
  dedupe = true,
  since = -Infinity,
  until = Infinity,
  generatedAt = Date.now(),
): ClaudePayload {
  const seen = new Map<string, ClaudeRecord>(),
    kept: ClaudeRecord[] = [],
    appBasis: Record<string, ClaudeVector> = Object.create(null);
  let raw = 0,
    duplicates = 0,
    partials = 0;
  for (const r of records) {
    if (r.ts < since || r.ts > until || !plausibleTs(r.ts)) continue;
    raw++;
    add((appBasis[r.model] ??= cv()), cvector(r));
    if (dedupe && r.request) {
      const previous = seen.get(r.request);
      if (previous) {
        duplicates++;
        if (
          [r.input, r.cacheWrite5m, r.cacheWrite1h, r.cacheRead, r.output].some(
            (x, i) =>
              x !==
              [
                previous.input,
                previous.cacheWrite5m,
                previous.cacheWrite1h,
                previous.cacheRead,
                previous.output,
              ][i],
          )
        )
          partials++;
        if (r.output > previous.output) seen.set(r.request, r);
        continue;
      }
      seen.set(r.request, r);
    }
    kept.push(r);
  }
  const winners = kept.map((r) =>
      dedupe && r.request ? seen.get(r.request)! : r,
    ),
    hours: Hours<ClaudeVector> = Object.create(null),
    states = new Map<
      string,
      {
        row: ClaudeSession;
        vector: ClaudeVector;
        models: Map<string, number>;
        cost: number;
      }
    >(),
    models = new Set<string>();
  let first = Infinity,
    last = -Infinity;
  for (const r of winners) {
    const { day, hour } = dayParts(r.ts, utc),
      v = cvector(r);
    models.add(r.model);
    first = Math.min(first, r.ts);
    last = Math.max(last, r.ts);
    add(bucket(hours, day, hour, r.model, cv), v);
    const sid = r.session || "unknown";
    let s = states.get(sid);
    if (!s) {
      s = {
        row: [sid, r.ts, r.ts, 0, 0, 0, 0, 0, 0, r.cwd, r.branch, ""],
        vector: cv(),
        models: new Map(),
        cost: 0,
      };
      states.set(sid, s);
    }
    s.row[1] = Math.min(s.row[1], r.ts);
    if (r.ts > s.row[2]) {
      s.row[2] = r.ts;
      if (r.cwd) s.row[9] = r.cwd;
      if (r.branch) s.row[10] = r.branch;
    }
    add(s.vector, v);
    s.cost += claudeCost(r);
    s.models.set(
      r.model,
      (s.models.get(r.model) ?? 0) + r.output + r.cacheRead,
    );
  }
  const sessions = [...states.values()]
    .map((s) => {
      const v = s.vector;
      s.row[3] = v[5];
      s.row[4] = v[0];
      s.row[5] = v[1];
      s.row[6] = v[2];
      s.row[7] = v[3];
      s.row[8] = v[4];
      s.row[11] = top(s.models);
      s.row[12] = s.cost;
      return s.row;
    })
    .sort((a, b) => a[1] - b[1]);
  const sorted = [...models].sort();
  const rates = Object.fromEntries(sorted.map((m) => [m, claudeRate(m)]));
  return {
    meta: {
      generatedAt,
      tz: utc ? "utc" : "local",
      tzLabel: timezoneLabel(utc),
      dedupe,
      rawRecords: raw,
      countedRecords: winners.length,
      duplicateRecords: duplicates,
      partialRecords: partials,
      inflation: winners.length ? raw / winners.length : 0,
      firstTs: winners.length ? first : null,
      lastTs: winners.length ? last : null,
      sessions: sessions.length,
      unknownModels: sorted.filter((m) => !rates[m].known),
    },
    rates,
    models: sorted,
    hours,
    sessions,
    appBasis,
  };
}
// The combined legacy view always deduplicates Claude, even while its detailed report is in raw mode.
export function fromClaude(records: ClaudeRecord[]): AgentRecord[] {
  const byRequest = new Map<string, ClaudeRecord>(),
    ordered: ClaudeRecord[] = [];
  for (const r of records) {
    if (!r.request) ordered.push(r);
    else {
      const previous = byRequest.get(r.request);
      if (!previous || r.output > previous.output) byRequest.set(r.request, r);
    }
  }
  ordered.push(...byRequest.values());
  return ordered.map((r) =>
    record({
      ...r,
      cacheWrite: r.cacheWrite5m + r.cacheWrite1h,
      cost: claudeCost(r),
    }),
  );
}
export function aggregateAgents(
  sources: AgentSource[],
  title: string,
  utc: boolean,
  since = -Infinity,
  until = Infinity,
  generatedAt = Date.now(),
): AgentPayload {
  const hours: Hours<Vector> = Object.create(null),
    states = new Map<
      string,
      { row: AgentSession; weights: Map<string, number> }
    >(),
    keys = new Set<string>(),
    agents: AgentPayload["agents"] = Object.create(null);
  let first = Infinity,
    last = -Infinity,
    counted = 0,
    dropped = 0;
  for (const source of sources) {
    agents[source.id] = { label: source.label, note: source.note ?? "" };
    const seen = new Set<string>();
    for (const r of source.records) {
      if (r.ts < since || r.ts > until || !plausibleTs(r.ts)) continue;
      if (r.request && seen.has(r.request)) {
        dropped++;
        continue;
      }
      if (r.request) seen.add(r.request);
      counted++;
      const key = source.id + "::" + r.model;
      keys.add(key);
      const cost = costOf(r),
        v: Vector = [
          r.input,
          r.cacheWrite,
          r.cacheRead,
          r.output,
          r.calls,
          r.thinking,
          cost ?? 0,
          cost === null ? 0 : r.input + r.cacheWrite + r.cacheRead + r.output,
        ];
      const { day, hour } = dayParts(r.ts, utc);
      first = Math.min(first, r.ts);
      last = Math.max(last, r.ts);
      add(bucket(hours, day, hour, key, vec), v);
      const sid = source.id + "::" + (r.session || "unknown");
      let s = states.get(sid);
      if (!s) {
        s = {
          row: [source.id, r.session, r.ts, r.ts, r.cwd, "", ...vec()],
          weights: new Map(),
        };
        states.set(sid, s);
      }
      s.row[2] = Math.min(s.row[2], r.ts);
      if (r.ts >= s.row[3]) {
        s.row[3] = r.ts;
        if (r.cwd) s.row[4] = r.cwd;
      }
      for (let i = 0; i < 8; i++) s.row[i + 6] = Number(s.row[i + 6]) + v[i];
      s.weights.set(
        key,
        (s.weights.get(key) ?? 0) + r.output + r.cacheRead + r.input,
      );
    }
  }
  const sessions = [...states.values()]
    .map((s) => {
      s.row[5] = top(s.weights);
      return s.row;
    })
    .sort((a, b) => a[2] - b[2]);
  return {
    meta: {
      title,
      generatedAt,
      tz: utc ? "utc" : "local",
      tzLabel: timezoneLabel(utc),
      countedRecords: counted,
      droppedDuplicates: dropped,
      firstTs: counted ? first : null,
      lastTs: counted ? last : null,
      sessions: sessions.length,
    },
    agents,
    keys: [...keys].sort(),
    hours,
    sessions,
  };
}
export function payloadTotals(
  payload: AgentPayload,
  filter: (day: string, key: string) => boolean = () => true,
): Vector {
  const total = vec();
  for (const [d, hours] of Object.entries(payload.hours))
    for (const h of Object.values(hours))
      for (const [k, v] of Object.entries(h)) if (filter(d, k)) add(total, v);
  return total;
}
export const sessionVector = (s: AgentSession) => s.slice(6) as Vector;
export function costText(v: Vector): string {
  return !v[7] && v[6] === 0
    ? "—"
    : currency(v[6]) + (partialCost(v) ? "*" : "");
}
export function currency(value: number): string {
  return value >= 1000
    ? "$" + Math.round(value).toLocaleString("en-US")
    : "$" + value.toFixed(value >= 1 ? 2 : 3);
}

import type { ClaudeVector, Vector } from "../shared/contracts";
export interface AgentRecord {
  ts: number;
  model: string;
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
  thinking: number;
  cost: number | null;
  session: string;
  request: string;
  cwd: string;
  calls: number;
}
export interface ClaudeRecord {
  ts: number;
  model: string;
  input: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
  output: number;
  thinking: number;
  session: string;
  request: string;
  cwd: string;
  branch: string;
}
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export const obj = (x: unknown): Record<string, JsonValue> =>
  x !== null && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, JsonValue>)
    : {};
export const arr = (x: unknown): JsonValue[] => (Array.isArray(x) ? x : []);
export const num = (x: unknown): number =>
  typeof x === "number" && Number.isFinite(x) ? x : 0;
export const str = (x: unknown): string => (typeof x === "string" ? x : "");
export const textOr = (...values: unknown[]): string => {
  const v = values.find(Boolean);
  return v === undefined ? "" : String(v);
};
export function record(
  value: Partial<AgentRecord> & Pick<AgentRecord, "ts">,
): AgentRecord {
  const r = {
    model: "unknown",
    input: 0,
    cacheWrite: 0,
    cacheRead: 0,
    output: 0,
    thinking: 0,
    cost: null,
    session: "",
    request: "",
    cwd: "",
    calls: 1,
    ...value,
  };
  r.model ||= "unknown";
  for (const k of [
    "input",
    "cacheWrite",
    "cacheRead",
    "output",
    "thinking",
  ] as const)
    r[k] = num(r[k]);
  r.input = Math.max(0, r.input);
  if (r.cost !== null && !Number.isFinite(r.cost)) r.cost = null;
  return r;
}
// Records outside this range come from corrupt or zeroed timestamps; one such
// value would otherwise break date bucketing for every agent.
const earliestTs = Date.UTC(2000, 0, 1),
  latestTs = Date.UTC(2100, 0, 1);
export const plausibleTs = (ts: number): boolean =>
  Number.isFinite(ts) && ts >= earliestTs && ts < latestTs;
export const vec = (): Vector => [0, 0, 0, 0, 0, 0, 0, 0];
export const cv = (): ClaudeVector => [0, 0, 0, 0, 0, 0, 0];
export const tokens = (v: readonly number[]): number =>
  v[0] + v[1] + v[2] + v[3];
/** Vector index 7 holds the tokens that have a known price; fewer than all means a partial cost. */
export const partialCost = (v: readonly number[]): boolean =>
  v[7] < tokens(v) * 0.999;
export const claudeTokens = (v: readonly number[]): number =>
  v[0] + v[1] + v[2] + v[3] + v[4];
export function add(a: number[], b: readonly number[]): void {
  for (let i = 0; i < a.length; i++) a[i] += b[i];
}
export function dayParts(
  ts: number,
  utc: boolean,
): { day: string; hour: number } {
  const date = new Date(ts);
  return {
    day: utc
      ? date.toISOString().slice(0, 10)
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    hour: utc ? date.getUTCHours() : date.getHours(),
  };
}
export function timezoneLabel(utc: boolean): string {
  if (utc) return "UTC";
  const min = -new Date().getTimezoneOffset(),
    a = Math.abs(min);
  return `local (UTC${min < 0 ? "-" : "+"}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")})`;
}
export const parseTimestamp = (x: unknown): number | null =>
  typeof x === "string" && Number.isFinite(Date.parse(x))
    ? Date.parse(x)
    : null;

import tables from "./rates-v1.json";
import type { Rate } from "../shared/contracts";
import type { AgentRecord, ClaudeRecord } from "./model";
// Frozen from CodeLines 09e7112. This is parity data, not a live pricing feed.
export const pricingVersion = "codelines-2026-10-05-v1";
export const normalizeClaude = (s: string) =>
  s
    .replace(/-\d{8}$/, "")
    .replace(/^anthropic\./, "")
    .replace(/@\d{8}$/, "");
export function displayClaude(s: string): string {
  const id = normalizeClaude(s);
  return id.replace(
    /^claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d+))?$/,
    (_, f: string, a: string, b?: string) =>
      f[0].toUpperCase() + f.slice(1) + " " + a + (b ? "." + b : ""),
  );
}
export function claudeRate(model: string): Rate {
  const table: Record<string, (number | null)[]> = tables.claude;
  const id = normalizeClaude(model);
  const row = Object.hasOwn(table, id) ? table[id] : undefined,
    r = row ?? [5, 25, null];
  const input = r[0]!,
    output = r[1]!;
  return {
    input,
    output,
    cacheRead: r[2] ?? input * 0.1,
    write5m: input * 1.25,
    write1h: input * 2,
    known: !!row,
    label: displayClaude(model),
  };
}
/** Cost of Claude token counts at per-million rates, in the vector order input, 5m write, 1h write, cache read, output. */
export const rateCost = (
  p: Rate,
  input: number,
  write5m: number,
  write1h: number,
  cacheRead: number,
  output: number,
): number =>
  (input * p.input +
    write5m * p.write5m +
    write1h * p.write1h +
    cacheRead * p.cacheRead +
    output * p.output) /
  1e6;
export function claudeCost(
  r: Pick<
    ClaudeRecord,
    "model" | "input" | "cacheWrite5m" | "cacheWrite1h" | "cacheRead" | "output"
  >,
): number {
  return rateCost(
    claudeRate(r.model),
    r.input,
    r.cacheWrite5m,
    r.cacheWrite1h,
    r.cacheRead,
    r.output,
  );
}
export function listRate(model: string): {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
} | null {
  const raw = model.toLowerCase();
  let id = raw
    .slice(raw.lastIndexOf("/") + 1)
    .replace(/-(thinking|xhigh|high|medium|low|max|agent)$/, "");
  if (id === "gemini-3-flash") id = "gemini-3-flash-preview";
  const table: Record<string, (number | null)[]> = tables.agent;
  const r = Object.hasOwn(table, raw)
    ? table[raw]
    : Object.hasOwn(table, id)
      ? table[id]
      : undefined;
  if (r)
    return {
      input: r[0]!,
      cacheRead: r[1] ?? r[0]!,
      cacheWrite: r[2] ?? r[0]!,
      output: r[3]!,
    };
  if (!id.startsWith("claude-")) return null;
  const c = claudeRate(id.replaceAll(".", "-"));
  return c.known
    ? {
        input: c.input,
        cacheRead: c.cacheRead,
        cacheWrite: c.write5m,
        output: c.output,
      }
    : null;
}
export function costOf(r: AgentRecord): number | null {
  if (r.cost !== null) return r.cost;
  const p = listRate(r.model);
  return p
    ? (r.input * p.input +
        r.cacheWrite * p.cacheWrite +
        r.cacheRead * p.cacheRead +
        r.output * p.output) /
        1e6
    : null;
}

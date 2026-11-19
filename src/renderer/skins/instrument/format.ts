/** Formatting and colour helpers shared by the Instrument pages (numbers come from ../../format). */
import type { Progress, Vector } from "../../../shared/contracts";
import { agentLabels } from "../../../shared/agents";
import { tokens } from "../../../ai/model";
import { costText } from "../../../ai/aggregate";
import { number } from "../../format";
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const dateTime = (t: number | string) =>
  new Date(t).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const shortDate = (day: string, year = false) =>
  new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: year ? "numeric" : undefined, timeZone: "UTC" });
export const longDate = (day: string) =>
  new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export const dayNum = (day: string) => Math.round(Date.parse(day + "T00:00:00Z") / 864e5);
export const minutesText = (m: number) => {
  const total = Math.round(m),
    hr = Math.floor(total / 60);
  return hr ? `${hr}h ${pad2(total % 60)}m` : `${total}m`;
};
/** Twelve categorical series colours (agents, languages), tuned per theme in tokens.css. */
const agentIndex = Object.fromEntries(Object.keys(agentLabels).map((id, i) => [id, i + 1]));
export const agentColor = (id: string) => `var(--s${agentIndex[id] ?? 12})`;
export const agentIdx = (id: string) => agentIndex[id] ?? 12;
const LANGS = [
  "TypeScript", "JavaScript", "Python", "C#", "Rust", "Go", "Java", "C/C++", "C++", "C", "Kotlin", "Swift",
  "CSS", "HTML", "Markdown", "JSON", "YAML", "Shell", "PowerShell", "SQL", "Dart", "Ruby", "PHP", "TOML",
];
const hash = (s: string) => {
  let x = 0;
  for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return x;
};
export const langColor = (name: string) => {
  const i = LANGS.indexOf(name);
  return `var(--s${((i < 0 ? hash(name) : i) % 12) + 1})`;
};
/** A row of a rich tooltip: [label, value, swatch colour?, class?] or a rule. */
export type TipRow = [string, string, (string | null)?, string?] | "-";
/** The full token breakdown every AI chart tooltip shows. */
export const vectorRows = (v: Vector): TipRow[] => [
  ["Real tokens", number(tokens(v)), null, "is-strong"],
  ["Input", number(v[0]), "var(--tk-input)"],
  ["Cache write", number(v[1]), "var(--tk-cw)"],
  ["Cache read", number(v[2]), "var(--tk-cr)"],
  ["Output", number(v[3]), "var(--tk-out)"],
  ["Calls", number(v[4])],
  ["Reasoning (included in output)", number(v[5])],
  ["API equivalent", costText(v)],
];
/** How far an operation has come, 0…1, for the lifeline and the status bar. */
export function progressFraction(p: Progress | null): number {
  if (!p) return 0;
  const inner = p.total ? Math.min(1, p.completed / p.total) : 0;
  if (p.projectCount && p.projectIndex !== undefined)
    return Math.min(1, (p.projectIndex + inner) / p.projectCount);
  return inner;
}

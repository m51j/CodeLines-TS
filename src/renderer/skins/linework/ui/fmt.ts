/** Linework's readout formats and fixed series colours (on top of ../../format). */
import { agentLabels } from "../../../../shared/agents";
import { number } from "../../../format";

export { number, percent, compact, tileNumber, money, duration, scopeLabel, categoryLabel, modeLabel, categories, lines } from "../../../format";

/** Signed with a true minus sign, as the prototype's readouts. */
export const signed = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Math.round(v)).toLocaleString("en-US");
export const date = (value: string | number) =>
  new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const day = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const shortDay = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const axis = (v: number) => Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v);
export const plural = (n: number, one: string, many = one + "s") => `${number(n)} ${n === 1 ? one : many}`;

/** Twelve fixed series colours (tokens.css); languages and agents never depend on the accent. */
const fixedLanguage: Record<string, number> = {
  TypeScript: 1, JavaScript: 4, "C#": 3, Python: 5, Kotlin: 9, Swift: 11, Rust: 8, Go: 10, SQL: 2, CSS: 6, HTML: 7,
  Markdown: 12, JSON: 7, YAML: 2, XML: 8, TOML: 4, PowerShell: 5, Shell: 10,
};
const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
export const langColor = (name: string) => `var(--s-${fixedLanguage[name] ?? (hash(name) % 12) + 1})`;
const agentIds = Object.keys(agentLabels);
export const agentColor = (id: string) => {
  const i = agentIds.indexOf(id);
  return `var(--s-${((i < 0 ? hash(id) : i) % 12) + 1})`;
};
export const seriesColor = (i: number) => `var(--s-${(i % 12) + 1})`;

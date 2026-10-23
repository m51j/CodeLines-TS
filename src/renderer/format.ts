import type { Category, HistoryOptions, Scope } from "../shared/contracts";
export const number = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : Math.round(v).toLocaleString("en-US");
export const signed = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : (v > 0 ? "+" : "") + number(v);
export const percent = (v: number) => `${(v * 100).toFixed(1)}%`;
export const compact = (n: number) =>
  Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
/** Exact below a million, compact above, so large values fit in a tile. */
export const tileNumber = (v: number | null | undefined) =>
  v === null || v === undefined || Math.abs(v) < 1e6 ? number(v) : compact(v);
export const money = (cost: number, partial: boolean) =>
  "$" + cost.toFixed(2) + (partial ? "*" : "");
export const duration = (ms: number) =>
  `${Math.floor(ms / 60000)}m ${Math.floor(ms / 1000) % 60}s`;
export const scopeLabel = (s: Scope | string) =>
  s === "SourceOnly"
    ? "Source only"
    : s === "SourceAndConfiguration"
      ? "Source + configuration"
      : "All verified text";
export const categories: Category[] = [
  "SourceCode",
  "Configuration",
  "DocumentationText",
];
export const categoryLabel = (c: Category | string) =>
  c === "SourceCode"
    ? "Source code"
    : c === "DocumentationText"
      ? "Documentation"
      : c;
export const modeLabel = (m: HistoryOptions["mode"] | string) =>
  m === "NetChange" ? "Net change" : m;
/** Removes Electron's IPC wrapping, e.g. "Error: Error invoking remote method 'x': Error: msg". */
export const errorMessage = (e: unknown) =>
  (e instanceof Error ? e.message : String(e))
    .replace(/^(?:Error:\s*)?Error invoking remote method '[^']*':\s*/, "")
    .replace(/^(?:[A-Za-z]*Error:\s*)+/, "");
export const palette = [
  "#6d8bff",
  "#38bca4",
  "#b396f5",
  "#e5aa59",
  "#61bce6",
  "#e38097",
  "#a4bc6b",
  "#bc9b80",
  "#d595d0",
  "#65a5a0",
  "#d27656",
  "#9babe4",
];
export const lines = (parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" · ");

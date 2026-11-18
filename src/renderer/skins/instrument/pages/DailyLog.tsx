/** Daily log: the trend, the timeline, and a comparison between two dates. */
import { useMemo, useState } from "react";
import { compareDays, effectiveLines, timeline, type Effective, type TimelineRow } from "../../../../domain/daily";
import { categoryLabel, compact, money, number, percent, signed } from "../../../format";
import { useWorkspace } from "../../../workspace";
import { memo } from "../context";
import { langColor, shortDate, type TipRow } from "../format";
import { LineChart, type LinePoint } from "../charts";
import { Button, Check, Select, Seg } from "../ui/controls";
import { Empty, Notice, Panel, SwapIn } from "../ui/layout";
import { toast } from "../ui/overlays";
import { DataTable, type Column } from "../ui/Table";
type Comparison = ReturnType<typeof compareDays>;
const delta = <T,>(key: string, label: string, get: (r: T) => number | null | undefined): Column<T> => ({
  key,
  label,
  value: get,
  render: (r) => {
    const v = get(r);
    return <span className={v ? (v > 0 ? "up" : "down") : ""}>{signed(v)}</span>;
  },
});
const timelineColumns: Column<TimelineRow>[] = [
  { key: "date", label: "Date", value: (r) => r.date, path: true, className: "mono" },
  { key: "projects", label: "Projects", value: (r) => r.projects },
  { key: "carried", label: "Carried", value: (r) => r.carriedProjects },
  { key: "files", label: "Files", value: (r) => r.lines?.files },
  { key: "lines", label: "Lines", value: (r) => r.lines?.physicalLines },
  delta("delta", "Δ lines", (r) => r.deltaLines),
  { key: "code", label: "Code", value: (r) => r.lines?.codeLines },
  delta("deltaCode", "Δ code", (r) => r.deltaCode),
  { key: "tokens", label: "Tokens", value: (r) => r.lines?.tokens },
  delta("deltaTokens", "Δ tokens", (r) => r.deltaTokens),
  { key: "ai", label: "AI tokens", value: (r) => r.ai?.tokens, bar: true },
  { key: "cost", label: "API equivalent", value: (r) => r.ai?.cost, render: (r) => (r.ai ? money(r.ai.cost, r.ai.costPartial) : "—") },
  {
    key: "notes",
    label: "Notes",
    value: (r) => r.notes,
    className: "col-notes",
    render: (r) => (
      <span className="cell-note" title={r.notes}>
        {r.notes}
      </span>
    ),
  },
];
const METRIC_LABELS: Record<string, string> = {
  files: "Files",
  tokens: "Tokens",
  physicalLines: "Physical lines",
  blankLines: "Blank lines",
  codeLines: "Code lines",
  commentLines: "Comment lines",
  contentLines: "Content lines",
};
type MetricRow = Comparison["metrics"][number];
const isCost = (r: MetricRow) => r.metric.startsWith("AI cost");
const metricColumns: Column<MetricRow>[] = [
  { key: "metric", label: "Metric", path: true, value: (r) => METRIC_LABELS[r.metric] ?? r.metric },
  { key: "a", label: "Day A", value: (r) => r.a, render: (r) => (r.a === null ? "—" : isCost(r) ? money(r.a, false) : number(r.a)) },
  { key: "b", label: "Day B", value: (r) => r.b, render: (r) => (r.b === null ? "—" : isCost(r) ? money(r.b, false) : number(r.b)) },
  {
    key: "delta",
    label: "Δ",
    value: (r) => r.delta,
    render: (r) => (
      <span className={r.delta ? (r.delta > 0 ? "up" : "down") : ""}>
        {r.delta !== null && isCost(r) ? (r.delta > 0 ? "+" : r.delta < 0 ? "−" : "") + money(Math.abs(r.delta), false) : signed(r.delta)}
      </span>
    ),
  },
  { key: "percent", label: "Δ %", value: (r) => r.deltaPercent, render: (r) => (r.deltaPercent === null ? "—" : (r.deltaPercent > 0 ? "+" : "") + percent(r.deltaPercent)) },
];
type LangRow = Comparison["languages"][number];
const languageColumns: Column<LangRow>[] = [
  {
    key: "language",
    label: "Language",
    path: true,
    value: (r) => r.language,
    render: (r) => (
      <span className="agent-name">
        <i className="dot" style={{ background: langColor(r.language) }} />
        <span className="cell-path">{r.language}</span>
      </span>
    ),
  },
  { key: "category", label: "Category", value: (r) => categoryLabel(r.category) },
  { key: "linesA", label: "Lines A", value: (r) => r.linesA },
  { key: "linesB", label: "Lines B", value: (r) => r.linesB },
  { key: "codeA", label: "Code A", value: (r) => r.codeA },
  { key: "codeB", label: "Code B", value: (r) => r.codeB },
  delta<LangRow>("deltaLines", "Δ lines", (r) => r.deltaLines),
  delta<LangRow>("deltaCode", "Δ code", (r) => r.deltaCode),
];
const effectiveColumns: Column<Effective>[] = [
  { key: "name", label: "Project", value: (r) => r.entry.name, path: true },
  { key: "date", label: "Scanned on", value: (r) => r.scannedOn, className: "mono" },
  {
    key: "carried",
    label: "Carried forward",
    value: (r) => (r.isCarried ? "Yes" : "No"),
    render: (r) => <span className={"pill " + (r.isCarried ? "is-warn" : "is-loaded")}>{r.isCarried ? "Yes" : "No"}</span>,
  },
  { key: "lines", label: "Physical lines", value: (r) => r.entry.physicalLines, bar: true },
  { key: "tokens", label: "Tokens", value: (r) => r.entry.tokens },
];
const TREND = [
  ["physicalLines", "Lines", "var(--accent)"],
  ["codeLines", "Code", "var(--success)"],
  ["tokens", "Tokens", "var(--s3)"],
  ["ai", "AI tokens", "var(--s1)"],
] as const;
type TrendKey = (typeof TREND)[number][0];
export function DailyLog() {
  const { state, draft, busy, exportData } = useWorkspace();
  const projects = draft.projects;
  const [sel, setSelState] = useState(() => ({
    ...memo.daily,
    project: memo.daily.project !== "enabled" && !projects.some((p) => p.id === memo.daily.project) ? "enabled" : memo.daily.project,
  }));
  const set = (patch: Partial<typeof sel>) =>
    setSelState((s) => {
      const next = { ...s, ...patch };
      memo.daily = next;
      return next;
    });
  const ids = useMemo(() => (sel.project === "enabled" ? projects.filter((p) => p.isEnabled).map((p) => p.id) : [sel.project]), [sel.project, projects]);
  const rows = useMemo(() => timeline(state.daily, ids, sel.allAgents), [state.daily, ids, sel.allAgents]),
    newest = useMemo(() => [...rows].reverse(), [rows]),
    dates = useMemo(() => newest.map((r) => r.date), [newest]),
    a = dates.includes(sel.dateA) ? sel.dateA : dates[1] || dates[0] || "",
    b = dates.includes(sel.dateB) ? sel.dateB : dates[0] || "";
  const comparison = useMemo(() => compareDays(state.daily, a, b, ids, sel.allAgents), [state.daily, a, b, ids, sel.allAgents]),
    effective = useMemo(() => effectiveLines(state.daily, b, ids), [state.daily, b, ids]);
  const metric = (TREND.find((x) => x[0] === sel.metric) ?? TREND[0])[0] as TrendKey;
  const trend = useMemo(() => {
    const [key, label, color] = TREND.find((x) => x[0] === metric) ?? TREND[0];
    // Days without a value for this metric (not scanned yet / no AI record) are left out of the line.
    const points: LinePoint[] = rows
      .filter((r) => (key === "ai" ? !!r.ai : !!r.lines))
      .map((r) => {
        const value = key === "ai" ? (r.ai?.tokens ?? null) : (r.lines?.[key] ?? null);
        const tipRows: TipRow[] = [
          [label, value === null ? "—" : number(value), color],
          ["Projects", number(r.projects)],
          ["AI tokens", r.ai ? number(r.ai.tokens) : "—"],
        ];
        if (r.notes) tipRows.push(["Notes", r.notes]);
        return { name: r.date, title: shortDate(r.date, true), value, rows: tipRows };
      });
    return { points, color };
  }, [rows, metric]);
  const pick = (date: string) => {
    set({ dateB: date });
    toast("Date B set to " + date, { icon: "calendar", ms: 2200 });
  };
  return (
    <>
      <div className="toolbar section-toolbar">
        <label className="inline-field">
          <span>Projects</span>
          <Select
            label="Daily log project"
            value={sel.project}
            options={[["enabled", "All enabled projects"] as [string, string], ...projects.map((p) => [p.id, p.name] as [string, string])]}
            onChange={(v) => set({ project: v, allAgents: v === "enabled" })}
          />
        </label>
        <Check label="AI usage of the whole computer" checked={sel.allAgents} onChange={(v) => set({ allAgents: v })} />
        <span className="spacer" />
        <Button label="Export daily CSV" icon="download" disabled={!!busy || !rows.length} onClick={() => void exportData("daily", "csv", { projectIds: ids, allAgents: sel.allAgents })} />
      </div>
      <p className="muted">Latest scan per project per day. Earlier project values carry forward and are identified below.</p>
      {!rows.length ? (
        <Empty art="timeline" title="Your timeline starts here" text="Every completed scan records today’s project values. AI refreshes add daily usage." />
      ) : (
        <div className="stack">
          <Panel
            title="Trend"
            subtitle="Scanned totals over time · click a day to make it Date B"
            tools={
              <Seg<TrendKey>
                label="Trend metric"
                role="radiogroup"
                className="seg-sm"
                value={metric}
                options={TREND.map(([value, label]) => ({ value, label }))}
                onChange={(v) => set({ metric: v })}
              />
            }
          >
            <LineChart label="Daily trend" height={210} points={trend.points} color={trend.color} format={compact} picked={b} onPick={pick} />
          </Panel>
          <Panel title="Daily timeline">
            <DataTable label="Daily log timeline" rows={newest} rowKey={(r) => r.date} columns={timelineColumns} />
          </Panel>
          <div className="toolbar section-toolbar compare-bar">
            <h2>Compare dates</h2>
            <Select label="Comparison date A" value={a} options={dates} onChange={(v) => set({ dateA: v })} />
            <span className="compare-arrow" aria-hidden="true">
              →
            </span>
            <Select label="Comparison date B" value={b} options={dates} onChange={(v) => set({ dateB: v })} />
          </div>
          {comparison.warning && (
            <SwapIn key={comparison.warning} dir={0} y={-6} dur={240}>
              <Notice>{comparison.warning}</Notice>
            </SwapIn>
          )}
          <div className="grid-2">
            <Panel title="Overall difference">
              <DataTable label="Date comparison metrics" rows={comparison.metrics} rowKey={(r) => r.metric} columns={metricColumns} searchMin={99} />
            </Panel>
            <Panel title={"Project values as of " + b}>
              <DataTable label="Effective project values" rows={effective} rowKey={(r) => r.entry.projectId} columns={effectiveColumns} />
            </Panel>
          </div>
          <Panel title="Language difference">
            <DataTable label="Date comparison languages" rows={comparison.languages} rowKey={(r) => r.language + r.category} columns={languageColumns} />
          </Panel>
        </div>
      )}
    </>
  );
}

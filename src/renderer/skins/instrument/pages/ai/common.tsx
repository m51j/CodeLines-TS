/** Shared pieces of the AI usage report: the report context, colours, columns and the chart ⇄ table panel. */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { AgentStatus, Vector } from "../../../../../shared/contracts";
import { tokens } from "../../../../../ai/model";
import { costText } from "../../../../../ai/aggregate";
import type { reportModel, ReportBucket, selectReport } from "../../../../../reports/selectors";
import { percent } from "../../../../format";
import { play } from "../../../../motion/core";
import { agentColor, agentIdx } from "../../format";
import { Disclosure } from "../../ui/controls";
import { Panel, ViewSwitch } from "../../ui/layout";
import { DataTable, type Column } from "../../ui/Table";
import type { AiSelection } from "../../context";
export const TABS = ["Overview", "Models", "Time", "Tables", "Projects"] as const;
export type AiTab = (typeof TABS)[number];
export interface ReportCtx {
  s: AiSelection;
  agent: string;
  model: ReturnType<typeof reportModel>;
  group: "agent" | "model";
  view: ReturnType<typeof selectReport>;
  label: (key: string) => string;
  total: number;
  colorOf: (key: string) => string;
  tzLabel: string;
  zoom: (from: string, to: string) => void;
  setAgent: (id: string) => void;
}
export const CLASSES = [
  ["Cache read", 2, "var(--tk-cr)"],
  ["Cache write", 1, "var(--tk-cw)"],
  ["Output", 3, "var(--tk-out)"],
  ["Input", 0, "var(--tk-input)"],
] as const;
const SHADES: ([string, number] | null)[] = [null, ["var(--mix-a)", 64], ["var(--mix-b)", 72], ["var(--mix-a)", 42], ["var(--mix-b)", 52]];
/**
 * Series colours never change with the range: an agent keeps its colour, and its models are shades
 * of it (all agents) or neighbouring series (one agent), ranked by all-time tokens.
 */
export const colorFor =
  (agent: string, rank: Record<string, string[]>) =>
  (key: string): string => {
    const i = key.indexOf("::");
    if (i < 0) return agentColor(key);
    const a = key.slice(0, i),
      j = rank[a] ? Math.max(0, rank[a].indexOf(key.slice(i + 2))) : 0;
    if (agent !== "all") return j === 0 ? agentColor(a) : `var(--s${((agentIdx(a) - 1 + j * 5) % 12) + 1})`;
    const sh = SHADES[Math.min(j, SHADES.length - 1)];
    return sh ? `color-mix(in oklab, ${agentColor(a)} ${sh[1]}%, ${sh[0]})` : agentColor(a);
  };
export function DotName({ color, text }: { color: string; text: string }) {
  return (
    <span className="agent-name">
      <i className="dot" style={{ background: color }} />
      <span className="cell-path" title={text}>
        {text}
      </span>
    </span>
  );
}
export function vectorCols<T>(get: (r: T) => Vector): Column<T>[] {
  return [
    { key: "input", label: "Input", value: (r) => get(r)[0] },
    { key: "cw", label: "Cache write", value: (r) => get(r)[1] },
    { key: "cr", label: "Cache read", value: (r) => get(r)[2] },
    { key: "out", label: "Output", value: (r) => get(r)[3] },
    { key: "think", label: "Reasoning¹", value: (r) => get(r)[5], hint: "¹ Reasoning is included in output" },
    { key: "requests", label: "Calls", value: (r) => get(r)[4] },
    { key: "total", label: "Real tokens", value: (r) => tokens(get(r)), bar: true },
    { key: "cost", label: "API equivalent", value: (r) => get(r)[6], render: (r) => costText(get(r)), hint: "— unknown cost · * cost covers only some tokens" },
  ];
}
export function groupCols(c: ReportCtx): Column<ReportBucket>[] {
  const cols: Column<ReportBucket>[] = [
    {
      key: "key",
      label: c.agent === "all" && c.group === "agent" ? "Agent" : "Model",
      value: (r) => c.label(r.key),
      path: true,
      render: (r, foot) => (foot ? <strong>Total</strong> : <DotName color={c.colorOf(r.key)} text={c.label(r.key)} />),
    },
    ...vectorCols<ReportBucket>((r) => r.v),
    { key: "share", label: "Share", value: (r) => tokens(r.v) / (c.total || 1), render: (r) => percent(tokens(r.v) / (c.total || 1)) },
  ];
  if (c.model.claude)
    cols.splice(
      2,
      0,
      { key: "cw5", label: "5m write", value: (r) => r.cw5, hint: "Cache writes with a 5-minute lifetime" },
      { key: "cw1", label: "1h write", value: (r) => r.cw1, hint: "Cache writes with a 1-hour lifetime" },
    );
  return cols;
}
export const totalRow = (c: ReportCtx): ReportBucket => ({ key: "Total", v: c.view.total, cw5: c.view.cw5, cw1: c.view.cw1, sessions: c.view.sessions.length });
/** A chart panel with a chart ⇄ table switch; the table is the chart's text alternative. */
export function ChartPanel({ title, subtitle, chart, table }: { title: string; subtitle?: ReactNode; chart: ReactNode; table: () => ReactNode }) {
  const [mode, setMode] = useState<"chart" | "table">("chart");
  const chartBox = useRef<HTMLDivElement>(null),
    tableBox = useRef<HTMLDivElement>(null),
    last = useRef(mode);
  useLayoutEffect(() => {
    if (last.current === mode) return;
    last.current = mode;
    const el = mode === "chart" ? chartBox.current : tableBox.current;
    play(el, [{ opacity: 0, transform: `translateX(${mode === "chart" ? -14 : 14}px)` }, { opacity: 1, transform: "none" }], { duration: 260 });
  }, [mode]);
  return (
    <Panel title={title} subtitle={subtitle} tools={<ViewSwitch value={mode} onChange={setMode} label={title + ": chart or table"} />}>
      <div className="viewhost">
        <div ref={chartBox} hidden={mode !== "chart"}>
          {chart}
        </div>
        {mode === "table" && <div ref={tableBox}>{table()}</div>}
      </div>
    </Panel>
  );
}
export function Sources({ statuses, open }: { statuses: AgentStatus[]; open: boolean }) {
  const failed = statuses.filter((a) => a.state === "Failed").length,
    loaded = statuses.filter((a) => a.state === "Loaded").length;
  return (
    <Disclosure
      className="ai-sources panel"
      defaultOpen={open}
      summary={
        <>
          Agent sources
          <span className="muted">{`${loaded} loaded · ${statuses.length} sources`}</span>
          {failed > 0 && <b className="pill is-failed">{`${failed} failed`}</b>}
        </>
      }
    >
      <DataTable
        label="AI adapter status"
        searchMin={99}
        rows={statuses}
        rowKey={(a) => a.id}
        columns={[
          { key: "agent", label: "Agent", value: (a) => a.label, render: (a) => <DotName color={agentColor(a.id)} text={a.label} /> },
          { key: "state", label: "Status", value: (a) => a.state, render: (a) => <span className={"pill is-" + a.state.toLowerCase()}>{a.state}</span> },
          { key: "records", label: "Records", value: (a) => a.records },
          {
            key: "error",
            label: "Details",
            value: (a) => a.error ?? "",
            render: (a) => <span className={a.state === "Failed" ? "text-danger" : "muted"}>{a.error ?? "—"}</span>,
          },
        ]}
      />
    </Disclosure>
  );
}

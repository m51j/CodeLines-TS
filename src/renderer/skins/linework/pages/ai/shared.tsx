/** Shared pieces of the AI usage page: the section context, vector columns and agent sources. */
import type { AgentStatus, Vector } from "../../../../../shared/contracts";
import type { ReportModel, ReportBucket, selectReport } from "../../../../../reports/selectors";
import { tokens } from "../../../../../ai/model";
import { costText } from "../../../../../ai/aggregate";
import { Disclosure } from "../../ui/controls";
import { agentColor, number } from "../../ui/fmt";
import { ShareCell, Table, type Col } from "../../ui/Table";
import type { PresetId } from "../../../../ui/dates";

export type View = ReturnType<typeof selectReport>;
export interface Selection {
  tab: "Overview" | "Models" | "Time" | "Tables" | "Projects";
  /** A named range resolved against today, or "" for the custom since/until days. */
  preset: PresetId | "";
  group: "agent" | "model";
  since: string;
  until: string;
}
export interface Ctx {
  model: ReportModel;
  view: View;
  all: boolean;
  sel: Selection;
  total: number;
  label: (key: string) => string;
  byAgentGroup: boolean;
  groupColor: Map<string, string>;
  tzLabel: string;
}

export const TOKEN_CLASSES = [
  { key: "Cache read", idx: 2, color: "var(--t-cr)" },
  { key: "Cache write", idx: 1, color: "var(--t-cw)" },
  { key: "Output", idx: 3, color: "var(--t-out)" },
  { key: "Input", idx: 0, color: "var(--t-in)" },
] as const;

export const vectorDetails = (v: Vector) =>
  `Real tokens: ${number(tokens(v))} · Input: ${number(v[0])} · Cache write: ${number(v[1])} · Cache read: ${number(v[2])} · Output: ${number(v[3])} · Calls: ${number(v[4])} · Reasoning (included in output): ${number(v[5])} · API equivalent: ${costText(v)}`;

export function vectorColumns<T>(get: (r: T) => Vector): Col<T>[] {
  return [
    { key: "input", label: "Input", value: (r) => get(r)[0] },
    { key: "cw", label: "Cache write", value: (r) => get(r)[1] },
    { key: "cr", label: "Cache read", value: (r) => get(r)[2] },
    { key: "out", label: "Output", value: (r) => get(r)[3] },
    { key: "think", label: "Reasoning¹", value: (r) => get(r)[5], title: "Reasoning is included in output" },
    { key: "requests", label: "Calls", value: (r) => get(r)[4] },
    { key: "total", label: "Real tokens", value: (r) => tokens(get(r)), cls: () => "strong" },
    { key: "cost", label: "API equivalent", num: true, value: (r) => get(r)[6], render: (r) => costText(get(r)) },
  ];
}

export const totalRow = (view: View): ReportBucket => ({ key: "Total", v: view.total, cw5: view.cw5, cw1: view.cw1, sessions: view.sessions.length });
export const isTotal = (r: { key: string }) => r.key === "Total";

/** Agent, model or total, with its series colour. */
export function groupCols(c: Ctx): Col<ReportBucket>[] {
  const total = c.total || 1;
  const cols: Col<ReportBucket>[] = [
    {
      key: "key",
      label: c.byAgentGroup ? "Agent" : "Model",
      path: true,
      value: (r) => (r.key === "Total" ? "Total" : c.label(r.key)),
      render: (r) =>
        r.key === "Total" ? (
          <b>Total</b>
        ) : (
          <span className="agent-name" title={c.label(r.key)}>
            <i style={{ background: c.groupColor.get(r.key) ?? "var(--muted)" }} />
            {c.label(r.key)}
          </span>
        ),
    },
    ...vectorColumns<ReportBucket>((r) => r.v),
    { key: "share", label: "Share", value: (r) => tokens(r.v) / total, render: (r) => <ShareCell frac={tokens(r.v) / total} /> },
  ];
  if (c.model.claude)
    cols.splice(
      3,
      0,
      { key: "cw5", label: "5m write", value: (r) => Math.round(r.cw5) },
      { key: "cw1", label: "1h write", value: (r) => Math.round(r.cw1) },
    );
  return cols;
}

export function AgentSources({ agents }: { agents: AgentStatus[] }) {
  const loaded = agents.filter((a) => a.state === "Loaded").length,
    failed = agents.filter((a) => a.state === "Failed").length;
  return (
    <Disclosure
      className="sources"
      summary={
        <>
          <span>Agent sources</span>
          <span className="muted">
            {loaded} loaded · {agents.length} sources
          </span>
          {failed > 0 && <b className="badge danger">{failed} failed</b>}
        </>
      }
    >
      <div className="sources-body">
        <Table
          label="AI adapter status"
          rows={agents}
          rowKey={(a) => a.id}
          rowCls={(a) => (a.state === "Failed" ? "row-danger" : "")}
          columns={[
            {
              key: "agent",
              label: "Agent",
              value: (a) => a.label,
              render: (a) => (
                <span className="agent-name">
                  <i style={{ background: agentColor(a.id) }} />
                  {a.label}
                </span>
              ),
            },
            { key: "state", label: "Status", value: (a) => a.state, render: (a) => <span className={"pill pill-" + a.state.toLowerCase()}>{a.state}</span> },
            { key: "records", label: "Records", value: (a) => a.records },
            {
              key: "error",
              label: "Details",
              value: (a) => a.error ?? "",
              render: (a) => (a.error ? <span className="danger-text">{a.error}</span> : "—"),
            },
          ]}
        />
      </div>
    </Disclosure>
  );
}

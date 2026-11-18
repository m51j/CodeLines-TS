/**
 * Daily log: project scope and the whole-computer AI switch, the growth chart (lines draw
 * in over rising AI-token bars), the 13-column timeline, and the date comparison with its
 * overall, per-project and per-language differences.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { compareDays, effectiveLines, timeline, type Effective, type TimelineRow } from "../../../../domain/daily";
import { play } from "../../../motion/core";
import { useWorkspace } from "../../../workspace";
import { LineChart } from "../charts/LineChart";
import { Icon } from "../icons";
import { Check, EmptyState, Field, Notice, Select, Sheet } from "../ui/controls";
import { categoryLabel, langColor, money, number, percent, signed } from "../ui/fmt";
import { currency } from "../../../../ai/aggregate";
import { Delta, Table, type Col } from "../ui/Table";

type Comparison = ReturnType<typeof compareDays>;
const delta = <T,>(key: string, label: string, get: (r: T) => number | null | undefined): Col<T> => ({
  key,
  label,
  value: get,
  render: (r) => <Delta v={get(r)} text={signed(get(r))} />,
});
const metricLabel: Record<string, string> = {
  files: "Files",
  tokens: "Tokens",
  physicalLines: "Physical lines",
  blankLines: "Blank lines",
  codeLines: "Code lines",
  commentLines: "Comment lines",
  contentLines: "Content lines",
};
const timelineCols: Col<TimelineRow>[] = [
  { key: "date", label: "Date", value: (r) => r.date, path: true },
  { key: "projects", label: "Projects", value: (r) => r.projects },
  { key: "carried", label: "Carried", value: (r) => r.carriedProjects },
  { key: "files", label: "Files", value: (r) => r.lines?.files },
  { key: "lines", label: "Lines", value: (r) => r.lines?.physicalLines },
  delta("delta", "Δ lines", (r) => r.deltaLines),
  { key: "code", label: "Code", value: (r) => r.lines?.codeLines },
  delta("deltaCode", "Δ code", (r) => r.deltaCode),
  { key: "tokens", label: "Tokens", value: (r) => r.lines?.tokens },
  delta("deltaTokens", "Δ tokens", (r) => r.deltaTokens),
  { key: "ai", label: "AI tokens", value: (r) => r.ai?.tokens },
  { key: "cost", label: "API equivalent", num: true, value: (r) => r.ai?.cost, render: (r) => (r.ai ? money(r.ai.cost, r.ai.costPartial) : "—") },
  {
    key: "notes",
    label: "Notes",
    value: (r) => r.notes,
    render: (r) =>
      r.notes ? (
        <span className="note-cell" title={r.notes}>
          {r.notes}
        </span>
      ) : (
        ""
      ),
  },
];
const isCost = (m: string) => m.startsWith("AI cost");
const metricCols: Col<Comparison["metrics"][number]>[] = [
  { key: "metric", label: "Metric", value: (r) => metricLabel[r.metric] ?? r.metric, path: true },
  { key: "a", label: "Day A", num: true, value: (r) => r.a, render: (r) => (isCost(r.metric) ? (r.a === null ? "—" : currency(r.a)) : number(r.a)) },
  { key: "b", label: "Day B", num: true, value: (r) => r.b, render: (r) => (isCost(r.metric) ? (r.b === null ? "—" : currency(r.b)) : number(r.b)) },
  delta("delta", "Δ", (r) => r.delta),
  {
    key: "percent",
    label: "Δ %",
    value: (r) => r.deltaPercent,
    render: (r) =>
      r.deltaPercent === null ? (
        "—"
      ) : (
        <span className={"delta " + (r.deltaPercent > 0 ? "up" : r.deltaPercent < 0 ? "down" : "")}>
          {r.deltaPercent > 0 ? "+" : ""}
          {percent(r.deltaPercent)}
        </span>
      ),
  },
];
const languageCols: Col<Comparison["languages"][number]>[] = [
  {
    key: "language",
    label: "Language",
    value: (r) => r.language,
    path: true,
    render: (r) => (
      <span className="agent-name">
        <i style={{ background: langColor(r.language) }} />
        {r.language}
      </span>
    ),
  },
  { key: "category", label: "Category", value: (r) => categoryLabel(r.category) },
  { key: "linesA", label: "Lines A", value: (r) => r.linesA },
  { key: "linesB", label: "Lines B", value: (r) => r.linesB },
  { key: "codeA", label: "Code A", value: (r) => r.codeA },
  { key: "codeB", label: "Code B", value: (r) => r.codeB },
  delta("deltaLines", "Δ lines", (r) => r.deltaLines),
  delta("deltaCode", "Δ code", (r) => r.deltaCode),
];
const effectiveCols: Col<Effective>[] = [
  { key: "name", label: "Project", value: (r) => r.entry.name, path: true },
  { key: "date", label: "Scanned on", value: (r) => r.scannedOn },
  {
    key: "carried",
    label: "Carried forward",
    value: (r) => (r.isCarried ? "Yes" : "No"),
    render: (r) => <span className={"pill " + (r.isCarried ? "pill-warn" : "pill-loaded")}>{r.isCarried ? "Yes" : "No"}</span>,
  },
  { key: "lines", label: "Physical lines", value: (r) => r.entry.physicalLines },
  { key: "tokens", label: "Tokens", value: (r) => r.entry.tokens },
];

export function DailyLog() {
  const { state, draft, busy, exportData } = useWorkspace();
  const [project, setProject] = useState("enabled"),
    [allAgents, setAllAgents] = useState(true),
    [dateA, setDateA] = useState(""),
    [dateB, setDateB] = useState("");
  const projects = draft.projects;
  const ids = useMemo(() => (project === "enabled" ? projects.filter((p) => p.isEnabled).map((p) => p.id) : [project]), [project, projects]);
  const rows = useMemo(() => timeline(state.daily, ids, allAgents), [state.daily, ids, allAgents]),
    newest = useMemo(() => [...rows].reverse(), [rows]),
    dates = useMemo(() => newest.map((r) => r.date), [newest]),
    a = dates.includes(dateA) ? dateA : dates[1] || dates[0] || "",
    b = dates.includes(dateB) ? dateB : dates[0] || "";
  const cmp = useMemo(() => compareDays(state.daily, a, b, ids, allAgents), [state.daily, a, b, ids, allAgents]),
    effective = useMemo(() => effectiveLines(state.daily, b, ids), [state.daily, b, ids]);
  const series = useMemo(
    () => [
      { key: "lines", label: "Physical lines", color: "var(--s-1)", values: rows.map((r) => r.lines?.physicalLines ?? null) },
      { key: "code", label: "Code lines", color: "var(--success)", values: rows.map((r) => r.lines?.codeLines ?? null) },
    ],
    [rows],
  );
  const bars = useMemo(
    () => ({ label: "AI tokens", color: "color-mix(in oklch, var(--accent) 45%, transparent)", values: rows.map((r) => r.ai?.tokens ?? 0) }),
    [rows],
  );
  const arrow = useRef<HTMLSpanElement>(null),
    pair = useRef(a + b);
  useLayoutEffect(() => {
    if (pair.current === a + b) return;
    pair.current = a + b;
    play(arrow.current, [{ transform: "translateX(-6px)", opacity: 0.3 }, { transform: "none", opacity: 1 }], { duration: 280 });
  }, [a, b]);

  return (
    <>
      <div className="toolbar section-toolbar">
        <Field label="Projects">
          <Select
            aria-label="Daily log project"
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              setAllAgents(e.target.value === "enabled");
            }}
          >
            <option value="enabled">All enabled projects</option>
            {projects.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="field">
          <span className="field-label">&nbsp;</span>
          <Check label="AI usage of the whole computer" checked={allAgents} onChange={setAllAgents} />
        </div>
        <span className="spacer" />
        <button
          className="btn"
          type="button"
          disabled={!!busy || !rows.length}
          onClick={() => void exportData("daily", "csv", { projectIds: ids, allAgents })}
        >
          <Icon name="download" />
          Export daily CSV
        </button>
      </div>
      <p className="muted caption">Latest scan per project per day. Earlier project values carry forward and are identified below.</p>
      {!rows.length ? (
        <EmptyState title="Your timeline starts here">
          Every completed scan records today’s project values. AI refreshes add daily usage.
        </EmptyState>
      ) : (
        <>
          <Sheet title="Growth" sub="Physical and code lines across the log, with AI tokens per day behind them">
            <LineChart
              label="Daily growth of physical and code lines"
              keys={rows.map((r) => r.date)}
              height={230}
              series={series}
              bars={bars}
              tipRows={(i) => {
                const r = rows[i];
                const out: [string, string][] = [
                  ["Physical lines", number(r.lines?.physicalLines)],
                  ["Code lines", number(r.lines?.codeLines)],
                  ["Tokens", number(r.lines?.tokens)],
                  ["Δ lines", signed(r.deltaLines)],
                  ["AI tokens", number(r.ai?.tokens)],
                  ["API equivalent", r.ai ? money(r.ai.cost, r.ai.costPartial) : "—"],
                ];
                if (r.notes) out.push(["Notes", r.notes]);
                return out;
              }}
            />
          </Sheet>
          <Sheet title="Daily timeline" sub="Newest first · Δ columns compare with the previous day that has line values">
            <Table label="Daily log timeline" rows={newest} rowKey={(r) => r.date} columns={timelineCols} />
          </Sheet>
          <div className="compare-bar">
            <h2>Compare dates</h2>
            <Select aria-label="Comparison date A" value={a} onChange={(e) => setDateA(e.target.value)}>
              {dates.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <span className="compare-arrow" aria-hidden="true" ref={arrow}>
              <Icon name="arrow" />
            </span>
            <Select aria-label="Comparison date B" value={b} onChange={(e) => setDateB(e.target.value)}>
              {dates.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </div>
          {cmp.warning && <Notice>{cmp.warning}</Notice>}
          <div className="two-col">
            <Sheet title="Overall difference">
              <Table label="Date comparison metrics" rows={cmp.metrics} rowKey={(r) => r.metric} columns={metricCols} />
            </Sheet>
            <Sheet title={"Project values as of " + b}>
              <Table label="Effective project values" rows={effective} rowKey={(r) => r.entry.projectId} columns={effectiveCols} />
            </Sheet>
          </div>
          <Sheet title="Language difference">
            <Table label="Date comparison languages" rows={cmp.languages} rowKey={(r) => r.language + "::" + r.category} columns={languageCols} />
          </Sheet>
        </>
      )}
    </>
  );
}

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Card, Empty, Table, col, type Column } from "../components";
import { categoryLabel, money, percent, signed } from "../format";
import {
  compareDays,
  effectiveLines,
  timeline,
  type Effective,
  type TimelineRow,
} from "../../domain/daily";
import { useWorkspace } from "../workspace";
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
  {
    key: "cost",
    label: "API equivalent",
    value: (r) => r.ai?.cost,
    render: (r) => (r.ai ? money(r.ai.cost, r.ai.costPartial) : "—"),
  },
  {
    key: "notes",
    label: "Notes",
    value: (r) => r.notes,
    render: (r) => <span title={r.notes}>{r.notes}</span>,
  },
];
const metricColumns: Column<Comparison["metrics"][number]>[] = [
  col("metric", "Metric", true),
  col("a", "Day A"),
  col("b", "Day B"),
  delta("delta", "Δ", (r) => r.delta),
  {
    key: "percent",
    label: "Δ %",
    value: (r) => r.deltaPercent,
    render: (r) =>
      r.deltaPercent === null
        ? "—"
        : (r.deltaPercent > 0 ? "+" : "") + percent(r.deltaPercent),
  },
];
const languageColumns: Column<Comparison["languages"][number]>[] = [
  col("language", "Language", true),
  { key: "category", label: "Category", value: (r) => categoryLabel(r.category) },
  col("linesA", "Lines A"),
  col("linesB", "Lines B"),
  col("codeA", "Code A"),
  col("codeB", "Code B"),
  delta("deltaLines", "Δ lines", (r) => r.deltaLines),
  delta("deltaCode", "Δ code", (r) => r.deltaCode),
];
const effectiveColumns: Column<Effective>[] = [
  { key: "name", label: "Project", value: (r) => r.entry.name, path: true },
  { key: "date", label: "Scanned on", value: (r) => r.scannedOn },
  {
    key: "carried",
    label: "Carried forward",
    value: (r) => (r.isCarried ? "Yes" : "No"),
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
  const selectedIds = useMemo(
    () =>
      project === "enabled"
        ? projects.filter((p) => p.isEnabled).map((p) => p.id)
        : [project],
    [project, projects],
  );
  const rows = useMemo(
      () => timeline(state.daily, selectedIds, allAgents),
      [state.daily, selectedIds, allAgents],
    ),
    newestFirst = useMemo(() => [...rows].reverse(), [rows]),
    dates = useMemo(() => newestFirst.map((r) => r.date), [newestFirst]),
    a = dates.includes(dateA) ? dateA : dates[1] || dates[0] || "",
    b = dates.includes(dateB) ? dateB : dates[0] || "";
  const comparison = useMemo(
      () => compareDays(state.daily, a, b, selectedIds, allAgents),
      [state.daily, a, b, selectedIds, allAgents],
    ),
    effective = useMemo(
      () => effectiveLines(state.daily, b, selectedIds),
      [state.daily, b, selectedIds],
    );
  return (
    <>
      <div className="toolbar section-toolbar">
        <label>
          Projects
          <select
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
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={allAgents}
            onChange={(e) => setAllAgents(e.target.checked)}
          />
          AI usage of the whole computer
        </label>
        <div className="spacer" />
        <button
          disabled={!!busy || !rows.length}
          onClick={() =>
            void exportData("daily", "csv", { projectIds: selectedIds, allAgents })
          }
        >
          <Download size={15} />
          Export daily CSV
        </button>
      </div>
      <p className="muted">
        Latest scan per project per day. Earlier project values carry forward
        and are identified below.
      </p>
      {!rows.length ? (
        <Empty title="Your timeline starts here">
          Every completed scan records today’s project values. AI refreshes add
          daily usage.
        </Empty>
      ) : (
        <>
          <Card title="Daily timeline">
            <Table
              label="Daily log timeline"
              rows={newestFirst}
              rowKey={(r) => r.date}
              columns={timelineColumns}
            />
          </Card>
          <div className="toolbar section-toolbar">
            <h2>Compare dates</h2>
            <select
              aria-label="Comparison date A"
              value={a}
              onChange={(e) => setDateA(e.target.value)}
            >
              {dates.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <span aria-hidden="true">→</span>
            <select
              aria-label="Comparison date B"
              value={b}
              onChange={(e) => setDateB(e.target.value)}
            >
              {dates.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          {comparison.warning && <p className="notice">{comparison.warning}</p>}
          <Card title="Overall difference">
            <Table
              label="Date comparison metrics"
              rows={comparison.metrics}
              rowKey={(r) => r.metric}
              columns={metricColumns}
            />
          </Card>
          <Card title="Language difference">
            <Table
              label="Date comparison languages"
              rows={comparison.languages}
              columns={languageColumns}
            />
          </Card>
          <Card title={"Project values as of " + b}>
            <Table
              label="Effective project values"
              rows={effective}
              rowKey={(r) => r.entry.projectId}
              columns={effectiveColumns}
            />
          </Card>
        </>
      )}
    </>
  );
}

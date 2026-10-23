import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { agentLabels } from "../shared/agents";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { AgentStatus, AiResult, Vector } from "../shared/contracts";
import {
  reportModel,
  selectReport,
  calendarDays,
  claudeComparison,
  claudeCostRows,
  type ReportBucket,
} from "../reports/selectors";
import { tokens } from "../ai/model";
import { costText, currency } from "../ai/aggregate";
import { Card, Table, Empty, number, percent, type Column } from "./components";
const palette = [
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
const agentColors: Record<string, string> = Object.fromEntries(
  Object.keys(agentLabels).map((id, i) => [id, palette[i % palette.length]]),
);
const compact = (n: number) =>
  Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
const tokenColors: Record<string, string> = {
  Input: "#6d8bff",
  "Cache write": "#b396f5",
  "Cache read": "#38bca4",
  Output: "#e5aa59",
  Tokens: "#6d8bff",
};
const seriesColor = (key: string) => {
  if (agentColors[key]) return agentColors[key];
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
};
const reportTabs = [
  "Overview",
  "Models",
  "Time",
  "Tables",
  "Projects",
] as const;
interface ReportSelection {
  tab: (typeof reportTabs)[number];
  range: number;
  group: "agent" | "model";
  since: string;
  until: string;
}
const defaultSelection: ReportSelection = {
  tab: "Overview",
  range: 0,
  group: "agent",
  since: "",
  until: "",
};
function tabKeys(event: KeyboardEvent<HTMLElement>) {
  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );
  const index = buttons.indexOf(event.target as HTMLButtonElement);
  if (index < 0) return;
  const next =
    event.key === "ArrowRight"
      ? (index + 1) % buttons.length
      : event.key === "ArrowLeft"
        ? (index + buttons.length - 1) % buttons.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : -1;
  if (next >= 0) {
    event.preventDefault();
    buttons[next].focus();
    buttons[next].click();
  }
}
function Detail({ title, detail }: { title: ReactNode; detail: string }) {
  return (
    <>
      <strong>{title}</strong>
      <dl>
        {detail.split(" · ").map((row, index) => {
          const separator = row.indexOf(": ");
          return (
            <div key={index}>
              <dt>{separator < 0 ? row : row.slice(0, separator)}</dt>
              <dd>{separator < 0 ? "" : row.slice(separator + 2)}</dd>
            </div>
          );
        })}
      </dl>
    </>
  );
}
function UsageHint({
  title,
  detail,
  children,
  className,
  style,
}: {
  title: string;
  detail: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const id = useId();
  const trigger = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    above: boolean;
  } | null>(null);
  const show = useCallback((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
      top: rect.bottom + 8,
      above: rect.bottom > window.innerHeight - 280,
    });
  }, []);
  const visible = position !== null;
  useEffect(() => {
    if (!visible) return;
    const reposition = () => {
      const element = trigger.current;
      if (element && document.activeElement === element) show(element);
      else setPosition(null);
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [visible, show]);
  return (
    <span
      ref={trigger}
      tabIndex={0}
      role="img"
      className={className}
      style={style}
      aria-label={`${title} · ${detail}`}
      aria-describedby={position ? id : undefined}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={(e) => {
        if (document.activeElement !== e.currentTarget) setPosition(null);
      }}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setPosition(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setPosition(null);
      }}
    >
      {children}
      {position &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="report-hint"
            style={{
              left: position.left,
              top: position.above ? undefined : position.top,
              bottom: position.above
                ? Math.max(8, window.innerHeight - position.top + 32)
                : undefined,
            }}
          >
            <Detail title={title} detail={detail} />
          </div>,
          document.body,
        )}
    </span>
  );
}
export function AgentSources({ agents }: { agents: AgentStatus[] }) {
  const failed = agents.filter((a) => a.state === "Failed");
  return (
    <details className="ai-sources">
      <summary>
        Agent sources{" "}
        <span>
          {agents.filter((a) => a.state === "Loaded").length} loaded ·{" "}
          {agents.length} sources
        </span>
        {failed.length > 0 && (
          <b className="source-failed">{failed.length} failed</b>
        )}
      </summary>
      <Table
        label="AI adapter status"
        rows={agents}
        columns={[
          { key: "agent", label: "Agent", value: (a) => a.label },
          {
            key: "state",
            label: "Status",
            value: (a) => a.state,
            render: (a) => (
              <span className={a.state === "Failed" ? "source-failed" : ""}>
                {a.state}
              </span>
            ),
          },
          { key: "records", label: "Records", value: (a) => a.records },
          {
            key: "error",
            label: "Details",
            value: (a) => a.error ?? "",
            render: (a) => (
              <span className={a.state === "Failed" ? "source-failed" : ""}>
                {a.error ?? "—"}
              </span>
            ),
          },
        ]}
      />
    </details>
  );
}
const formatKey = (
  key: string,
  labels: Record<string, string>,
  includeAgent = false,
) =>
  key.includes("::")
    ? (includeAgent
        ? (labels[key.split("::")[0]] ?? key.split("::")[0]) + " · "
        : "") + key.slice(key.indexOf("::") + 2)
    : (labels[key] ?? key);
const vectorDetails = (v: Vector) =>
  `Real tokens: ${number(tokens(v))} · Input: ${number(v[0])} · Cache write: ${number(v[1])} · Cache read: ${number(v[2])} · Output: ${number(v[3])} · Calls: ${number(v[4])} · Reasoning (included in output): ${number(v[5])} · API equivalent: ${costText(v)}`;
function Chart({
  data,
  keys,
  series,
}: {
  data: Record<string, string | number>[];
  keys: string[];
  series?: Record<string, { label: string; color: string }>;
}) {
  return (
    <div className="chart" aria-label="Token usage chart">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            width={65}
            tickFormatter={(v) =>
              Intl.NumberFormat("en", { notation: "compact" }).format(Number(v))
            }
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: 8,
            }}
            formatter={(v) => number(Number(v))}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="chart-tooltip" role="tooltip">
                  <Detail
                    title={label}
                    detail={
                      payload
                        .map(
                          (entry) =>
                            `${entry.name}: ${number(Number(entry.value))}`,
                        )
                        .join(" · ") +
                      (typeof payload[0]?.payload?.detail === "string"
                        ? " · " + payload[0].payload.detail
                        : "")
                    }
                  />
                </div>
              ) : null
            }
          />
          <Legend />
          {keys.map((k) => (
            <Bar
              key={k}
              dataKey={k}
              stackId="usage"
              name={series?.[k]?.label ?? k}
              fill={series?.[k]?.color ?? tokenColors[k] ?? seriesColor(k)}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function Heat({
  cells,
  columns,
  label,
  calendar = false,
}: {
  cells: { key: string; value: number; detail: string }[];
  columns: number;
  label: string;
  calendar?: boolean;
}) {
  const values = cells
    .map((c) => c.value)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const stops = [0.2, 0.4, 0.6, 0.8, 0.95].map(
    (p) =>
      values[Math.min(values.length - 1, Math.floor(p * values.length))] ?? 0,
  );
  const shade = (n: number) => {
    if (!n) return 0;
    const index = stops.findIndex((stop) => n <= stop);
    return index < 0 ? 6 : index + 1;
  };
  const color = (level: number) =>
    level
      ? `color-mix(in srgb, var(--accent) ${15 + 14 * level}%, var(--surface))`
      : "var(--surface-alt)";
  const weeks = Math.ceil(cells.length / 7);
  const monthLabels = calendar
    ? Array.from({ length: weeks }, (_, week) => {
        const first = new Date(cells[week * 7].key + "T12:00:00Z");
        const previous = week
          ? new Date(cells[(week - 1) * 7].key + "T12:00:00Z")
          : null;
        return !previous ||
          first.getUTCMonth() !== previous.getUTCMonth() ||
          first.getUTCFullYear() !== previous.getUTCFullYear()
          ? first.toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
              timeZone: "UTC",
            })
          : "";
      })
    : [];
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <>
      <div
        className="heat-scroll"
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        <div
          className={
            calendar
              ? "report-heat-layout calendar-layout"
              : "report-heat-layout hour-layout"
          }
        >
          <div
            className="heat-axis"
            style={{
              gridTemplateColumns: calendar
                ? `repeat(${weeks},17px)`
                : `repeat(${columns},minmax(17px,1fr))`,
            }}
          >
            {calendar
              ? monthLabels.map((month, week) => (
                  <span key={week}>
                    {month &&
                    !monthLabels.slice(week + 1, week + 3).some(Boolean)
                      ? month
                      : ""}
                  </span>
                ))
              : Array.from({ length: columns }, (_, h) => (
                  <span key={h}>{String(h).padStart(2, "0")}</span>
                ))}
          </div>
          <div className="heat-day-axis">
            {weekdays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div
            className={calendar ? "heat calendar-grid" : "heat"}
            style={{
              gridTemplateColumns: calendar
                ? `repeat(${weeks},17px)`
                : `repeat(${columns},minmax(17px,1fr))`,
            }}
          >
            {cells.map((c) => (
              <UsageHint
                key={c.key}
                className="heat-cell"
                title={
                  calendar
                    ? c.key
                    : `${weekdays[Number(c.key.split(":")[0])]} ${String(c.key.split(":")[1]).padStart(2, "0")}:00`
                }
                detail={c.detail}
                style={{ background: color(shade(c.value)) }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="heat-scale">
        <span>Less</span>
        {Array.from({ length: 7 }, (_, i) => (
          <i key={i} style={{ background: color(i) }} />
        ))}
        <span>More</span>
        <span className="heat-help">
          Hover or focus a cell for exact values
        </span>
      </div>
    </>
  );
}
function vectorColumns<T>(get: (r: T) => Vector): Column<T>[] {
  return [
    { key: "input", label: "Input", value: (r) => get(r)[0] },
    { key: "cw", label: "Cache write", value: (r) => get(r)[1] },
    { key: "cr", label: "Cache read", value: (r) => get(r)[2] },
    { key: "out", label: "Output", value: (r) => get(r)[3] },
    { key: "think", label: "Reasoning¹", value: (r) => get(r)[5] },
    { key: "requests", label: "Calls", value: (r) => get(r)[4] },
    { key: "total", label: "Real tokens", value: (r) => tokens(get(r)) },
    {
      key: "cost",
      label: "API equivalent",
      value: (r) => get(r)[6],
      render: (r) => costText(get(r)),
    },
  ];
}
export function Reports({ result }: { result: AiResult }) {
  const [selectedAgent, setAgent] = useState("all");
  const [selections, setSelections] = useState<Record<string, ReportSelection>>(
    {},
  );
  const agent =
    selectedAgent === "all" || result.combined?.agents[selectedAgent]
      ? selectedAgent
      : "all";
  const selection = selections[agent] ?? defaultSelection;
  const { tab, range, group, since, until } = selection;
  const update = (patch: Partial<ReportSelection>) =>
    setSelections((previous) => ({
      ...previous,
      [agent]: { ...(previous[agent] ?? defaultSelection), ...patch },
    }));
  const invalidDates = Boolean(since && until && since > until);
  const navigationId = useId();
  const allTime = useMemo(() => {
    const totals: Record<string, number> = { all: 0 };
    for (const fact of reportModel(result).facts) {
      const n = tokens(fact.v);
      totals.all += n;
      totals[fact.agent] = (totals[fact.agent] ?? 0) + n;
    }
    if (result.claude && result.combined?.agents.claude)
      totals.claude = reportModel(result, "claude").facts.reduce(
        (n, fact) => n + tokens(fact.v),
        0,
      );
    return totals;
  }, [result]);
  const model = useMemo(() => reportModel(result, agent), [result, agent]),
    view = useMemo(
      () =>
        selectReport(model, {
          range,
          since,
          until,
          group: agent === "all" ? group : "model",
        }),
      [model, range, since, until, group, agent],
    );
  if (!result.combined)
    return (
      <div className="reports">
        <Empty title="No local AI usage found">
          Refresh to read supported agents’ local files. Agent statuses appear
          below.
        </Empty>
        <AgentSources agents={result.agents} />
      </div>
    );
  const accuracyNotes = new Map<string, string[]>();
  for (const [id, source] of Object.entries(result.combined.agents)) {
    if (!source.note || (agent !== "all" && id !== agent)) continue;
    const labels = accuracyNotes.get(source.note) ?? [];
    labels.push(source.label);
    accuracyNotes.set(source.note, labels);
  }
  const total = tokens(view.total),
    active = view.days.filter((d) => tokens(d.v) > 0).length,
    peakDay = view.days.reduce<ReportBucket | undefined>(
      (peak, day) => (!peak || tokens(day.v) > tokens(peak.v) ? day : peak),
      undefined,
    ),
    peakMonth = view.months.reduce<ReportBucket | undefined>(
      (peak, month) =>
        !peak || tokens(month.v) > tokens(peak.v) ? month : peak,
      undefined,
    ),
    peak = view.byHour.reduce(
      (p, v, i) => (tokens(v) > tokens(view.byHour[p]) ? i : p),
      0,
    ),
    label = (k: string) => formatKey(k, model.labels, agent === "all");
  const rows = [
    ...view.groups,
    {
      key: "Total",
      v: view.total,
      cw5: view.cw5,
      cw1: view.cw1,
      sessions: view.sessions.length,
    },
  ];
  const groupCols: Column<ReportBucket>[] = [
    {
      key: "key",
      label: agent === "all" && group === "agent" ? "Agent" : "Model",
      value: (r) => label(r.key),
      path: true,
    },
    ...vectorColumns<ReportBucket>((r) => r.v),
    {
      key: "share",
      label: "Share",
      value: (r) => tokens(r.v) / (total || 1),
      render: (r) => percent(tokens(r.v) / (total || 1)),
    },
  ];
  if (model.claude)
    groupCols.splice(
      2,
      0,
      { key: "cw5", label: "5m write", value: (r) => r.cw5 },
      { key: "cw1", label: "1h write", value: (r) => r.cw1 },
    );
  const dailyData = view.days.map((d) => ({
    name: d.key,
    detail: vectorDetails(d.v),
    Input: d.v[0],
    "Cache write": d.v[1],
    "Cache read": d.v[2],
    Output: d.v[3],
  }));
  const groupKeys = view.groups.map((g) => g.key),
    groupData = view.days.map((d) => {
      const data: Record<string, string | number> = {
        name: d.key,
        detail: vectorDetails(d.v),
      };
      for (const k of groupKeys)
        data[k] = tokens(view.dailyGroups.get(d.key)?.get(k) ?? [0, 0, 0, 0]);
      return data;
    });
  const classes = [
    { key: "Cache read", v: view.total[2] },
    { key: "Cache write", v: view.total[1] },
    { key: "Output", v: view.total[3] },
    { key: "Input", v: view.total[0] },
  ];
  return (
    <div className="reports">
      <div
        className="report-agent-tabs"
        role="tablist"
        aria-label="AI agent reports"
        onKeyDown={tabKeys}
      >
        {[
          { id: "all", label: "All agents" },
          ...Object.entries(result.combined.agents).map(([id, a]) => ({
            id,
            label: a.label,
          })),
        ].map((a) => (
          <button
            role="tab"
            key={a.id}
            id={`${navigationId}-agent-${a.id}`}
            aria-selected={agent === a.id}
            tabIndex={agent === a.id ? 0 : -1}
            aria-controls={`${navigationId}-agent-panel`}
            onClick={() => setAgent(a.id)}
          >
            <i
              style={{
                background:
                  a.id === "all" ? "var(--accent)" : seriesColor(a.id),
              }}
            />
            {a.label}
            <span title={`${number(allTime[a.id] ?? 0)} all-time tokens`}>
              {compact(allTime[a.id] ?? 0)}
            </span>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${navigationId}-agent-panel`}
        aria-labelledby={`${navigationId}-agent-${agent}`}
      >
        <div className="report-heading">
          <div>
            <h2>
              {agent === "all" ? "All agents" : model.labels[agent]}{" "}
              <span>Real token usage</span>
            </h2>
            <p>
              Cache included · Local data · Updated{" "}
              {new Date(result.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="report-controls">
          <div
            className="report-segment report-section-tabs"
            role="tablist"
            aria-label="AI report tabs"
            onKeyDown={tabKeys}
          >
            {reportTabs.map((t) => (
              <button
                role="tab"
                id={`${navigationId}-tab-${t}`}
                aria-selected={t === tab}
                tabIndex={t === tab ? 0 : -1}
                aria-controls={`${navigationId}-report-${t}`}
                key={t}
                onClick={() => update({ tab: t })}
              >
                {t}
              </button>
            ))}
          </div>
          <div
            className="report-segment"
            role="group"
            aria-label="Report range"
          >
            {[0, 90, 30, 7].map((n) => (
              <button
                key={n}
                aria-pressed={!since && !until && range === n}
                onClick={() => update({ range: n, since: "", until: "" })}
              >
                {n ? `${n}d` : "All"}
              </button>
            ))}
          </div>
        </div>
        <div className="report-filters">
          {agent === "all" && (
            <div
              className="report-segment"
              role="group"
              aria-label="Group usage"
            >
              {(["agent", "model"] as const).map((g) => (
                <button
                  key={g}
                  aria-pressed={group === g}
                  onClick={() => update({ group: g })}
                >
                  By {g}
                </button>
              ))}
            </div>
          )}
          <div className="report-date-fields">
            <label>
              From{" "}
              <input
                aria-label="Report start date"
                aria-invalid={invalidDates}
                aria-describedby={
                  invalidDates ? `${navigationId}-date-error` : undefined
                }
                type="date"
                value={since}
                onChange={(e) => update({ since: e.target.value, range: 0 })}
              />
            </label>
            <label>
              To{" "}
              <input
                aria-label="Report end date"
                aria-invalid={invalidDates}
                aria-describedby={
                  invalidDates ? `${navigationId}-date-error` : undefined
                }
                type="date"
                value={until}
                onChange={(e) => update({ until: e.target.value, range: 0 })}
              />
            </label>
            {(since || until) && (
              <button
                onClick={() => update({ since: "", until: "", range: 0 })}
              >
                Clear dates
              </button>
            )}
          </div>
        </div>
        {invalidDates && (
          <p
            className="report-date-error"
            id={`${navigationId}-date-error`}
            role="alert"
          >
            Start date must be on or before end date.
          </p>
        )}
        <p className="muted">
          {result.combined.meta.tzLabel} · {model.facts.length.toLocaleString()}{" "}
          hourly facts · Equivalent API costs · * partial cost · ¹ Reasoning is
          included in output.
        </p>
        {accuracyNotes.size > 0 && (
          <details className="report-accuracy-notes" key={agent}>
            <summary>Data accuracy notes ({accuracyNotes.size})</summary>
            <ul>
              {Array.from(accuracyNotes, ([note, labels]) => (
                <li key={note}>
                  <strong>{labels.join(", ")}</strong>: {note}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div
          role="tabpanel"
          id={`${navigationId}-report-${tab}`}
          aria-labelledby={`${navigationId}-tab-${tab}`}
        >
          {invalidDates ? null : !view.days.length ? (
            <Empty title="No usage in this range">
              Choose another period or clear the dates to see usage.
            </Empty>
          ) : (
            <>
              {tab === "Overview" && (
                <>
                  <div className="report-metrics">
                    <div className="tile report-hero">
                      <span>Real tokens</span>
                      <strong>{compact(total)}</strong>
                      <small>
                        {number(total)} tokens · Input + cache + output
                      </small>
                      <div className="hero-foot">
                        {compact(view.total[4] ? total / view.total[4] : 0)}{" "}
                        tokens / call{" "}
                        <span>
                          {compact(active ? total / active : 0)} / active day
                        </span>
                      </div>
                    </div>
                    {[
                      {
                        label: "API equivalent",
                        value: costText(view.total),
                        detail: `Covers ${percent(total ? view.total[7] / total : 0)} of tokens`,
                      },
                      {
                        label: "Model calls",
                        value: compact(view.total[4]),
                        detail: `${number(view.total[4])} API requests`,
                      },
                      {
                        label: "Sessions",
                        value: number(view.sessions.length),
                        detail: "Conversations in this range",
                      },
                      {
                        label: "Active days",
                        value: number(active),
                        detail: `${active} of ${view.selectedDays.length} recorded days`,
                      },
                      {
                        label: "Peak hour",
                        value: total
                          ? `${String(peak).padStart(2, "0")}:00`
                          : "—",
                        detail: `${compact(tokens(view.byHour[peak]))} tokens`,
                      },
                      {
                        label: "Peak day",
                        value: total && peakDay ? peakDay.key : "—",
                        detail: `${compact(peakDay ? tokens(peakDay.v) : 0)} tokens`,
                      },
                      {
                        label: "Peak month",
                        value: total && peakMonth ? peakMonth.key : "—",
                        detail: `${compact(peakMonth ? tokens(peakMonth.v) : 0)} tokens`,
                      },
                      {
                        label:
                          agent === "all" && group === "agent"
                            ? "Top agent"
                            : "Top model",
                        value:
                          total && view.groups[0]
                            ? label(view.groups[0].key)
                            : "—",
                        detail: `${percent(total && view.groups[0] ? tokens(view.groups[0].v) / total : 0)} of real tokens`,
                      },
                    ].map((metric) => (
                      <div className="tile" key={metric.label}>
                        <span>{metric.label}</span>
                        {metric.label.startsWith("Top ") ? (
                          <UsageHint
                            className="metric-name"
                            title={String(metric.value)}
                            detail={metric.detail}
                          >
                            <strong>{metric.value}</strong>
                          </UsageHint>
                        ) : (
                          <strong title={String(metric.value)}>
                            {metric.value}
                          </strong>
                        )}
                        <small>{metric.detail}</small>
                      </div>
                    ))}
                  </div>
                  {agent === "all" && (
                    <Card title="By agent">
                      <div
                        className="token-mix agent-share"
                        aria-label="Agent token shares"
                      >
                        {view.agents
                          .filter((a) => tokens(a.v) > 0)
                          .map((a) => (
                            <UsageHint
                              key={a.key}
                              className="share-segment"
                              title={model.labels[a.key] ?? a.key}
                              detail={vectorDetails(a.v)}
                              style={{
                                flex: tokens(a.v),
                                background: seriesColor(a.key),
                              }}
                            />
                          ))}
                      </div>
                      <div className="legend">
                        {view.agents.map((a) => (
                          <span key={a.key}>
                            <i style={{ background: seriesColor(a.key) }} />
                            {model.labels[a.key] ?? a.key} ·{" "}
                            {percent(tokens(a.v) / (total || 1))}
                          </span>
                        ))}
                      </div>
                      <Table
                        label="Agent comparison"
                        rows={[
                          ...view.agents,
                          {
                            key: "Total",
                            v: view.total,
                            cw5: 0,
                            cw1: 0,
                            sessions: view.sessions.length,
                          },
                        ]}
                        columns={[
                          {
                            key: "agent",
                            label: "Agent",
                            value: (r) => model.labels[r.key] ?? r.key,
                          },
                          {
                            key: "sessions",
                            label: "Sessions",
                            value: (r) => r.sessions,
                          },
                          ...vectorColumns<ReportBucket>((r) => r.v),
                          {
                            key: "share",
                            label: "Share",
                            value: (r) => tokens(r.v) / (total || 1),
                            render: (r) => percent(tokens(r.v) / (total || 1)),
                          },
                        ]}
                      />
                    </Card>
                  )}
                  <Card
                    title="Activity"
                    subtitle="One cell per calendar day, including cache consumption. Rows run Sunday–Saturday; columns are weeks."
                  >
                    <Heat
                      columns={53}
                      calendar
                      label="Daily activity"
                      cells={calendarDays(view.days).map((d) => ({
                        key: d.day,
                        value: tokens(d.v),
                        detail: vectorDetails(d.v),
                      }))}
                    />
                  </Card>
                  <Card title="Where the tokens actually go">
                    <div className="token-mix">
                      {classes
                        .filter((c) => c.v > 0)
                        .map((c) => (
                          <UsageHint
                            key={c.key}
                            className="share-segment"
                            title={c.key}
                            detail={`Tokens: ${number(c.v)} · Share: ${percent(c.v / (total || 1))}`}
                            style={{
                              flex: c.v,
                              background: tokenColors[c.key],
                            }}
                          />
                        ))}
                    </div>
                    <div className="legend">
                      {classes.map((c) => (
                        <span key={c.key}>
                          <i style={{ background: tokenColors[c.key] }} />
                          {c.key} · {percent(c.v / (total || 1))} ·{" "}
                          {number(c.v)}
                        </span>
                      ))}
                    </div>
                  </Card>
                </>
              )}
              {tab === "Models" && (
                <>
                  <Card
                    title={`Real tokens per day by ${agent === "all" ? group : "model"}`}
                  >
                    <Chart
                      data={groupData}
                      keys={groupKeys}
                      series={Object.fromEntries(
                        groupKeys.map((k) => [
                          k,
                          { label: label(k), color: seriesColor(k) },
                        ]),
                      )}
                    />
                  </Card>
                  <Card title="Per model / agent">
                    <Table
                      label="Model breakdown"
                      rows={rows}
                      columns={groupCols}
                    />
                  </Card>
                </>
              )}
              {tab === "Time" && (
                <>
                  <Card
                    title="Hour of day"
                    subtitle={result.combined.meta.tzLabel}
                  >
                    <Chart
                      data={view.byHour.map((v, i) => ({
                        name: String(i).padStart(2, "0") + ":00",
                        Tokens: tokens(v),
                        detail: vectorDetails(v),
                      }))}
                      keys={["Tokens"]}
                    />
                  </Card>
                  <Card title="Weekday × hour">
                    <Heat
                      columns={24}
                      label="Weekday and hour usage"
                      cells={view.weekday.flatMap((hours, d) =>
                        hours.map((v, h) => ({
                          key: `${d}:${h}`,
                          value: tokens(v),
                          detail: vectorDetails(v),
                        })),
                      )}
                    />
                  </Card>
                  <Card title="Daily consumption">
                    <Chart
                      data={dailyData}
                      keys={["Input", "Cache write", "Cache read", "Output"]}
                    />
                  </Card>
                  <Card title="By month">
                    <Table
                      label="Monthly totals"
                      rows={view.months}
                      columns={[
                        { key: "month", label: "Month", value: (r) => r.key },
                        {
                          key: "activeDays",
                          label: "Active days",
                          value: (r) =>
                            view.days.filter(
                              (d) => d.key.startsWith(r.key) && tokens(d.v) > 0,
                            ).length,
                        },
                        ...vectorColumns<ReportBucket>((r) => r.v),
                      ]}
                    />
                  </Card>
                </>
              )}
              {tab === "Tables" && (
                <>
                  <Card title="Full breakdown">
                    <Table
                      label="Full token breakdown"
                      rows={rows}
                      columns={groupCols}
                    />
                  </Card>
                  <Card title="Consumption distribution">
                    <Table
                      label="Token class distribution"
                      rows={[...classes, { key: "Total", v: total }]}
                      columns={[
                        { key: "key", label: "Class", value: (r) => r.key },
                        { key: "tokens", label: "Tokens", value: (r) => r.v },
                        {
                          key: "share",
                          label: "Share",
                          value: (r) => r.v / (total || 1),
                          render: (r) => percent(r.v / (total || 1)),
                        },
                      ]}
                    />
                  </Card>
                  <Card
                    title="Equivalent API cost"
                    subtitle="Unknown costs show —. A star marks costs covering only some tokens."
                  >
                    {model.claude ? (
                      <Table
                        label="Claude cost components"
                        rows={claudeCostRows(model.claude, view.groups, true)}
                        columns={[
                          {
                            key: "model",
                            label: "Model",
                            value: (r) => r.model + (r.known ? "" : " *"),
                            path: true,
                          },
                          {
                            key: "rate",
                            label: "Rate in / out (per million)",
                            value: (r) => r.rate,
                          },
                          ...(
                            [
                              "input",
                              "cacheWrite",
                              "cacheRead",
                              "output",
                              "total",
                            ] as const
                          ).map((key) => ({
                            key,
                            label: key,
                            value: (
                              r: ReturnType<typeof claudeCostRows>[number],
                            ) => r[key],
                            render: (
                              r: ReturnType<typeof claudeCostRows>[number],
                            ) => currency(r[key]),
                          })),
                        ]}
                      />
                    ) : (
                      <Table
                        label="Cost breakdown"
                        rows={[...rows].sort((a, b) => b.v[6] - a.v[6])}
                        columns={[
                          {
                            key: "group",
                            label: "Agent / model",
                            value: (r) => label(r.key),
                            path: true,
                          },
                          {
                            key: "tokens",
                            label: "Real tokens",
                            value: (r) => tokens(r.v),
                          },
                          {
                            key: "priced",
                            label: "Priced tokens",
                            value: (r) => r.v[7],
                          },
                          {
                            key: "coverage",
                            label: "Coverage",
                            value: (r) =>
                              tokens(r.v) ? r.v[7] / tokens(r.v) : 0,
                            render: (r) =>
                              tokens(r.v) ? percent(r.v[7] / tokens(r.v)) : "—",
                          },
                          {
                            key: "cost",
                            label: "API equivalent",
                            value: (r) => r.v[6],
                            render: (r) => costText(r.v),
                          },
                        ]}
                      />
                    )}
                  </Card>
                  {model.claude && (
                    <Card
                      title="App card vs reality"
                      subtitle="All time; independent of the range filter"
                    >
                      <Table
                        label="Claude app card comparison"
                        rows={claudeComparison(model.claude)}
                        columns={[
                          {
                            key: "model",
                            label: "Model",
                            value: (r) => r.model,
                          },
                          {
                            key: "input",
                            label: "Card “in”",
                            value: (r) => r.input,
                          },
                          {
                            key: "output",
                            label: "Card “out”",
                            value: (r) => r.output,
                          },
                          {
                            key: "real",
                            label: "Real tokens",
                            value: (r) => r.actual,
                          },
                          {
                            key: "cardShare",
                            label: "Card share",
                            value: (r) => r.cardShare,
                            render: (r) => percent(r.cardShare),
                          },
                          {
                            key: "realShare",
                            label: "Real share",
                            value: (r) => r.realShare,
                            render: (r) => percent(r.realShare),
                          },
                          {
                            key: "hidden",
                            label: "Hidden by card",
                            value: (r) => r.hidden,
                            render: (r) =>
                              r.hidden === null
                                ? "—"
                                : r.hidden.toFixed(0) + "×",
                          },
                        ]}
                      />
                      <p className="notice">
                        {number(model.claude.meta.rawRecords)} raw records ·{" "}
                        {number(model.claude.meta.countedRecords)} counted ·{" "}
                        {number(model.claude.meta.duplicateRecords)} duplicates
                        · {number(model.claude.meta.partialRecords)} streaming
                        snapshots · {model.claude.meta.inflation.toFixed(2)}×
                        inflation. The card excludes cache tokens and uses raw
                        output for its headline total.{" "}
                        {model.claude.meta.dedupe
                          ? "Each request keeps the record with the greatest output."
                          : "Raw mode counts every transcript record."}
                      </p>
                      {model.claude.meta.unknownModels.length > 0 && (
                        <p className="notice">
                          Unknown Claude models use the legacy fallback rate:{" "}
                          {model.claude.meta.unknownModels.join(", ")}
                        </p>
                      )}
                    </Card>
                  )}
                </>
              )}
              {tab === "Projects" && (
                <>
                  <Card
                    title="By project"
                    subtitle="Attributed by the working directory of each session"
                  >
                    <Table
                      label="By project table"
                      rows={view.projects}
                      columns={[
                        {
                          key: "path",
                          label: "Project",
                          value: (r) => r.key,
                          path: true,
                        },
                        {
                          key: "sessions",
                          label: "Sessions",
                          value: (r) => r.sessions,
                        },
                        {
                          key: "agents",
                          label: "Agents",
                          value: (r) => r.agents.size,
                        },
                        {
                          key: "branches",
                          label: "Branches",
                          value: (r) => r.branches.size,
                        },
                        ...vectorColumns<(typeof view.projects)[number]>(
                          (r) => r.v,
                        ),
                        {
                          key: "share",
                          label: "Share",
                          value: (r) =>
                            tokens(r.v) /
                            (view.projects.reduce(
                              (n, p) => n + tokens(p.v),
                              0,
                            ) || 1),
                          render: (r) =>
                            percent(
                              tokens(r.v) /
                                (view.projects.reduce(
                                  (n, p) => n + tokens(p.v),
                                  0,
                                ) || 1),
                            ),
                        },
                      ]}
                    />
                  </Card>
                  <Card
                    title="Heaviest sessions"
                    subtitle="The 40 largest sessions in this range"
                  >
                    <Table
                      label="Heaviest sessions table"
                      rows={view.heaviest}
                      columns={[
                        {
                          key: "path",
                          label: "Project",
                          value: (r) => r.cwd || "(unknown)",
                          path: true,
                        },
                        {
                          key: "start",
                          label: "Started",
                          value: (r) => r.start,
                          render: (r) =>
                            new Date(r.start).toLocaleString(
                              "en-US",
                              model.utc ? { timeZone: "UTC" } : undefined,
                            ),
                        },
                        {
                          key: "agent",
                          label: "Agent",
                          value: (r) => model.labels[r.agent] ?? r.agent,
                        },
                        { key: "model", label: "Model", value: (r) => r.model },
                        {
                          key: "branch",
                          label: "Branch",
                          value: (r) => r.branch,
                        },
                        {
                          key: "duration",
                          label: "Minutes",
                          value: (r) =>
                            Math.max(1, Math.round((r.end - r.start) / 60000)),
                        },
                        ...vectorColumns<(typeof view.heaviest)[number]>(
                          (r) => r.v,
                        ),
                      ]}
                    />
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <AgentSources agents={result.agents} />
    </div>
  );
}

import { useMemo, useState } from "react";
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
import type { AiResult, Vector } from "../shared/contracts";
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
import {
  Card,
  Tiles,
  Table,
  Empty,
  number,
  percent,
  type Column,
} from "./components";
const palette = [
  "#6d8bff",
  "#38bca4",
  "#b396f5",
  "#e5aa59",
  "#61bce6",
  "#e38097",
  "#a4bc6b",
  "#bc9b80",
];
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
}: {
  data: Record<string, string | number>[];
  keys: string[];
}) {
  return (
    <div className="chart" role="img" aria-label="Token usage chart">
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
                <div className="chart-tooltip">
                  <strong>{label}</strong>
                  {payload.map((entry, i) => (
                    <div key={i}>
                      {entry.name}: {number(Number(entry.value))}
                    </div>
                  ))}
                  {typeof payload[0]?.payload?.detail === "string" && (
                    <p>{payload[0].payload.detail}</p>
                  )}
                </div>
              ) : null
            }
          />
          <Legend />
          {keys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              stackId="usage"
              fill={palette[i % palette.length]}
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
      .sort((a, b) => a - b),
    stops = [0.2, 0.4, 0.6, 0.8, 0.95].map(
      (p) =>
        values[Math.min(values.length - 1, Math.floor(p * values.length))] ?? 0,
    );
  const shade = (n: number) => {
    if (!n) return 0;
    const index = stops.findIndex((stop) => n <= stop);
    return index < 0 ? 6 : index + 1;
  };
  return (
    <div className="heat-scroll" tabIndex={0} role="region" aria-label={label}>
      <div
        className={calendar ? "heat calendar-grid" : "heat"}
        style={
          calendar
            ? {
                gridTemplateColumns: `repeat(${Math.ceil(cells.length / 7)},17px)`,
              }
            : { gridTemplateColumns: `repeat(${columns},minmax(12px,1fr))` }
        }
      >
        {cells.map((c) => (
          <span
            tabIndex={0}
            aria-label={c.detail}
            title={c.detail}
            key={c.key}
            style={{
              background: c.value
                ? `color-mix(in srgb, var(--accent) ${15 + 14 * shade(c.value)}%, var(--surface))`
                : "var(--surface-alt)",
            }}
          />
        ))}
      </div>
      <small>Less ░ ▒ ▓ █ More · Tab through cells for exact values</small>
    </div>
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
  const [agent, setAgent] = useState("all"),
    [tab, setTab] = useState("Overview"),
    [range, setRange] = useState(0),
    [group, setGroup] = useState<"agent" | "model">("agent"),
    [since, setSince] = useState(""),
    [until, setUntil] = useState("");
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
      <Empty title="No local AI usage found">
        Refresh to read supported agents’ local files. Agent statuses appear
        below.
      </Empty>
    );
  const total = tokens(view.total),
    active = view.days.filter((d) => tokens(d.v) > 0).length,
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
        data[label(k)] = tokens(
          view.dailyGroups.get(d.key)?.get(k) ?? [0, 0, 0, 0],
        );
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
      <div className="toolbar wrap">
        <label>
          Report{" "}
          <select
            aria-label="AI agent report"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
          >
            <option value="all">All agents</option>
            {Object.entries(result.combined.agents).map(([id, a]) => (
              <option key={id} value={id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <div className="spacer" />
        <label>
          Range{" "}
          <select
            aria-label="Report range"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            <option value={0}>All time</option>
            {[90, 30, 7].map((n) => (
              <option key={n} value={n}>
                {n} days
              </option>
            ))}
          </select>
        </label>
        <label>
          From{" "}
          <input
            aria-label="Report start date"
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </label>
        <label>
          To{" "}
          <input
            aria-label="Report end date"
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        {agent === "all" && (
          <select
            aria-label="Group usage"
            value={group}
            onChange={(e) => setGroup(e.target.value as "agent" | "model")}
          >
            <option value="agent">By agent</option>
            <option value="model">By model</option>
          </select>
        )}
      </div>
      <div className="tabs" role="tablist" aria-label="AI report tabs">
        {["Overview", "Models", "Time", "Tables", "Projects"].map((t) => (
          <button
            role="tab"
            aria-selected={t === tab}
            aria-controls={"report-" + t}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="muted">
        {result.combined.meta.tzLabel} · {model.facts.length.toLocaleString()}{" "}
        hourly facts · Equivalent API costs · * partial cost · ¹ Reasoning is
        included in output.
      </p>
      {Object.entries(result.combined.agents)
        .filter(([id, a]) => a.note && (agent === "all" || id === agent))
        .map(([id, a]) => (
          <p className="notice" key={id}>
            {a.label}: {a.note}
          </p>
        ))}
      <div role="tabpanel" id={"report-" + tab} aria-label={tab}>
        {tab === "Overview" && (
          <>
            <Tiles
              items={[
                {
                  label: "Real tokens",
                  value: number(total),
                  detail: "Input + cache + output",
                },
                {
                  label: "API equivalent",
                  value: costText(view.total),
                  detail: `Covers ${percent(total ? view.total[7] / total : 0)} of tokens`,
                },
                {
                  label: "Model calls",
                  value: number(view.total[4]),
                  detail: `${number(view.sessions.length)} sessions`,
                },
                {
                  label: "Active days",
                  value: number(active),
                  detail: `${active} of ${view.selectedDays.length} days · ${number(active ? total / active : 0)} tokens / active day`,
                },
                {
                  label: "Peak hour",
                  value: `${String(peak).padStart(2, "0")}:00`,
                  detail: number(tokens(view.byHour[peak])) + " tokens",
                },
                {
                  label: "Tokens / call",
                  value: number(view.total[4] ? total / view.total[4] : 0),
                },
                { label: "Sessions", value: number(view.sessions.length) },
                {
                  label:
                    agent === "all" && group === "agent"
                      ? "Top agent"
                      : "Top model",
                  value: view.groups[0] ? label(view.groups[0].key) : "—",
                  detail:
                    percent(
                      total && view.groups[0]
                        ? tokens(view.groups[0].v) / total
                        : 0,
                    ) + " of real tokens",
                },
              ]}
            />
            {agent === "all" && (
              <Card title="By agent">
                <Chart
                  data={view.agents.map((a) => ({
                    name: model.labels[a.key] ?? a.key,
                    Tokens: tokens(a.v),
                    detail: vectorDetails(a.v),
                  }))}
                  keys={["Tokens"]}
                />
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
                  detail: `${d.day}: ${vectorDetails(d.v)}`,
                }))}
              />
            </Card>
            <Card title="Where the tokens actually go">
              <div className="token-mix">
                {classes
                  .filter((c) => c.v > 0)
                  .map((c, i) => (
                    <div
                      key={c.key}
                      style={{ flex: c.v, background: palette[i] }}
                      title={`${c.key}: ${number(c.v)} (${percent(c.v / (total || 1))})`}
                    />
                  ))}
              </div>
              <div className="legend">
                {classes.map((c, i) => (
                  <span key={c.key}>
                    <i style={{ background: palette[i] }} />
                    {c.key} · {percent(c.v / (total || 1))} · {number(c.v)}
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
              <Chart data={groupData} keys={groupKeys.map(label)} />
            </Card>
            <Card title="Per model / agent">
              <Table label="Model breakdown" rows={rows} columns={groupCols} />
            </Card>
          </>
        )}
        {tab === "Time" && (
          <>
            <Card title="Hour of day" subtitle={result.combined.meta.tzLabel}>
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
              <div className="weekday-labels">
                Sun · Mon · Tue · Wed · Thu · Fri · Sat (rows), 00:00–23:00
                (columns)
              </div>
              <Heat
                columns={24}
                label="Weekday and hour usage"
                cells={view.weekday.flatMap((hours, d) =>
                  hours.map((v, h) => ({
                    key: `${d}:${h}`,
                    value: tokens(v),
                    detail: `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]} ${h}:00: ${vectorDetails(v)}`,
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
                      value: (r: ReturnType<typeof claudeCostRows>[number]) =>
                        r[key],
                      render: (r: ReturnType<typeof claudeCostRows>[number]) =>
                        currency(r[key]),
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
                      value: (r) => (tokens(r.v) ? r.v[7] / tokens(r.v) : 0),
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
                    { key: "model", label: "Model", value: (r) => r.model },
                    { key: "input", label: "Card “in”", value: (r) => r.input },
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
                        r.hidden === null ? "—" : r.hidden.toFixed(0) + "×",
                    },
                  ]}
                />
                <p className="notice">
                  {number(model.claude.meta.rawRecords)} raw records ·{" "}
                  {number(model.claude.meta.countedRecords)} counted ·{" "}
                  {number(model.claude.meta.duplicateRecords)} duplicates ·{" "}
                  {number(model.claude.meta.partialRecords)} streaming snapshots
                  · {model.claude.meta.inflation.toFixed(2)}× inflation. The
                  card excludes cache tokens and uses raw output for its
                  headline total.{" "}
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
                  ...vectorColumns<(typeof view.projects)[number]>((r) => r.v),
                  {
                    key: "share",
                    label: "Share",
                    value: (r) =>
                      tokens(r.v) /
                      (view.projects.reduce((n, p) => n + tokens(p.v), 0) || 1),
                    render: (r) =>
                      percent(
                        tokens(r.v) /
                          (view.projects.reduce((n, p) => n + tokens(p.v), 0) ||
                            1),
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
                  { key: "branch", label: "Branch", value: (r) => r.branch },
                  {
                    key: "duration",
                    label: "Minutes",
                    value: (r) =>
                      Math.max(1, Math.round((r.end - r.start) / 60000)),
                  },
                  ...vectorColumns<(typeof view.heaviest)[number]>((r) => r.v),
                ]}
              />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

/** The five AI report tabs. Each keeps its charts mounted while the range or grouping changes, so marks morph. */
import { useMemo, type CSSProperties } from "react";
import type { Vector } from "../../../../../shared/contracts";
import { tokens, partialCost } from "../../../../../ai/model";
import { currency, costText } from "../../../../../ai/aggregate";
import { calendarDays, claudeComparison, claudeCostRows } from "../../../../../reports/selectors";
import { compact, number, percent } from "../../../../format";
import { useCount } from "../../../../motion/core";
import { agentColor, dateTime, dayNum, longDate, pad2, shortDate, vectorRows } from "../../format";
import { Heatmap, ShareBar, StackChart, type SeriesKey, type StackDatum } from "../../charts";
import { Spark } from "../../charts/Spark";
import { Notice, Panel, Tiles, type TileItem } from "../../ui/layout";
import { DataTable } from "../../ui/Table";
import { CLASSES, ChartPanel, DotName, groupCols, totalRow, vectorCols, type ReportCtx } from "./common";
const ZERO: Vector = [0, 0, 0, 0, 0, 0, 0, 0];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/* ---------- Overview ---------- */
function Hero({ c }: { c: ReportCtx }) {
  const v = c.view,
    total = c.total,
    calls = v.total[4],
    active = v.days.filter((x) => tokens(x.v) > 0).length;
  const value = useCount<HTMLElement>(total, compact, { key: "ai-hero", firstDur: 900, dur: 560, delay: 80 });
  const trace = v.days.map((x) => tokens(x.v));
  return (
    <div className="tile tile-hero tone-accent">
      <span className="tile-label">
        <i className="lamp" aria-hidden="true" />
        <span className="tile-label-text">Real tokens</span>
      </span>
      <strong className="tile-value" ref={value} title={number(total) + " tokens"} />
      <small className="tile-detail">{`${number(total)} tokens · Input + cache + output`}</small>
      <div className="hero-trace" aria-hidden="true">
        <Spark key={trace.length + ":" + total} values={trace} w={480} h={70} stretch />
      </div>
      <div className="hero-foot">
        <span>{`${compact(calls ? total / calls : 0)} tokens / call`}</span>
        <span>{`${compact(active ? total / active : 0)} / active day`}</span>
      </div>
    </div>
  );
}
function ClassStat({ name, color, value, total }: { name: string; color: string; value: number; total: number }) {
  const num = useCount<HTMLSpanElement>(value, number, { key: "ai-class:" + name, firstDur: 800, dur: 500 });
  return (
    <div className="class-stat" style={{ "--c": color } as CSSProperties}>
      <span className="class-name">
        <i className="dot" style={{ background: color }} />
        {name}
      </span>
      <b>{percent(value / (total || 1))}</b>
      <span className="class-num" ref={num} />
    </div>
  );
}
export function Overview({ c }: { c: ReportCtx }) {
  const v = c.view,
    total = c.total;
  const active = v.days.filter((x) => tokens(x.v) > 0).length;
  const best = <T extends { v: number[] }>(list: T[]) => list.reduce<T | null>((p, x) => (!p || tokens(x.v) > tokens(p.v) ? x : p), null);
  const peakDay = best(v.days),
    peakMonth = best(v.months),
    peak = v.byHour.reduce((p, x, i) => (tokens(x) > tokens(v.byHour[p]) ? i : p), 0);
  const unknown = !v.total[7] && v.total[6] === 0,
    star = partialCost(v.total) ? "*" : "",
    top = v.groups[0],
    topLabel = total && top ? c.label(top.key) : "—";
  const cover = `Covers ${percent(total ? v.total[7] / total : 0)} of tokens`;
  const tiles: TileItem[] = [
    unknown
      ? { label: "API equivalent", text: "—", detail: cover, icon: "token" }
      : { label: "API equivalent", value: v.total[6], fmt: (x) => currency(x) + star, detail: cover, icon: "token", tip: star ? "* this cost covers only some of the tokens" : null },
    { label: "Model calls", value: v.total[4], fmt: compact, detail: `${number(v.total[4])} API requests`, icon: "bolt" },
    { label: "Sessions", value: v.sessions.length, detail: "Conversations in this range", icon: "notes" },
    { label: "Active days", value: active, detail: `${active} of ${v.selectedDays.length} recorded days`, icon: "calendar" },
    { label: "Peak hour", text: total ? pad2(peak) + ":00" : "—", detail: `${compact(tokens(v.byHour[peak]))} tokens`, icon: "clock" },
    { label: "Peak day", text: total && peakDay ? peakDay.key : "—", detail: `${compact(peakDay ? tokens(peakDay.v) : 0)} tokens`, icon: "flame" },
    { label: "Peak month", text: total && peakMonth ? peakMonth.key : "—", detail: `${compact(peakMonth ? tokens(peakMonth.v) : 0)} tokens`, icon: "chart" },
    {
      label: c.agent === "all" && c.group === "agent" ? "Top agent" : "Top model",
      text: topLabel,
      detail: `${percent(total && top ? tokens(top.v) / total : 0)} of real tokens`,
      tip: topLabel,
      icon: "target",
    },
  ];
  const agentItems = useMemo(
    () => v.agents.map((a) => ({ key: a.key, label: c.model.labels[a.key] ?? a.key, value: tokens(a.v), color: agentColor(a.key), rows: vectorRows(a.v) })),
    [v.agents, c.model.labels],
  );
  const first = v.selectedDays[0] ?? "",
    last = v.selectedDays.at(-1) ?? "";
  const cells = useMemo(
    () =>
      calendarDays(v.days).map((x) => ({
        key: x.day,
        value: tokens(x.v),
        title: longDate(x.day),
        rows: tokens(x.v) || x.v[4] ? vectorRows(x.v) : ([["No recorded usage", "—"]] as [string, string][]),
        dim: x.day < first || x.day > last,
      })),
    [v.days, first, last],
  );
  const classItems = useMemo(
    () =>
      CLASSES.map(([name, i, color]) => ({
        key: name,
        label: name,
        value: v.total[i],
        color,
        rows: [
          ["Tokens", number(v.total[i])],
          ["Share", percent(v.total[i] / (total || 1))],
        ] as [string, string][],
      })),
    [v.total, total],
  );
  return (
    <div className="stack">
      <div className="ai-metrics">
        <Hero c={c} />
        <Tiles items={tiles} id="ai-ov" className="ai-tiles" />
      </div>
      {c.agent === "all" && (
        <Panel title="By agent" subtitle="Share of real tokens · click an agent to open its report">
          <ShareBar label="Agent token shares" items={agentItems} />
          <div className="legend">
            {v.agents.map((a) => (
              <button
                key={a.key}
                type="button"
                className="legend-item is-link"
                data-tip={"Open the " + (c.model.labels[a.key] ?? a.key) + " report"}
                onClick={() => c.setAgent(a.key)}
              >
                <i className="dot" style={{ background: agentColor(a.key) }} />
                <span>{c.model.labels[a.key] ?? a.key}</span>
                <b>{percent(tokens(a.v) / (total || 1))}</b>
              </button>
            ))}
          </div>
          <DataTable
            label="Agent comparison"
            rows={v.agents}
            rowKey={(r) => r.key}
            searchMin={99}
            total={{ key: "Total", v: v.total, cw5: 0, cw1: 0, sessions: v.sessions.length }}
            columns={[
              {
                key: "agent",
                label: "Agent",
                value: (r) => c.model.labels[r.key] ?? r.key,
                render: (r, foot) => (foot ? <strong>Total</strong> : <DotName color={agentColor(r.key)} text={c.model.labels[r.key] ?? r.key} />),
              },
              { key: "sessions", label: "Sessions", value: (r) => r.sessions },
              ...vectorCols<(typeof v.agents)[number]>((r) => r.v),
              { key: "share", label: "Share", value: (r) => tokens(r.v) / (total || 1), render: (r) => percent(tokens(r.v) / (total || 1)) },
            ]}
          />
        </Panel>
      )}
      <div className="grid-2">
        <Panel title="Activity" subtitle="One cell per calendar day, including cache consumption. Rows run Sunday–Saturday; columns are weeks.">
          <Heatmap label="Daily activity" calendar cells={cells} onPick={(day) => c.zoom(day, day)} />
        </Panel>
        <Panel title="Where the tokens actually go" subtitle="Real consumption by token class">
          <ShareBar label="Token classes" className="is-tall" items={classItems} />
          <div className="class-stats">
            {CLASSES.map(([name, i, color]) => (
              <ClassStat key={name} name={name} color={color} value={v.total[i]} total={total} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
/* ---------- Models ---------- */
export function Models({ c }: { c: ReportCtx }) {
  const v = c.view;
  const { keys, data } = useMemo(() => {
    const keys: SeriesKey[] = v.groups.map((g) => ({ key: g.key, label: c.label(g.key), color: c.colorOf(g.key) }));
    const data: StackDatum[] = v.days.map((x) => {
      const g = v.dailyGroups.get(x.key),
        values: Record<string, number> = {};
      for (const k of keys) {
        const gv = g?.get(k.key);
        values[k.key] = gv ? tokens(gv) : 0;
      }
      return { name: x.key, values, vector: x.v };
    });
    return { keys, data };
    // label / colorOf follow the agent and grouping, which also change the groups.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.groups, v.days, v.dailyGroups]);
  return (
    <div className="stack">
      <ChartPanel
        title={`Real tokens per day by ${c.agent === "all" ? c.group : "model"}`}
        subtitle={`${v.days.length} days · ${keys.length} series · stacked`}
        chart={<StackChart label="Real tokens per day" height={310} pos={dayNum} xLabel={(n) => shortDate(n)} title={(x) => longDate(x.name)} onBrush={c.zoom} keys={keys} data={data} />}
        table={() => (
          <DataTable
            label="Real tokens per day (table)"
            rows={[...data].reverse()}
            rowKey={(r) => r.name}
            columns={[
              { key: "day", label: "Date", value: (r) => r.name },
              ...keys.slice(0, 10).map((k) => ({ key: k.key, label: k.label, value: (r: StackDatum) => r.values[k.key] || 0 })),
              { key: "total", label: "Real tokens", value: (r) => (r.vector ? tokens(r.vector) : 0), bar: true },
            ]}
          />
        )}
      />
      <Panel title="Per model / agent" subtitle="Every group in this range, with its share of real tokens">
        <DataTable label="Model breakdown" rows={v.groups} columns={groupCols(c)} rowKey={(r) => r.key} total={totalRow(c)} />
      </Panel>
    </div>
  );
}
/* ---------- Time ---------- */
const hourKeys: SeriesKey[] = [{ key: "Tokens", label: "Tokens", color: "var(--accent)" }];
const classKeys = (
  [
    ["Input", 0, "var(--tk-input)"],
    ["Cache write", 1, "var(--tk-cw)"],
    ["Cache read", 2, "var(--tk-cr)"],
    ["Output", 3, "var(--tk-out)"],
  ] as const
).map(([key, i, color]) => ({ key, label: key, color, i }));
export function Time({ c }: { c: ReportCtx }) {
  const v = c.view;
  const hours = useMemo<StackDatum[]>(() => v.byHour.map((x, i) => ({ name: pad2(i) + ":00", values: { Tokens: tokens(x) }, vector: x })), [v.byHour]);
  const daily = useMemo<StackDatum[]>(() => v.days.map((x) => ({ name: x.key, values: Object.fromEntries(classKeys.map((k) => [k.key, x.v[k.i]])), vector: x.v })), [v.days]);
  const heat = useMemo(
    () => v.weekday.flatMap((hs, wd) => hs.map((x, hr) => ({ key: wd + ":" + hr, value: tokens(x), title: `${WD[wd]} ${pad2(hr)}:00`, rows: vectorRows(x) }))),
    [v.weekday],
  );
  return (
    <div className="stack">
      <div className="grid-2">
        <ChartPanel
          title="Hour of day"
          subtitle={c.tzLabel}
          chart={
            <StackChart
              label="Tokens by hour of day"
              height={240}
              tickWidth={34}
              xLabel={(n) => n.slice(0, 2)}
              title={(x) => x.name + " – " + x.name.slice(0, 2) + ":59"}
              keys={hourKeys}
              data={hours}
            />
          }
          table={() => (
            <DataTable
              label="Hour of day (table)"
              searchMin={99}
              rows={hours}
              rowKey={(r) => r.name}
              columns={[{ key: "hour", label: "Hour", value: (r) => r.name }, ...vectorCols<StackDatum>((r) => r.vector ?? ZERO)]}
            />
          )}
        />
        <Panel title="Weekday × hour" subtitle={"When the work happens · " + c.tzLabel}>
          <Heatmap label="Weekday and hour usage" cells={heat} />
        </Panel>
      </div>
      <ChartPanel
        title="Daily consumption"
        subtitle="Input, cache write, cache read and output per day"
        chart={
          <StackChart
            label="Daily consumption by token class"
            height={290}
            pos={dayNum}
            xLabel={(n) => shortDate(n)}
            title={(x) => longDate(x.name)}
            onBrush={c.zoom}
            keys={classKeys}
            data={daily}
          />
        }
        table={() => (
          <DataTable
            label="Daily consumption (table)"
            rows={[...daily].reverse()}
            rowKey={(r) => r.name}
            columns={[{ key: "day", label: "Date", value: (r) => r.name }, ...vectorCols<StackDatum>((r) => r.vector ?? ZERO)]}
          />
        )}
      />
      <Panel title="By month">
        <DataTable
          label="Monthly totals"
          rows={v.months}
          rowKey={(r) => r.key}
          searchMin={99}
          columns={[
            { key: "month", label: "Month", value: (r) => r.key },
            { key: "activeDays", label: "Active days", value: (r) => v.days.filter((x) => x.key.startsWith(r.key) && tokens(x.v) > 0).length },
            ...vectorCols<(typeof v.months)[number]>((r) => r.v),
          ]}
        />
      </Panel>
    </div>
  );
}
/* ---------- Tables ---------- */
type CostRow = ReturnType<typeof claudeCostRows>[number];
export function Tables({ c }: { c: ReportCtx }) {
  const v = c.view,
    claude = c.model.claude;
  const dist = CLASSES.map(([key, i, color]) => ({ key, v: v.total[i], color }));
  const claudeRows = claude ? claudeCostRows(claude, v.groups, true) : [];
  const claudeTotal = claudeRows.pop();
  const money = (k: "input" | "cacheWrite" | "cacheRead" | "output" | "total", label: string) => ({ key: k, label, value: (r: CostRow) => r[k], render: (r: CostRow) => currency(r[k]) });
  return (
    <div className="stack">
      <Panel title="Full breakdown" subtitle="Exact token counts for every group in this range">
        <DataTable label="Full token breakdown" rows={v.groups} columns={groupCols(c)} rowKey={(r) => r.key} total={totalRow(c)} />
      </Panel>
      <Panel title="Consumption distribution">
        <DataTable
          label="Token class distribution"
          rows={dist}
          rowKey={(r) => r.key}
          searchMin={99}
          total={{ key: "Total", v: c.total, color: "" }}
          columns={[
            { key: "key", label: "Class", value: (r) => r.key, render: (r, foot) => (foot ? <strong>Total</strong> : <DotName color={r.color} text={r.key} />) },
            { key: "tokens", label: "Tokens", value: (r) => r.v, bar: true },
            { key: "share", label: "Share", value: (r) => r.v / (c.total || 1), render: (r) => percent(r.v / (c.total || 1)) },
          ]}
        />
      </Panel>
      <Panel title="Equivalent API cost" subtitle="Unknown costs show —. A star marks costs covering only some tokens.">
        {claude ? (
          <DataTable
            label="Claude cost components"
            rows={claudeRows}
            rowKey={(r) => r.model}
            searchMin={99}
            total={claudeTotal ?? null}
            columns={[
              {
                key: "model",
                label: "Model",
                value: (r) => r.model + (r.known ? "" : " *"),
                path: true,
                render: (r, foot) =>
                  foot ? (
                    <strong>Total</strong>
                  ) : (
                    <span className="cell-path" title={r.known ? r.model : r.model + " — unknown model, priced at the legacy fallback rate"}>
                      {r.model + (r.known ? "" : " *")}
                    </span>
                  ),
              },
              { key: "rate", label: "Rate in / out (per million)", value: (r) => r.rate },
              money("input", "Input"),
              money("cacheWrite", "Cache write"),
              money("cacheRead", "Cache read"),
              money("output", "Output"),
              { ...money("total", "Total"), bar: true },
            ]}
          />
        ) : (
          <DataTable
            label="Cost breakdown"
            rows={[...v.groups].sort((a, b) => b.v[6] - a.v[6])}
            rowKey={(r) => r.key}
            total={totalRow(c)}
            columns={[
              {
                key: "group",
                label: "Agent / model",
                value: (r) => c.label(r.key),
                path: true,
                render: (r, foot) => (foot ? <strong>Total</strong> : <DotName color={c.colorOf(r.key)} text={c.label(r.key)} />),
              },
              { key: "tokens", label: "Real tokens", value: (r) => tokens(r.v) },
              { key: "priced", label: "Priced tokens", value: (r) => r.v[7] },
              { key: "coverage", label: "Coverage", value: (r) => (tokens(r.v) ? r.v[7] / tokens(r.v) : 0), render: (r) => (tokens(r.v) ? percent(r.v[7] / tokens(r.v)) : "—") },
              { key: "cost", label: "API equivalent", value: (r) => r.v[6], render: (r) => costText(r.v), bar: true },
            ]}
          />
        )}
      </Panel>
      {claude && (
        <Panel title="App card vs reality" subtitle="All time; independent of the range filter">
          <DataTable
            label="Claude app card comparison"
            rows={claudeComparison(claude)}
            rowKey={(r) => r.model}
            searchMin={99}
            columns={[
              { key: "model", label: "Model", value: (r) => r.model },
              { key: "input", label: "Card “in”", value: (r) => r.input },
              { key: "output", label: "Card “out”", value: (r) => r.output },
              { key: "real", label: "Real tokens", value: (r) => r.actual, bar: true },
              { key: "cardShare", label: "Card share", value: (r) => r.cardShare, render: (r) => percent(r.cardShare) },
              { key: "realShare", label: "Real share", value: (r) => r.realShare, render: (r) => percent(r.realShare) },
              { key: "hidden", label: "Hidden by card", value: (r) => r.hidden, render: (r) => (r.hidden === null ? "—" : r.hidden.toFixed(0) + "×") },
            ]}
          />
          <Notice kind="info">
            {`${number(claude.meta.rawRecords)} raw records · ${number(claude.meta.countedRecords)} counted · ${number(claude.meta.duplicateRecords)} duplicates · ${number(claude.meta.partialRecords)} streaming snapshots · ${claude.meta.inflation.toFixed(2)}× inflation. The card excludes cache tokens and uses raw output for its headline total. ${claude.meta.dedupe ? "Each request keeps the record with the greatest output." : "Raw mode counts every transcript record."}`}
          </Notice>
          {claude.meta.unknownModels.length > 0 && <Notice>{"Unknown Claude models use the legacy fallback rate: " + claude.meta.unknownModels.join(", ")}</Notice>}
        </Panel>
      )}
    </div>
  );
}
/* ---------- Projects ---------- */
export function ProjectsTab({ c }: { c: ReportCtx }) {
  const v = c.view;
  const sum = v.projects.reduce((n, p) => n + tokens(p.v), 0) || 1;
  type P = (typeof v.projects)[number];
  type S = (typeof v.heaviest)[number];
  return (
    <div className="stack">
      <Panel title="By project" subtitle="Attributed by the working directory of each session">
        <DataTable
          label="By project table"
          rows={v.projects}
          rowKey={(r) => r.key}
          columns={[
            { key: "path", label: "Project", value: (r: P) => r.key, path: true, className: "mono" },
            { key: "sessions", label: "Sessions", value: (r: P) => r.sessions },
            { key: "agents", label: "Agents", value: (r: P) => r.agents.size, title: (r: P) => [...r.agents].map((a) => c.model.labels[a] ?? a).join(", ") },
            { key: "branches", label: "Branches", value: (r: P) => r.branches.size, title: (r: P) => [...r.branches].join(", ") },
            ...vectorCols<P>((r) => r.v),
            { key: "share", label: "Share", value: (r: P) => tokens(r.v) / sum, render: (r: P) => percent(tokens(r.v) / sum) },
          ]}
        />
      </Panel>
      <Panel title="Heaviest sessions" subtitle="The 40 largest sessions in this range">
        <DataTable
          label="Heaviest sessions table"
          rows={v.heaviest}
          rowKey={(r) => r.agent + r.id}
          columns={[
            { key: "path", label: "Project", value: (r: S) => r.cwd || "(unknown)", path: true, className: "mono" },
            {
              key: "start",
              label: "Started",
              value: (r: S) => r.start,
              render: (r: S) => (c.model.utc ? new Date(r.start).toLocaleString("en-US", { timeZone: "UTC" }) : dateTime(r.start)),
            },
            { key: "agent", label: "Agent", value: (r: S) => c.model.labels[r.agent] ?? r.agent, render: (r: S) => <DotName color={agentColor(r.agent)} text={c.model.labels[r.agent] ?? r.agent} /> },
            { key: "model", label: "Model", value: (r: S) => r.model },
            { key: "branch", label: "Branch", value: (r: S) => r.branch, render: (r: S) => (r.branch ? <span className="mono">{r.branch}</span> : <span className="muted">—</span>) },
            { key: "duration", label: "Minutes", value: (r: S) => Math.max(1, Math.round((r.end - r.start) / 60000)) },
            ...vectorCols<S>((r) => r.v),
          ]}
        />
      </Panel>
    </div>
  );
}

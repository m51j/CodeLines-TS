/**
 * The five AI report sections. They stay mounted while the range or grouping changes, so
 * numbers count to their new values and bars, ribbons and heatmaps reshape in place.
 */
import { useMemo } from "react";
import type { Vector } from "../../../../../shared/contracts";
import { calendarDays, claudeComparison, claudeCostRows, type ReportBucket } from "../../../../../reports/selectors";
import { tokens, partialCost } from "../../../../../ai/model";
import { costText, currency } from "../../../../../ai/aggregate";
import { ChartSheet } from "../../charts/ChartSheet";
import { Heatmap } from "../../charts/Heatmap";
import { Ribbon } from "../../charts/Ribbon";
import { Spark } from "../../charts/Spark";
import { StackedBars, type BarDatum } from "../../charts/StackedBars";
import { Waffle } from "../../charts/Waffle";
import { Notice, Sheet, Tiles, Tk } from "../../ui/controls";
import { agentColor, compact, day, number, percent, shortDay } from "../../ui/fmt";
import { ShareCell, Table, type Col } from "../../ui/Table";
import { TOKEN_CLASSES, groupCols, isTotal, totalRow, vectorColumns, vectorDetails, type Ctx } from "./shared";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hh = (h: number) => String(h).padStart(2, "0") + ":00";
const dayCols: Col<{ key: string; v: Vector }>[] = [{ key: "day", label: "Day", value: (r) => r.key }, ...vectorColumns<{ key: string; v: Vector }>((r) => r.v)];

export function Overview({ c }: { c: Ctx }) {
  const v = c.view,
    total = c.total;
  const active = v.days.filter((d) => tokens(d.v) > 0).length;
  const peakDay = v.days.reduce<ReportBucket | undefined>((p, d) => (!p || tokens(d.v) > tokens(p.v) ? d : p), undefined),
    peakMonth = v.months.reduce<ReportBucket | undefined>((p, m) => (!p || tokens(m.v) > tokens(p.v) ? m : p), undefined),
    peak = v.byHour.reduce((p, x, i) => (tokens(x) > tokens(v.byHour[p]) ? i : p), 0);
  // Long ranges read better as weekly sums; short ones keep one point per day.
  const daily = v.days.map((d) => tokens(d.v)),
    step = daily.length > 120 ? 7 : daily.length > 60 ? 3 : 1,
    series = step === 1 ? daily : Array.from({ length: Math.ceil(daily.length / step) }, (_, i) => daily.slice(i * step, i * step + step).reduce((n, x) => n + x, 0));
  const star = partialCost(v.total) ? "*" : "";
  const top = total && v.groups[0] ? c.label(v.groups[0].key) : "—",
    topShare = `${percent(total && v.groups[0] ? tokens(v.groups[0].v) / total : 0)} of real tokens`;
  const agentSegs = v.agents
    .filter((a) => tokens(a.v) > 0)
    .map((a) => ({
      key: a.key,
      label: c.model.labels[a.key] ?? a.key,
      share: tokens(a.v) / (total || 1),
      color: agentColor(a.key),
      detail: vectorDetails(a.v),
    }));
  const classes = TOKEN_CLASSES.map((k) => ({ ...k, v: v.total[k.idx] }));
  const classSegs = classes
    .filter((k) => k.v > 0)
    .map((k) => ({ key: k.key, label: k.key, share: k.v / (total || 1), color: k.color, detail: `Tokens: ${number(k.v)} · Share: ${percent(k.v / (total || 1))}` }));
  const firstDay = v.selectedDays[0],
    lastDay = v.selectedDays.at(-1);
  const cells = useMemo(
    () =>
      calendarDays(v.days).map((d) => {
        const out = !!firstDay && !!lastDay && (d.day < firstDay || d.day > lastDay);
        return { key: d.day, value: tokens(d.v), detail: out ? "Outside this range" : vectorDetails(d.v), out };
      }),
    [v.days, firstDay, lastDay],
  );
  const agentRows = useMemo(() => [...v.agents, totalRow(v)], [v]);
  return (
    <>
      <div className="ai-metrics">
        <div className="hero-tile">
          <span className="tile-label">Real tokens</span>
          <strong className="hero-value" title={number(total)}>
            <Tk value={total} fmt={compact} dur={700} />
          </strong>
          <small className="hero-full">{number(total)} tokens · Input + cache + output</small>
          <div className="hero-spark" title={step === 1 ? "Real tokens per day" : `Real tokens per ${step === 7 ? "week" : step + " days"}`}>
            <Spark values={series} w={300} h={56} />
          </div>
          <div className="hero-foot">
            <span>
              <b>{compact(v.total[4] ? total / v.total[4] : 0)}</b> tokens / call
            </span>
            <span>
              <b>{compact(active ? total / active : 0)}</b> / active day
            </span>
          </div>
        </div>
        <Tiles
          className="ai-tiles"
          prefix="ai"
          items={[
            {
              id: "api",
              label: "API equivalent",
              value: v.total[7] || v.total[6] ? v.total[6] : "—",
              fmt: (x) => currency(x) + star,
              detail: `Covers ${percent(total ? v.total[7] / total : 0)} of tokens`,
              title: costText(v.total),
            },
            { id: "calls", label: "Model calls", value: v.total[4], fmt: compact, detail: `${number(v.total[4])} API requests`, title: number(v.total[4]) },
            { id: "sessions", label: "Sessions", value: v.sessions.length, fmt: number, detail: "Conversations in this range" },
            { id: "active", label: "Active days", value: active, fmt: number, detail: `${active} of ${v.selectedDays.length} recorded days` },
            { id: "phour", label: "Peak hour", value: total ? hh(peak) : "—", detail: `${compact(tokens(v.byHour[peak]))} tokens` },
            { id: "pday", label: "Peak day", value: total && peakDay ? peakDay.key : "—", detail: `${compact(peakDay ? tokens(peakDay.v) : 0)} tokens` },
            { id: "pmonth", label: "Peak month", value: total && peakMonth ? peakMonth.key : "—", detail: `${compact(peakMonth ? tokens(peakMonth.v) : 0)} tokens` },
            { id: "top", label: c.byAgentGroup ? "Top agent" : "Top model", value: top, detail: topShare, tip: { title: top, detail: topShare } },
          ]}
        />
      </div>
      {c.all && (
        <Sheet title="By agent" sub="Share of real tokens in this range">
          <Ribbon segments={agentSegs} />
          <div className="legend">
            {v.agents.map((a) => (
              <span key={a.key}>
                <i style={{ background: agentColor(a.key) }} />
                {c.model.labels[a.key] ?? a.key} · {percent(tokens(a.v) / (total || 1))}
              </span>
            ))}
          </div>
          <Table
            label="Agent comparison"
            rows={agentRows}
            rowKey={(r) => r.key}
            isTotal={isTotal}
            columns={[
              {
                key: "agent",
                label: "Agent",
                value: (r) => (r.key === "Total" ? "Total" : (c.model.labels[r.key] ?? r.key)),
                render: (r) =>
                  r.key === "Total" ? (
                    "Total"
                  ) : (
                    <span className="agent-name">
                      <i style={{ background: agentColor(r.key) }} />
                      {c.model.labels[r.key] ?? r.key}
                    </span>
                  ),
              },
              { key: "sessions", label: "Sessions", value: (r) => r.sessions },
              ...vectorColumns<ReportBucket>((r) => r.v),
              { key: "share", label: "Share", value: (r) => tokens(r.v) / (total || 1), render: (r) => <ShareCell frac={tokens(r.v) / (total || 1)} /> },
            ]}
          />
        </Sheet>
      )}
      <ChartSheet
        title="Activity"
        sub="One cell per calendar day, including cache consumption. Rows run Sunday–Saturday; columns are weeks."
        chart={<Heatmap mode="calendar" label="Daily activity" cells={cells} />}
        table={() => <Table label="Daily activity table" rows={v.days.filter((d) => tokens(d.v) > 0)} rowKey={(r) => r.key} columns={dayCols} />}
      />
      <Sheet className="mix-sheet" title="Where the tokens actually go" sub="Real tokens by class. Cache reads dominate long agent sessions.">
        <div className="mix-grid">
          <div>
            <Ribbon segments={classSegs} className="tall" />
            <div className="legend big">
              {classes.map((k) => (
                <span key={k.key}>
                  <i style={{ background: k.color }} />
                  <b>{k.key}</b>
                  <em>{percent(k.v / (total || 1))}</em>
                  <small>{number(k.v)}</small>
                </span>
              ))}
            </div>
          </div>
          <Waffle parts={classes.map((k) => ({ label: k.key, value: k.v, color: k.color }))} />
        </div>
      </Sheet>
    </>
  );
}

export function Models({ c }: { c: Ctx }) {
  const v = c.view,
    word = c.all ? c.sel.group : "model";
  const series = useMemo(() => v.groups.map((g) => ({ key: g.key, label: c.label(g.key), color: c.groupColor.get(g.key) ?? "var(--muted)" })), [v, c]);
  const data = useMemo<BarDatum[]>(
    () =>
      v.days.map((d) => {
        const values: Record<string, number> = {};
        for (const g of v.groups) values[g.key] = tokens(v.dailyGroups.get(d.key)?.get(g.key) ?? [0, 0, 0, 0]);
        return { key: d.key, values, tip: { title: day(d.key), detail: vectorDetails(d.v) } };
      }),
    [v],
  );
  const rows = useMemo(() => [...v.groups, totalRow(v)], [v]);
  return (
    <>
      <ChartSheet
        title={`Real tokens per day by ${word}`}
        sub={`Stacked by ${word} · hover or use the arrow keys for the full breakdown`}
        chart={<StackedBars series={series} data={data} height={300} xFmt={shortDay} label={`Real tokens per day by ${word}`} />}
        table={() => <Table label={"Daily tokens by " + word} rows={v.days.filter((d) => tokens(d.v))} rowKey={(r) => r.key} columns={dayCols} />}
      />
      <Sheet title="Per model / agent" sub={c.model.claude ? "Claude Code splits cache writes into 5-minute and 1-hour lifetimes" : undefined}>
        <Table label="Model breakdown" rows={rows} columns={groupCols(c)} rowKey={(r) => r.key} isTotal={isTotal} />
      </Sheet>
    </>
  );
}

const classSeries = [
  { key: "Input", label: "Input", color: "var(--t-in)" },
  { key: "Cache write", label: "Cache write", color: "var(--t-cw)" },
  { key: "Cache read", label: "Cache read", color: "var(--t-cr)" },
  { key: "Output", label: "Output", color: "var(--t-out)" },
];
const tokenSeries = [{ key: "Tokens", label: "Tokens", color: "var(--accent)" }];
const night = (d: BarDatum) => {
  const h = Number(d.key.slice(0, 2));
  return h < 6 || h >= 22;
};

export function Time({ c }: { c: Ctx }) {
  const v = c.view;
  const hourData = useMemo<BarDatum[]>(
    () => v.byHour.map((x, i) => ({ key: hh(i), values: { Tokens: tokens(x) }, tip: { title: hh(i), detail: vectorDetails(x) } })),
    [v],
  );
  const weekCells = useMemo(
    () => v.weekday.flatMap((hours, d) => hours.map((x, h) => ({ key: `${d}:${h}`, value: tokens(x), detail: vectorDetails(x) }))),
    [v],
  );
  const dailyData = useMemo<BarDatum[]>(
    () =>
      v.days.map((d) => ({
        key: d.key,
        values: { Input: d.v[0], "Cache write": d.v[1], "Cache read": d.v[2], Output: d.v[3] },
        tip: { title: day(d.key), detail: vectorDetails(d.v) },
      })),
    [v],
  );
  return (
    <>
      <div className="two-col">
        <ChartSheet
          title="Hour of day"
          sub={c.tzLabel + " · night hours shaded"}
          chart={<StackedBars series={tokenSeries} data={hourData} height={260} legend={false} peak shade={night} label="Real tokens by hour of day" />}
          table={() => (
            <Table
              label="Hour of day table"
              rows={v.byHour.map((x, i) => ({ key: hh(i), v: x }))}
              rowKey={(r) => r.key}
              columns={[{ key: "hour", label: "Hour", value: (r) => r.key }, ...vectorColumns<{ key: string; v: Vector }>((r) => r.v)]}
            />
          )}
        />
        <ChartSheet
          title="Weekday × hour"
          sub="Where in the week the tokens land"
          chart={<Heatmap mode="hours" label="Weekday and hour usage" cells={weekCells} />}
          table={() => (
            <Table
              label="Weekday and hour table"
              rows={v.weekday.flatMap((hours, d) => hours.map((x, h) => ({ key: `${WEEKDAYS[d]} ${hh(h)}`, v: x }))).filter((r) => tokens(r.v))}
              rowKey={(r) => r.key}
              columns={[{ key: "slot", label: "Slot", value: (r) => r.key }, ...vectorColumns<{ key: string; v: Vector }>((r) => r.v)]}
            />
          )}
        />
      </div>
      <ChartSheet
        title="Daily consumption"
        sub="Input, cache write, cache read and output per day"
        chart={<StackedBars series={classSeries} data={dailyData} height={280} xFmt={shortDay} label="Daily consumption by token class" />}
        table={() => <Table label="Daily consumption table" rows={v.days.filter((d) => tokens(d.v))} rowKey={(r) => r.key} columns={dayCols} />}
      />
      <Sheet title="By month">
        <Table
          label="Monthly totals"
          rows={v.months}
          rowKey={(r) => r.key}
          columns={[
            { key: "month", label: "Month", value: (r) => r.key },
            { key: "activeDays", label: "Active days", value: (r) => v.days.filter((d) => d.key.startsWith(r.key) && tokens(d.v) > 0).length },
            ...vectorColumns<ReportBucket>((r) => r.v),
          ]}
        />
      </Sheet>
    </>
  );
}

export function Tables({ c }: { c: Ctx }) {
  const v = c.view,
    total = c.total;
  const rows = [...v.groups, totalRow(v)];
  const classRows = [...TOKEN_CLASSES.map((k) => ({ key: k.key as string, v: v.total[k.idx], color: k.color as string })), { key: "Total", v: total, color: "" }];
  const claude = c.model.claude;
  return (
    <>
      <Sheet title="Full breakdown">
        <Table label="Full token breakdown" rows={rows} columns={groupCols(c)} rowKey={(r) => r.key} isTotal={isTotal} />
      </Sheet>
      <Sheet title="Consumption distribution">
        <Table
          label="Token class distribution"
          rows={classRows}
          rowKey={(r) => r.key}
          isTotal={isTotal}
          columns={[
            {
              key: "key",
              label: "Class",
              value: (r) => r.key,
              render: (r) =>
                r.color ? (
                  <span className="agent-name">
                    <i style={{ background: r.color }} />
                    {r.key}
                  </span>
                ) : (
                  r.key
                ),
            },
            { key: "tokens", label: "Tokens", value: (r) => r.v },
            { key: "share", label: "Share", value: (r) => r.v / (total || 1), render: (r) => <ShareCell frac={r.v / (total || 1)} /> },
          ]}
        />
      </Sheet>
      <Sheet title="Equivalent API cost" sub="Unknown costs show —. A star marks costs covering only some tokens.">
        {claude ? (
          <Table
            label="Claude cost components"
            rows={claudeCostRows(claude, v.groups, true)}
            rowKey={(r) => r.model}
            isTotal={(r) => r.model === "Total"}
            columns={[
              { key: "model", label: "Model", value: (r) => r.model + (r.known ? "" : " *"), path: true },
              { key: "rate", label: "Rate in / out (per million)", value: (r) => r.rate },
              ...(["input", "cacheWrite", "cacheRead", "output", "total"] as const).map((k) => ({
                key: k,
                label: k,
                num: true,
                value: (r: ReturnType<typeof claudeCostRows>[number]) => r[k],
                render: (r: ReturnType<typeof claudeCostRows>[number]) => currency(r[k]),
              })),
            ]}
          />
        ) : (
          <Table
            label="Cost breakdown"
            rows={[...rows].sort((a, b) => b.v[6] - a.v[6])}
            rowKey={(r) => r.key}
            isTotal={isTotal}
            columns={[
              { key: "group", label: "Agent / model", value: (r) => (r.key === "Total" ? "Total" : c.label(r.key)), path: true },
              { key: "tokens", label: "Real tokens", value: (r) => tokens(r.v) },
              { key: "priced", label: "Priced tokens", value: (r) => Math.round(r.v[7]) },
              {
                key: "coverage",
                label: "Coverage",
                value: (r) => (tokens(r.v) ? r.v[7] / tokens(r.v) : 0),
                render: (r) => (tokens(r.v) ? <ShareCell frac={r.v[7] / tokens(r.v)} /> : "—"),
              },
              { key: "cost", label: "API equivalent", num: true, value: (r) => r.v[6], render: (r) => costText(r.v) },
            ]}
          />
        )}
      </Sheet>
      {claude && (
        <Sheet title="App card vs reality" sub="All time; independent of the range filter">
          <Table
            label="Claude app card comparison"
            rows={claudeComparison(claude)}
            rowKey={(r) => r.model}
            columns={[
              { key: "model", label: "Model", value: (r) => r.model },
              { key: "input", label: "Card “in”", value: (r) => r.input },
              { key: "output", label: "Card “out”", value: (r) => r.output },
              { key: "real", label: "Real tokens", value: (r) => r.actual },
              { key: "cardShare", label: "Card share", value: (r) => r.cardShare, render: (r) => percent(r.cardShare) },
              { key: "realShare", label: "Real share", value: (r) => r.realShare, render: (r) => percent(r.realShare) },
              {
                key: "hidden",
                label: "Hidden by card",
                value: (r) => r.hidden,
                render: (r) => (r.hidden === null ? "—" : <b className="hidden-x">{r.hidden.toFixed(0)}×</b>),
              },
            ]}
          />
          <Notice kind="info">
            {number(claude.meta.rawRecords)} raw records · {number(claude.meta.countedRecords)} counted · {number(claude.meta.duplicateRecords)}{" "}
            duplicates · {number(claude.meta.partialRecords)} streaming snapshots · {claude.meta.inflation.toFixed(2)}× inflation. The card excludes
            cache tokens and uses raw output for its headline total.{" "}
            {claude.meta.dedupe ? "Each request keeps the record with the greatest output." : "Raw mode counts every transcript record."}
          </Notice>
          {claude.meta.unknownModels.length > 0 && (
            <Notice>Unknown Claude models use the legacy fallback rate: {claude.meta.unknownModels.join(", ")}</Notice>
          )}
        </Sheet>
      )}
    </>
  );
}

export function Projects({ c }: { c: Ctx }) {
  const v = c.view,
    projTotal = v.projects.reduce((n, p) => n + tokens(p.v), 0) || 1;
  type ProjectRow = (typeof v.projects)[number];
  type SessionRow = (typeof v.heaviest)[number];
  return (
    <>
      <Sheet title="By project" sub="Attributed by the working directory of each session">
        <Table<ProjectRow>
          label="By project table"
          rows={v.projects}
          rowKey={(r) => r.key}
          columns={[
            { key: "path", label: "Project", value: (r) => r.key, path: true },
            { key: "sessions", label: "Sessions", value: (r) => r.sessions },
            {
              key: "agents",
              label: "Agents",
              num: true,
              value: (r) => r.agents.size,
              render: (r) => (
                <span className="dots" title={[...r.agents].map((a) => c.model.labels[a] ?? a).join(", ")}>
                  {[...r.agents].map((a) => (
                    <i key={a} style={{ background: agentColor(a) }} />
                  ))}
                  <b>{r.agents.size}</b>
                </span>
              ),
            },
            { key: "branches", label: "Branches", value: (r) => r.branches.size },
            ...vectorColumns<ProjectRow>((r) => r.v),
            { key: "share", label: "Share", value: (r) => tokens(r.v) / projTotal, render: (r) => <ShareCell frac={tokens(r.v) / projTotal} /> },
          ]}
        />
      </Sheet>
      <Sheet title="Heaviest sessions" sub="The 40 largest sessions in this range">
        <Table<SessionRow>
          label="Heaviest sessions table"
          rows={v.heaviest}
          rowKey={(r) => r.agent + r.id}
          columns={[
            { key: "path", label: "Project", value: (r) => r.cwd || "(unknown)", path: true },
            {
              key: "start",
              label: "Started",
              num: false,
              value: (r) => r.start,
              render: (r) =>
                new Date(r.start).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  ...(c.model.utc ? { timeZone: "UTC" } : {}),
                }),
            },
            {
              key: "agent",
              label: "Agent",
              value: (r) => c.model.labels[r.agent] ?? r.agent,
              render: (r) => (
                <span className="agent-name">
                  <i style={{ background: agentColor(r.agent) }} />
                  {c.model.labels[r.agent] ?? r.agent}
                </span>
              ),
            },
            { key: "model", label: "Model", value: (r) => r.model, render: (r) => <span className="mono">{r.model}</span> },
            {
              key: "branch",
              label: "Branch",
              value: (r) => r.branch,
              render: (r) => (r.branch ? <span className="branch">{r.branch}</span> : "—"),
            },
            { key: "duration", label: "Minutes", value: (r) => Math.max(1, Math.round((r.end - r.start) / 60000)) },
            ...vectorColumns<SessionRow>((r) => r.v),
          ]}
        />
      </Sheet>
    </>
  );
}

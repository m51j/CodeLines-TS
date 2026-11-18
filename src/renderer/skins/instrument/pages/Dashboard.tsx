/** Dashboard: readouts, the workspace map, the AI pulse, and project overview ⇄ language share. */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ProjectMetric } from "../../../../shared/contracts";
import { tokens, dayParts } from "../../../../ai/model";
import { timeline } from "../../../../domain/daily";
import { widgetSummary, shiftDay } from "../../../../widget/summary";
import { compact, number, percent, tileNumber } from "../../../format";
import { enter, useFlip } from "../../../motion/core";
import { useWorkspace } from "../../../workspace";
import { memo, useSkin } from "../context";
import { langColor, minutesText, shortDate } from "../format";
import { Icon, type IconName } from "../icons";
import { Treemap } from "../charts";
import { Button, Seg } from "../ui/controls";
import { Empty, Panel, Split, Tiles, useAfterPaint, type TileItem } from "../ui/layout";
import { DataTable, type Column } from "../ui/Table";
const col = <T,>(key: keyof T & string, label: string, path = false): Column<T> => ({ key, label, path, value: (r) => r[key] as string | number | null | undefined });
const projectColumns: Column<ProjectMetric>[] = [
  col("projectName", "Project", true),
  col("fileCount", "Files"),
  { ...col<ProjectMetric>("physicalLines", "Physical lines"), bar: true },
  col("codeLines", "Code lines"),
  col("totalTokens", "Source tokens"),
];
const METRICS = [
  ["physicalLines", "Lines"],
  ["codeLines", "Code"],
  ["totalTokens", "Tokens"],
  ["fileCount", "Files"],
] as const;
type Metric = (typeof METRICS)[number][0];
function LangRow({ l, project, first, index }: { l: ProjectMetric["languages"][number]; project: ProjectMetric; first: boolean; index: number }) {
  const ref = useRef<HTMLDivElement>(null),
    ready = useAfterPaint();
  useLayoutEffect(() => {
    enter(ref.current, { y: 8, delay: first ? 120 + index * 40 : 60 + index * 18 });
    // Plays when the row appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const share = l.physicalLines / (project.physicalLines || 1);
  return (
    <div ref={ref} className="lang-row" data-k={l.language + l.category}>
      <div className="lang-top">
        <span className="lang-name">
          <i className="dot" style={{ background: langColor(l.language) }} />
          {l.language}
        </span>
        <strong>{percent(share)}</strong>
      </div>
      <div className="lang-track">
        <i style={{ background: langColor(l.language), width: ready ? (share * 100).toFixed(2) + "%" : "0%" }} />
      </div>
      <small>{`${number(l.files)} ${l.files === 1 ? "file" : "files"} · ${number(l.physicalLines)} lines · ${number(l.tokens)} tokens`}</small>
    </div>
  );
}
function PulseStat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <div className="pulse-stat">
      <Icon name={icon} size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function Dashboard() {
  const { state, draft, busy, saveThen, execute, selected, setSelected } = useWorkspace();
  const { go } = useSkin();
  const snap = state.settings.lastSnapshot,
    results = useMemo(() => snap?.projects ?? [], [snap]),
    current = results.find((p) => p.projectId === selected) ?? results[0];
  const enabledIds = useMemo(() => draft.projects.filter((p) => p.isEnabled).map((p) => p.id), [draft.projects]);
  const combined = state.ai?.combined ?? null;
  /* AI tokens of the last 30 days (payloadTotals with day > cut), per day for the sparkline and the pulse. */
  const ai = useMemo(() => {
    if (!combined) return null;
    const utc = combined.meta.tz === "utc",
      today = dayParts(Date.now(), utc).day,
      cut = dayParts(Date.now() - 30 * 86400000, false).day,
      perDay = new Map<string, number>();
    let total = 0;
    for (const [day, hours] of Object.entries(combined.hours)) {
      let t = 0;
      for (const h of Object.values(hours)) for (const v of Object.values(h)) t += tokens(v);
      perDay.set(day, t);
      if (day > cut) total += t;
    }
    const last30 = Array.from({ length: 30 }, (_, i) => {
      const day = shiftDay(today, i - 29);
      return { day, v: perDay.get(day) ?? 0 };
    });
    return { total, last30, today };
  }, [combined]);
  const summary = useMemo(
    () => (draft.aiUsage.enabled && combined ? widgetSummary({ ai: state.ai, daily: state.daily, settings: state.settings }) : null),
    [draft.aiUsage.enabled, combined, state.ai, state.daily, state.settings],
  );
  const scans = useMemo(() => timeline(state.daily, enabledIds).filter((r) => r.lines).slice(-16), [state.daily, enabledIds]);
  const [metric, setMetric] = useState<Metric>(memo.dashMetric);
  const mapItems = useMemo(
    () =>
      results.map((p) => {
        const top = p.languages[0];
        return {
          key: p.projectId,
          label: p.projectName,
          value: p[metric],
          valueText: compact(p[metric]),
          sub: top ? top.language : "",
          color: top ? langColor(top.language) : "var(--ink-3)",
          rows: [
            ["Files", number(p.fileCount)],
            ["Physical lines", number(p.physicalLines)],
            ["Code lines", number(p.codeLines)],
            ["Source tokens", number(p.totalTokens)],
            "-",
            ["Top language", top ? `${top.language} · ${percent(top.physicalLines / (p.physicalLines || 1))}` : "—"],
          ] as ("-" | [string, string])[],
        };
      }),
    [results, metric],
  );
  const langHost = useRef<HTMLDivElement>(null),
    mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
  }, []);
  const capture = useFlip(langHost, ".lang-row", (el) => el.dataset.k, { dur: 340 });
  if (!results.length || !current) {
    const n = enabledIds.length;
    return (
      <Empty
        art="codebase"
        title="Meet your codebase"
        text="Add your project folders, then scan to see files, languages, lines, and tokens."
        action={
          <div className="empty-actions">
            <Button
              label="Add your first project"
              primary={!n}
              icon="plus"
              disabled={!!busy}
              onClick={() => void saveThen(() => window.codelines.addProject(), "Project added")}
            />
            {n > 0 && <Button label={`Scan ${n} ${n === 1 ? "project" : "projects"}`} primary icon="play" disabled={!!busy} onClick={() => void execute("scan")} />}
          </div>
        }
      />
    );
  }
  const select = (id: string) => {
    if (id === current.projectId) return;
    capture();
    setSelected(id);
  };
  const sp = (k: "files" | "physicalLines" | "codeLines" | "tokens") => scans.map((r) => r.lines?.[k] ?? null).filter((v): v is number => v !== null);
  const tiles: TileItem[] = [
    { label: "Projects", value: results.length, detail: `${enabledIds.length} enabled`, meter: [enabledIds.length, draft.projects.length], onClick: () => go("Projects"), tip: "Open Projects" },
    { label: "Files", value: snap?.fileCount, spark: sp("files"), onClick: () => go("Analysis"), tip: "Open Analysis" },
    {
      label: "Physical lines",
      value: snap?.physicalLines,
      fmt: tileNumber,
      title: number(snap?.physicalLines),
      spark: sp("physicalLines"),
      onClick: () => go("Analysis"),
      tip: number(snap?.physicalLines) + " lines · open Analysis",
    },
    {
      label: "Code lines",
      value: snap?.codeLines,
      fmt: tileNumber,
      title: number(snap?.codeLines),
      tone: "success",
      spark: sp("codeLines"),
      onClick: () => go("Daily log"),
      tip: number(snap?.codeLines) + " lines · open the Daily log",
    },
    {
      label: "Source tokens",
      value: snap?.totalTokens,
      fmt: tileNumber,
      title: number(snap?.totalTokens),
      detail: snap?.tokenizerEncoding,
      spark: sp("tokens"),
      onClick: () => go("Analysis"),
      tip: number(snap?.totalTokens) + " tokens · open Analysis",
    },
    {
      label: "AI tokens · 30 days",
      value: ai ? ai.total : null,
      fmt: tileNumber,
      title: ai ? number(ai.total) : undefined,
      detail: "Cache included · all agents",
      tone: "accent",
      spark: ai?.last30.map((x) => x.v),
      onClick: draft.aiUsage.enabled ? () => go("AI usage") : undefined,
      tip: ai ? number(ai.total) + " tokens" + (draft.aiUsage.enabled ? " · open AI usage" : "") : null,
    },
  ];
  const max = Math.max(1, ...(ai?.last30.map((x) => x.v) ?? [0]));
  return (
    <>
      <Tiles items={tiles} id="dash" className="tiles-6" />
      <div className={"dash-top" + (draft.aiUsage.enabled ? "" : " is-solo")}>
        <Panel
          title="Workspace map"
          subtitle="Every scanned project, sized by the chosen metric and coloured by its main language"
          className="panel-map"
          tools={
            <Seg
              label="Size projects by"
              role="radiogroup"
              className="seg-sm"
              value={metric}
              options={METRICS.map(([value, label]) => ({ value, label }))}
              onChange={(v) => {
                memo.dashMetric = v;
                setMetric(v);
              }}
            />
          }
        >
          <Treemap label="Workspace map: projects sized by the chosen metric" items={mapItems} selected={current.projectId} onPick={select} />
        </Panel>
        {draft.aiUsage.enabled && (
          <Panel
            title="AI pulse"
            subtitle="Real tokens per day · last 30 days"
            className="panel-pulse"
            tools={<Button label="AI usage" small ghost icon="arrow" onClick={() => go("AI usage")} />}
          >
            {ai && summary ? (
              <>
                <div className="pulse-bars" role="img" aria-label={`AI tokens per day, last 30 days. Total ${compact(ai.total)}.`}>
                  {ai.last30.map((x, i) => (
                    <i
                      key={x.day}
                      className={x.day === ai.today ? "is-today" : undefined}
                      style={{ "--h": ((x.v / max) * 100).toFixed(1) + "%", "--i": i } as CSSProperties}
                      data-tip={`${shortDate(x.day)} · ${x.v ? compact(x.v) + " tokens" : "no activity"}`}
                    />
                  ))}
                </div>
                <div className="pulse-stats">
                  <PulseStat label="Today" value={compact(summary.ranges.today.tokens)} icon="bolt" />
                  <PulseStat label="Streak" value={`${summary.streak.current} ${summary.streak.current === 1 ? "day" : "days"}`} icon="flame" />
                  <PulseStat label="Active today" value={minutesText(summary.ranges.today.minutes)} icon="clock" />
                </div>
              </>
            ) : (
              <p className="muted">Refresh AI usage to see the last 30 days here.</p>
            )}
          </Panel>
        )}
      </div>
      <Split
        id="dash"
        initial={0.62}
        label="Resize project overview and language share"
        left={
          <Panel title="Project overview" subtitle="Latest scan · select a project to explore its languages">
            <DataTable
              label="Project overview"
              rows={results}
              columns={projectColumns}
              rowKey={(r) => r.projectId}
              onSelect={(r) => select(r.projectId)}
              selected={(r) => r.projectId === current.projectId}
            />
          </Panel>
        }
        right={
          <Panel
            title="Language share"
            subtitle={current.projectName}
            tools={<Button label="Analysis" small ghost icon="arrow" tip="Open this project in Analysis" onClick={() => go("Analysis")} />}
          >
            <div ref={langHost} className="lang-list" role="region" aria-label="Language share" tabIndex={0}>
              {!current.languages.length && <p className="muted">No language data for this project.</p>}
              {current.languages.map((l, i) => (
                <LangRow key={l.language + l.category} l={l} project={current} first={!mounted.current} index={i} />
              ))}
            </div>
          </Panel>
        }
      />
    </>
  );
}

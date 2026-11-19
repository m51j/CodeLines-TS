/** Code changes: Git history options, totals, and repositories ⇄ their changed files. */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GitFile, GitProject } from "../../../../shared/contracts";
import { gitTotals } from "../../../../domain/history";
import { modeLabel, number, scopeLabel, signed, tileNumber } from "../../../format";
import { enter, play } from "../../../motion/core";
import { historyInputs, useWorkspace } from "../../../workspace";
import { dateTime } from "../format";
import { Button, Field, Seg } from "../ui/controls";
import { Empty, Notice, Panel, Split, SwapIn, Tiles, type TileItem } from "../ui/layout";
import { DataTable, type Column } from "../ui/Table";
const PRESETS = [7, 30, 365];
const col = <T,>(key: keyof T & string, label: string, path = false): Column<T> => ({ key, label, path, value: (r) => r[key] as string | number | null | undefined });
const delta = <T,>(key: string, label: string, get: (r: T) => number | null | undefined): Column<T> => ({
  key,
  label,
  value: get,
  render: (r) => {
    const v = get(r);
    return <span className={v ? (v > 0 ? "up" : "down") : ""}>{signed(v)}</span>;
  },
});
const repoColumns: Column<GitProject>[] = [
  col("projectName", "Project", true),
  { ...col<GitProject>("branch", "Branch"), className: "mono" },
  {
    key: "head",
    label: "Captured HEAD",
    value: (r) => r.head,
    render: (r) => (
      <span className="mono" title={r.head}>
        {r.head ? r.head.slice(0, 10) : "—"}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    value: (r) => r.status,
    render: (r) => <span className={"pill " + (r.status === "Complete" ? "is-loaded" : r.isIncomplete ? "is-warn" : "is-empty")}>{r.status}</span>,
  },
  { ...col<GitProject>("added", "Added"), bar: "var(--success)" },
  { ...col<GitProject>("deleted", "Deleted"), bar: "var(--danger)" },
  col("modifiedEstimate", "Modified est."),
  delta<GitProject>("net", "Net", (r) => r.net),
  col("commits", "Commits"),
];
const fileColumns: Column<GitFile>[] = [
  { ...col<GitFile>("path", "Path", true), className: "mono" },
  { ...col<GitFile>("added", "Added"), bar: "var(--success)" },
  { ...col<GitFile>("deleted", "Deleted"), bar: "var(--danger)" },
  col("modifiedEstimate", "Modified est."),
  delta<GitFile>("net", "Net", (r) => r.net),
  { key: "binary", label: "Binary", value: (r) => (r.binary ? "Yes" : "No") },
];
export function CodeChanges() {
  const { state, draft, busy, partial, change, execute, exportData } = useWorkspace();
  const [chosen, setChosen] = useState("");
  const history = state.settings.lastGitHistory,
    running = busy?.kind === "history",
    projects = running || !history ? partial : history.projects,
    mode = history?.mode ?? draft.gitHistory.mode,
    totals = useMemo(() => gitTotals(projects, mode), [projects, mode]),
    current = projects.find((p) => p.projectId === chosen) ?? projects[0];
  const outdated = historyInputs(draft) !== historyInputs(state.settings);
  const g = draft.gitHistory,
    custom = !PRESETS.includes(g.days);
  const kind = outdated && !running ? "outdated" : !projects.length ? "none" : "data";
  /* The custom-days field slides in; the result area rises when its kind changes; the files panel slides on a new repository. */
  const customRef = useRef<HTMLLabelElement>(null),
    filesRef = useRef<HTMLDivElement>(null),
    lastCustom = useRef(custom),
    lastShown = useRef(current?.projectId ?? "");
  useLayoutEffect(() => {
    if (lastCustom.current === custom) return;
    lastCustom.current = custom;
    if (custom) play(customRef.current, [{ opacity: 0, transform: "translateX(-10px)" }, { opacity: 1, transform: "none" }], { duration: 220 });
  }, [custom]);
  useLayoutEffect(() => {
    const id = current?.projectId ?? "";
    if (lastShown.current === id) return;
    lastShown.current = id;
    enter(filesRef.current, { x: 12, y: 0, dur: 240 });
  }, [current?.projectId]);
  const tiles: TileItem[] = [
    { label: "Added", value: totals.added, fmt: tileNumber, title: number(totals.added), tone: totals.added ? "success" : undefined, icon: "plus" },
    { label: "Deleted", value: totals.deleted, fmt: tileNumber, title: number(totals.deleted), tone: totals.deleted ? "danger" : undefined, icon: "min" },
    { label: "Modified · est.", value: totals.modifiedEstimate, fmt: tileNumber, title: number(totals.modifiedEstimate), icon: "refresh" },
    { label: "Net lines", value: totals.net, fmt: signed, tone: !totals.net ? undefined : totals.net > 0 ? "success" : "danger", icon: "lines" },
    { label: "Changed files", value: totals.changedFiles, detail: `${number(totals.binaryFiles)} binary`, icon: "files" },
    totals.commits === null
      ? {
          label: "Commits",
          text: "—",
          detail: totals.incompleteProjects ? `${totals.incompleteProjects} incomplete / unavailable` : "All repositories complete",
          icon: "branch",
          tip: "Commits are counted in Activity mode only",
        }
      : {
          label: "Commits",
          value: totals.commits,
          detail: totals.incompleteProjects ? `${totals.incompleteProjects} incomplete / unavailable` : "All repositories complete",
          icon: "branch",
        },
  ];
  const settled = !!history && !busy;
  return (
    <>
      <div className="toolbar section-toolbar align-end wrap">
        <Field label="Period">
          <Seg<number | "custom">
            label="History period"
            role="radiogroup"
            value={custom ? "custom" : g.days}
            disabled={!!busy}
            options={[...PRESETS.map((n) => ({ value: n as number | "custom", label: n + " days" })), { value: "custom", label: "Custom" }]}
            onChange={(v) =>
              change((s) => {
                s.gitHistory.days = v === "custom" ? 90 : v;
              })
            }
          />
        </Field>
        <label ref={customRef} className="field field-inline" hidden={!custom}>
          <span className="field-label">Custom days (1–36500)</span>
          <input
            type="number"
            min={1}
            max={36500}
            aria-label="Custom history days"
            disabled={!!busy}
            value={g.days}
            onChange={(e) =>
              change((s) => {
                s.gitHistory.days = Math.min(36500, Math.max(1, Math.round(Number(e.target.value)) || 1));
              })
            }
          />
        </label>
        <Field label="Mode">
          <Seg
            label="History mode"
            role="radiogroup"
            value={g.mode}
            disabled={!!busy}
            options={[
              { value: "Activity", label: "Activity", tip: "Everything committed in the period" },
              { value: "NetChange", label: modeLabel("NetChange"), tip: "Start of the period compared with now" },
            ]}
            onChange={(v) =>
              change((s) => {
                s.gitHistory.mode = v;
              })
            }
          />
        </Field>
        <Button label="Refresh history" primary icon="refresh" disabled={!!busy || !draft.projects.some((p) => p.isEnabled)} onClick={() => void execute("history")} />
        <span className="spacer" />
        {history && !outdated && !busy && (
          <div className="toolbar">
            <Button label="Export CSV" icon="download" onClick={() => void exportData("history", "csv")} />
            <Button label="JSON" onClick={() => void exportData("history", "json")} />
          </div>
        )}
      </div>
      <Notice kind="info">
        Modified estimates overlap added/deleted lines. Net = added − deleted. Only committed first-parent history is counted. No repository is changed or fetched.
      </Notice>
      <SwapIn key={kind} className="stack" dir={0} y={8} dur={260}>
        {kind === "outdated" ? (
          <Notice extra={<Button label="Refresh history" small icon="refresh" disabled={!!busy} onClick={() => void execute("history")} />}>
            Options or project details changed. Refresh to analyze this configuration.
          </Notice>
        ) : kind === "none" ? (
          running ? (
            <p className="muted">Reading repositories… totals appear as each project finishes.</p>
          ) : (
            <Empty art="timeline" title="No history yet" text="No history yet. Choose a period and refresh to analyze committed changes." className="empty-sm" />
          )
        ) : (
          <>
            <Tiles items={tiles} id="git" className="tiles-6" />
            <p className={"muted range-caption" + (settled ? "" : " is-partial")}>
              {settled && history
                ? `${dateTime(history.start)} → ${dateTime(history.end)} · ${modeLabel(history.mode)} · ${scopeLabel(history.scope)}`
                : `Partial totals · ${projects.length} ${projects.length === 1 ? "project" : "projects"} processed. Refresh before exporting.`}
            </p>
            <Split
              id="git"
              initial={0.56}
              label="Resize repositories and changed files"
              left={
                <Panel title="Repositories" subtitle="Select a repository to see its changed files">
                  <DataTable
                    label="History project results"
                    rows={projects}
                    rowKey={(p) => p.projectId}
                    columns={repoColumns}
                    onSelect={(p) => setChosen(p.projectId)}
                    selected={(p) => p.projectId === current?.projectId}
                  />
                </Panel>
              }
              right={
                <div ref={filesRef} className="split-fill">
                  <Panel title={current ? current.projectName + " · changed files" : "Changed files"} subtitle="Files changed in the selected repository">
                    <DataTable label="Git changed files" rows={current?.files ?? []} rowKey={(f) => f.path} columns={fileColumns} />
                  </Panel>
                </div>
              }
            />
          </>
        )}
      </SwapIn>
    </>
  );
}

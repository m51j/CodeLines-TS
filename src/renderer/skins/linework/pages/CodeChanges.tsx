/**
 * Code changes: period, custom days and mode, Refresh history and exports; notices; six
 * tiles; the range caption; repositories (branch, short HEAD, status pill, net Δ and a
 * churn bar) filling in project by project while a refresh runs; and the changed files
 * of the selected repository.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GitFile, GitProject } from "../../../../shared/contracts";
import { gitTotals } from "../../../../domain/history";
import { play } from "../../../motion/core";
import { historyInputs, useWorkspace } from "../../../workspace";
import { Icon } from "../icons";
import { Field, Notice, Select, Sheet, Tiles } from "../ui/controls";
import { date, modeLabel, number, plural, scopeLabel, signed } from "../ui/fmt";
import { Delta, Table, type Col } from "../ui/Table";

const presets = [7, 30, 365];
const fileCols: Col<GitFile>[] = [
  { key: "path", label: "Path", value: (r) => r.path, path: true },
  { key: "added", label: "Added", value: (r) => r.added },
  { key: "deleted", label: "Deleted", value: (r) => r.deleted },
  { key: "modifiedEstimate", label: "Modified est.", value: (r) => r.modifiedEstimate },
  { key: "net", label: "Net", value: (r) => r.net, render: (r) => <Delta v={r.net} text={signed(r.net)} /> },
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
  const custom = !presets.includes(draft.gitHistory.days);
  const maxChurn = Math.max(1, ...projects.map((p) => Math.max(p.added, p.deleted)));
  const repoCols = useMemo<Col<GitProject>[]>(
    () => [
      { key: "projectName", label: "Project", value: (r) => r.projectName, path: true },
      {
        key: "branch",
        label: "Branch",
        value: (r) => r.branch,
        render: (r) =>
          r.branch && r.branch !== "—" ? (
            <span className="branch">
              <Icon name="branch" />
              {r.branch}
            </span>
          ) : (
            "—"
          ),
      },
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
        render: (r) => (
          <span className={"pill " + (r.status === "Complete" ? "pill-loaded" : /^Unavailable|fail/i.test(r.status) ? "pill-failed" : "pill-warn")}>
            {r.status}
          </span>
        ),
      },
      { key: "added", label: "Added", value: (r) => r.added },
      { key: "deleted", label: "Deleted", value: (r) => r.deleted },
      { key: "modifiedEstimate", label: "Modified est.", value: (r) => r.modifiedEstimate },
      { key: "net", label: "Net", value: (r) => r.net, render: (r) => <Delta v={r.net} text={signed(r.net)} /> },
      { key: "commits", label: "Commits", value: (r) => r.commits },
      {
        key: "churn",
        label: "Churn",
        num: false,
        title: "Added (right) vs deleted (left)",
        value: (r) => r.added + r.deleted,
        render: (r) => (
          <span
            className="churn"
            tabIndex={0}
            data-tip-t={r.projectName}
            data-tip={`Added: ${number(r.added)} · Deleted: ${number(r.deleted)} · Net: ${signed(r.net)}`}
          >
            <i className="del" style={{ ["--w" as string]: ((r.deleted / maxChurn) * 100).toFixed(1) + "%" }} />
            <i className="add" style={{ ["--w" as string]: ((r.added / maxChurn) * 100).toFixed(1) + "%" }} />
          </span>
        ),
      },
    ],
    [maxChurn],
  );
  const filesSheet = useRef<HTMLElement>(null),
    shownFor = useRef(current?.projectId);
  useLayoutEffect(() => {
    if (shownFor.current === current?.projectId) return;
    shownFor.current = current?.projectId;
    play(filesSheet.current, [{ opacity: 0.4 }, { opacity: 1 }], { duration: 200 });
  }, [current?.projectId]);

  return (
    <>
      <div className="toolbar section-toolbar align-end">
        <Field label="Period">
          <Select
            aria-label="History period"
            disabled={!!busy}
            value={custom ? "custom" : String(draft.gitHistory.days)}
            onChange={(v) =>
              change((s) => {
                s.gitHistory.days = v === "custom" ? 90 : Number(v);
              })
            }
            options={[...presets.map((n) => ({ value: String(n), label: `${n} days` })), { value: "custom", label: "Custom" }]}
          />
        </Field>
        {custom && (
          <Field label="Custom days (1–36500)">
            <input
              className="input num-input"
              aria-label="Custom history days"
              type="number"
              min={1}
              max={36500}
              disabled={!!busy}
              value={draft.gitHistory.days}
              onChange={(e) =>
                change((s) => {
                  s.gitHistory.days = Math.min(36500, Math.max(1, Math.round(Number(e.target.value)) || 1));
                })
              }
            />
          </Field>
        )}
        <Field label="Mode">
          <Select
            aria-label="History mode"
            disabled={!!busy}
            value={draft.gitHistory.mode}
            onChange={(v) =>
              change((s) => {
                s.gitHistory.mode = v;
              })
            }
            options={[
              { value: "Activity", label: "Activity" },
              { value: "NetChange", label: modeLabel("NetChange") },
            ]}
          />
        </Field>
        <button
          className="btn primary"
          type="button"
          disabled={!!busy || !draft.projects.some((p) => p.isEnabled)}
          onClick={() => void execute("history")}
        >
          {running ? <span className="spin" aria-hidden="true" /> : <Icon name="refresh" />}
          Refresh history
        </button>
        <span className="spacer" />
        {history && !outdated && !busy && (
          <>
            <button className="btn" type="button" onClick={() => void exportData("history", "csv")}>
              <Icon name="download" />
              Export CSV
            </button>
            <button className="btn" type="button" onClick={() => void exportData("history", "json")}>
              JSON
            </button>
          </>
        )}
      </div>
      <Notice kind="info">
        Modified estimates overlap added/deleted lines. Net = added − deleted. Only committed first-parent history is counted. No repository
        is changed or fetched.
      </Notice>
      {outdated ? (
        <Notice
          extra={
            <button
              className="btn sm"
              type="button"
              disabled={!!busy || !draft.projects.some((p) => p.isEnabled)}
              onClick={() => void execute("history")}
            >
              <Icon name="refresh" />
              Refresh now
            </button>
          }
        >
          Options or project details changed. Refresh to analyze this configuration.
        </Notice>
      ) : !projects.length ? (
        <p className="muted pad">No history yet. Choose a period and refresh to analyze committed changes.</p>
      ) : (
        <>
          <Tiles
            prefix="history"
            items={[
              { id: "added", label: "Added", value: totals.added, title: number(totals.added), tone: totals.added ? "success" : "" },
              { id: "deleted", label: "Deleted", value: totals.deleted, title: number(totals.deleted), tone: totals.deleted ? "danger" : "" },
              { id: "mod", label: "Modified · est.", value: totals.modifiedEstimate, title: number(totals.modifiedEstimate) },
              { id: "net", label: "Net lines", value: totals.net, fmt: signed, tone: totals.net > 0 ? "success" : totals.net < 0 ? "danger" : "" },
              { id: "files", label: "Changed files", value: totals.changedFiles, fmt: number, detail: `${number(totals.binaryFiles)} binary` },
              {
                id: "commits",
                label: "Commits",
                value: totals.commits,
                fmt: number,
                detail: totals.incompleteProjects ? `${totals.incompleteProjects} incomplete / unavailable` : "All repositories complete",
              },
            ]}
          />
          <p className="range-caption">
            <Icon name="clock" />
            {history && !busy
              ? `${date(history.start)} → ${date(history.end)} · ${modeLabel(history.mode)} · ${scopeLabel(history.scope)}`
              : `Partial totals · ${plural(projects.length, "project")} processed. Refresh before exporting.`}
          </p>
          <Sheet title="Repositories" sub="Select a repository to list its changed files">
            <Table
              label="History project results"
              rows={projects}
              rowKey={(p) => p.projectId}
              onSelect={(p) => setChosen(p.projectId)}
              isSelected={(p) => p.projectId === current?.projectId}
              columns={repoCols}
            />
          </Sheet>
          {current && (
            <section className="sheet" ref={filesSheet}>
              <header className="sheet-head">
                <div>
                  <h2>{current.projectName} · changed files</h2>
                </div>
              </header>
              <div className="sheet-body">
                <Table key={current.projectId} label="Git changed files" rows={current.files} rowKey={(f) => f.path} columns={fileCols} />
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

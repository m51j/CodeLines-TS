import { useMemo, useState } from "react";
import { RefreshCw, Download } from "lucide-react";
import { Card, Field, Table, Tiles, deltaTone } from "../components";
import { modeLabel, number, scopeLabel, signed, tileNumber } from "../format";
import { gitTotals } from "../../domain/history";
import { historyInputs, useWorkspace } from "../workspace";
import { historyFileColumns, historyProjectColumns } from "./columns";
import { Select } from "../ui/Select";
const presets = [7, 30, 365];
export function CodeChanges() {
  const { state, draft, busy, partial, change, execute, exportData } =
    useWorkspace();
  const [chosen, setChosen] = useState("");
  const history = state.settings.lastGitHistory,
    running = busy?.kind === "history",
    projects = running || !history ? partial : history.projects,
    mode = history?.mode ?? draft.gitHistory.mode,
    totals = useMemo(() => gitTotals(projects, mode), [projects, mode]),
    current = projects.find((p) => p.projectId === chosen) ?? projects[0];
  const draftInputs = historyInputs(draft),
    savedInputs = historyInputs(state.settings),
    outdated = draftInputs !== savedInputs;
  return (
    <>
      <div className="toolbar section-toolbar align-end">
        <Field label="Period">
          <Select
            aria-label="History period"
            disabled={!!busy}
            value={
              presets.includes(draft.gitHistory.days)
                ? String(draft.gitHistory.days)
                : "custom"
            }
            onChange={(v) =>
              change((s) => {
                s.gitHistory.days = v === "custom" ? 90 : Number(v);
              })
            }
            options={[
              ...presets.map((n) => ({ value: String(n), label: `${n} days` })),
              { value: "custom", label: "Custom" },
            ]}
          />
        </Field>
        {!presets.includes(draft.gitHistory.days) && (
          <Field label="Custom days (1–36500)">
            <input
              aria-label="Custom history days"
              type="number"
              min={1}
              max={36500}
              disabled={!!busy}
              value={draft.gitHistory.days}
              onChange={(e) =>
                change((s) => {
                  s.gitHistory.days = Math.min(
                    36500,
                    Math.max(1, Math.round(Number(e.target.value)) || 1),
                  );
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
          className="primary"
          disabled={!!busy || !draft.projects.some((p) => p.isEnabled)}
          onClick={() => void execute("history")}
        >
          <RefreshCw size={15} />
          Refresh history
        </button>
        <div className="spacer" />
        {history && !outdated && !busy && (
          <>
            <button onClick={() => void exportData("history", "csv")}>
              <Download size={15} />
              Export CSV
            </button>
            <button onClick={() => void exportData("history", "json")}>
              JSON
            </button>
          </>
        )}
      </div>
      <p className="notice info">
        Modified estimates overlap added/deleted lines. Net = added − deleted.
        Only committed first-parent history is counted. No repository is changed
        or fetched.
      </p>
      {outdated ? (
        <p className="notice">
          Options or project details changed. Refresh to analyze this
          configuration.
        </p>
      ) : !projects.length ? (
        <p className="muted">
          No history yet. Choose a period and refresh to analyze committed
          changes.
        </p>
      ) : (
        <>
          <Tiles
            items={[
              {
                label: "Added",
                value: tileNumber(totals.added),
                title: number(totals.added),
                tone: totals.added ? "success" : undefined,
              },
              {
                label: "Deleted",
                value: tileNumber(totals.deleted),
                title: number(totals.deleted),
                tone: totals.deleted ? "danger" : undefined,
              },
              {
                label: "Modified · est.",
                value: tileNumber(totals.modifiedEstimate),
                title: number(totals.modifiedEstimate),
              },
              {
                label: "Net lines",
                value: signed(totals.net),
                tone: deltaTone(totals.net),
              },
              {
                label: "Changed files",
                value: number(totals.changedFiles),
                detail: `${number(totals.binaryFiles)} binary`,
              },
              {
                label: "Commits",
                value: number(totals.commits),
                detail: totals.incompleteProjects
                  ? `${totals.incompleteProjects} incomplete / unavailable`
                  : "All repositories complete",
              },
            ]}
          />
          <p className="muted">
            {history && !busy
              ? `${new Date(history.start).toLocaleString()} → ${new Date(history.end).toLocaleString()} · ${modeLabel(history.mode)} · ${scopeLabel(history.scope)}`
              : `Partial totals · ${projects.length} ${projects.length === 1 ? "project" : "projects"} processed. Refresh before exporting.`}
          </p>
          <Card title="Repositories">
            <Table
              label="History project results"
              rows={projects}
              rowKey={(p) => p.projectId}
              onSelect={(p) => setChosen(p.projectId)}
              selected={(p) => p.projectId === current?.projectId}
              columns={historyProjectColumns}
            />
          </Card>
          {current && (
            <Card title={current.projectName + " · changed files"}>
              <Table
                label="Git changed files"
                rows={current.files}
                rowKey={(f) => f.path}
                columns={historyFileColumns}
              />
            </Card>
          )}
        </>
      )}
    </>
  );
}

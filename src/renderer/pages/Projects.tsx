import { useMemo, useState } from "react";
import { Download, Play, Plus } from "lucide-react";
import { Card, Empty, Field, LinesInput } from "../components";
import { money, number } from "../format";
import { matchProjects } from "../../domain/daily";
import { useWorkspace } from "../workspace";
export function Projects() {
  const { state, draft, busy, dirty, change, execute, save, saveThen, exportData } =
    useWorkspace();
  const [confirming, setConfirming] = useState("");
  const sessions = state.ai?.combined?.sessions,
    projects = draft.projects;
  const usage = useMemo(() => {
    if (!sessions) return { all: [], recent: [] };
    const cut = Date.now() - 30 * 86400000;
    return {
      all: matchProjects(sessions, projects),
      recent: matchProjects(
        sessions.filter((s) => s[2] >= cut),
        projects,
      ),
    };
  }, [sessions, projects]);
  return (
    <>
      <div className="toolbar section-toolbar">
        <div>
          <h2>Project sources</h2>
          <p className="muted">
            {projects.length} {projects.length === 1 ? "folder" : "folders"} ·
            edit names, paths, and exclusions below
          </p>
        </div>
        <div className="spacer" />
        <button
          disabled={!!busy}
          onClick={() =>
            void saveThen(
              () => window.codelines.importProjects(),
              "Project list imported",
            )
          }
        >
          Import…
        </button>
        <button
          disabled={!!busy || !projects.length}
          onClick={() => void exportData("projects", "json")}
        >
          <Download size={15} />
          Export
        </button>
        <button
          className="primary"
          disabled={!!busy}
          onClick={() =>
            void saveThen(() => window.codelines.addProject(), "Project added")
          }
        >
          <Plus size={15} />
          Add project
        </button>
      </div>
      {!projects.length ? (
        <Empty title="A home for your projects">
          Choose a local folder with the native folder picker. CodeLines reads
          it when you scan.
        </Empty>
      ) : (
        <div className="project-list">
          {projects.map((p, i) => {
            const u = usage.all.find((u) => u.projectId === p.id),
              r = usage.recent.find((u) => u.projectId === p.id);
            return (
              <Card key={p.id} className={p.isEnabled ? "" : "is-disabled"}>
                <div className="project-editor">
                  <label className="check">
                    <input
                      type="checkbox"
                      aria-label={"Enable " + p.name}
                      checked={p.isEnabled}
                      disabled={!!busy}
                      onChange={(e) =>
                        change((s) => {
                          s.projects[i].isEnabled = e.target.checked;
                        })
                      }
                    />
                    Enabled
                  </label>
                  <Field label="Project name">
                    <input
                      value={p.name}
                      title={p.name}
                      disabled={!!busy}
                      onChange={(e) =>
                        change((s) => {
                          s.projects[i].name = e.target.value;
                        })
                      }
                    />
                  </Field>
                  <Field label="Root path">
                    <input
                      className="mono"
                      value={p.rootPath}
                      title={p.rootPath}
                      disabled={!!busy}
                      onChange={(e) =>
                        change((s) => {
                          s.projects[i].rootPath = e.target.value;
                        })
                      }
                    />
                  </Field>
                  <div className="toolbar wrap project-actions">
                    {confirming === p.id ? (
                      <>
                        <button onClick={() => setConfirming("")}>Keep</button>
                        <button
                          className="danger-button"
                          disabled={!!busy}
                          onClick={() => {
                            setConfirming("");
                            change((s) => {
                              s.projects = s.projects.filter(
                                (x) => x.id !== p.id,
                              );
                            });
                          }}
                        >
                          Confirm remove
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          disabled={!!busy}
                          onClick={() => void execute("scan", p.id)}
                        >
                          <Play size={14} />
                          Scan
                        </button>
                        <button
                          className="danger-button"
                          disabled={!!busy}
                          onClick={() => setConfirming(p.id)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="project-usage">
                  <span>
                    AI tokens · 30d <strong>{number(r?.tokens)}</strong>
                  </span>
                  <span>
                    AI tokens · all time <strong>{number(u?.tokens)}</strong>
                  </span>
                  <span>
                    API equivalent{" "}
                    <strong>
                      {!u || !u.sessions || (u.cost === 0 && u.costPartial)
                        ? "—"
                        : money(u.cost, u.costPartial)}
                    </strong>
                  </span>
                  <span>
                    {number(u?.sessions ?? 0)}{" "}
                    {u?.sessions === 1 ? "session" : "sessions"}
                  </span>
                </div>
                <details>
                  <summary>
                    Project exclusions
                    {p.excludePatterns.length
                      ? ` · ${p.excludePatterns.length}`
                      : ""}
                  </summary>
                  <Field
                    label="Patterns (one per line)"
                    help="Applied after global patterns and repository .gitignore rules."
                  >
                    <LinesInput
                      className="mono"
                      disabled={!!busy}
                      value={p.excludePatterns}
                      onChange={(lines) =>
                        change((s) => {
                          s.projects[i].excludePatterns = lines;
                        })
                      }
                    />
                  </Field>
                </details>
              </Card>
            );
          })}
        </div>
      )}
      {projects.length > 0 && (
        <div className="toolbar wrap sticky-actions">
          <button
            className="primary"
            disabled={!!busy || !dirty}
            onClick={() => void save()}
          >
            Save project changes
          </button>
          <span className="muted">
            {dirty
              ? "You have unsaved changes. Starting a scan also saves them."
              : "All project changes are saved."}
          </span>
        </div>
      )}
    </>
  );
}

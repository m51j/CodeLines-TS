import { useMemo, useState } from "react";
import { Download, Play, Plus } from "lucide-react";
import { Card, Empty, Field, LinesInput } from "../components";
import { money, number } from "../format";
import { matchProjects } from "../../domain/daily";
import type { Project } from "../../shared/contracts";
import { useWorkspace } from "../workspace";
export function Projects() {
  const {
    state,
    draft,
    busy,
    dirty,
    change,
    execute,
    save,
    saveThen,
    exportData,
  } = useWorkspace();
  const [confirming, setConfirming] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const sessions = state.ai?.combined?.sessions,
    projects = draft.projects,
    selected = projects.find((p) => p.id === selectedId) ?? projects[0];
  const updateProject = (id: string, edits: Partial<Omit<Project, "id">>) =>
    change((s) => {
      const project = s.projects.find((p) => p.id === id);
      if (project) Object.assign(project, edits);
    });
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
            enable, rename, or add folders to the workspace
          </p>
        </div>
        <div className="spacer" />
        <div className="toolbar wrap">
          <button
            disabled={!!busy || !selected}
            onClick={() => selected && void execute("scan", selected.id)}
          >
            <Play size={15} />
            Scan selected
          </button>
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
              void saveThen(async () => {
                const next = await window.codelines.addProject();
                const added = next.settings.projects.find(
                  (p) => !projects.some((old) => old.id === p.id),
                );
                if (added) setSelectedId(added.id);
                return next;
              }, "Project added")
            }
          >
            <Plus size={15} />
            Add project
          </button>
        </div>
      </div>
      {!projects.length ? (
        <Empty title="A home for your projects">
          Choose a local folder with the native folder picker. CodeLines reads
          it when you scan.
        </Empty>
      ) : (
        <>
          <Card className="projects-table-card">
            <div
              className="table-scroll projects-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Project sources"
            >
              <table className="projects-table" aria-label="Projects">
                <colgroup>
                  <col className="project-enabled-column" />
                  <col className="project-name-column" />
                  <col />
                  <col className="project-tokens-column" />
                  <col className="project-tokens-column" />
                  <col className="project-cost-column" />
                  <col className="project-remove-column" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Enabled</th>
                    <th scope="col">Name</th>
                    <th scope="col">Root path</th>
                    <th scope="col" className="numeric-column">
                      AI tokens · 30d
                    </th>
                    <th scope="col" className="numeric-column">
                      AI tokens
                    </th>
                    <th scope="col" className="numeric-column">
                      AI cost
                    </th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const u = usage.all.find((u) => u.projectId === p.id),
                      r = usage.recent.find((u) => u.projectId === p.id);
                    return (
                      <tr
                        key={p.id}
                        className={[
                          selected?.id === p.id ? "selected" : "",
                          p.isEnabled ? "" : "project-row-disabled",
                        ].join(" ")}
                        aria-selected={selected?.id === p.id}
                        tabIndex={0}
                        onClick={() => setSelectedId(p.id)}
                        onFocusCapture={() => setSelectedId(p.id)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(p.id);
                          }
                        }}
                      >
                        <td className="project-enabled-cell">
                          <input
                            type="checkbox"
                            aria-label={"Enable " + p.name}
                            checked={p.isEnabled}
                            disabled={!!busy}
                            onChange={(e) =>
                              updateProject(p.id, {
                                isEnabled: e.target.checked,
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={"Project name for " + p.name}
                            value={p.name}
                            title={p.name}
                            disabled={!!busy}
                            onChange={(e) =>
                              updateProject(p.id, { name: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="mono"
                            aria-label={"Root path for " + p.name}
                            value={p.rootPath}
                            title={p.rootPath}
                            disabled={!!busy}
                            onChange={(e) =>
                              updateProject(p.id, { rootPath: e.target.value })
                            }
                          />
                        </td>
                        <td className="numeric-column">{number(r?.tokens)}</td>
                        <td className="numeric-column">{number(u?.tokens)}</td>
                        <td className="numeric-column" title="API equivalent">
                          {!u || !u.sessions || (u.cost === 0 && u.costPartial)
                            ? "—"
                            : money(u.cost, u.costPartial)}
                        </td>
                        <td className="project-remove-cell">
                          {confirming === p.id ? (
                            <div className="toolbar wrap">
                              <button
                                disabled={!!busy}
                                onClick={() => setConfirming("")}
                              >
                                Keep
                              </button>
                              <button
                                className="danger-button"
                                disabled={!!busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirming("");
                                  if (selected?.id === p.id)
                                    setSelectedId(
                                      projects.find((x) => x.id !== p.id)?.id ??
                                        "",
                                    );
                                  change((s) => {
                                    s.projects = s.projects.filter(
                                      (x) => x.id !== p.id,
                                    );
                                  });
                                }}
                              >
                                Confirm remove
                              </button>
                            </div>
                          ) : (
                            <button
                              className="danger-button"
                              aria-label={"Remove " + p.name}
                              disabled={!!busy}
                              onClick={() => setConfirming(p.id)}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          {selected && (
            <Card className="project-exclusions">
              <div>
                <h2>Project exclusions</h2>
                <p className="muted">
                  One .gitignore-style pattern per line. Applied after global
                  patterns and repository .gitignore rules.
                </p>
              </div>
              <Field label={"Patterns for " + selected.name}>
                <LinesInput
                  key={selected.id}
                  className="mono"
                  rows={4}
                  disabled={!!busy}
                  value={selected.excludePatterns}
                  onChange={(lines) =>
                    updateProject(selected.id, { excludePatterns: lines })
                  }
                />
              </Field>
            </Card>
          )}
        </>
      )}
      {(projects.length > 0 || dirty) && (
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

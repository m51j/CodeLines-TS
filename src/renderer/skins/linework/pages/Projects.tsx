/**
 * Projects: the project sources table (switch, inline name and path, AI token share bars,
 * inline remove confirmation; a confirmed row slides out), the exclusions panel docked
 * beside it (it moves when the selection changes) and a sticky save bar.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { matchProjects } from "../../../../domain/daily";
import type { Project } from "../../../../shared/contracts";
import { play, reduced } from "../../../motion/core";
import { useWorkspace } from "../../../workspace";
import { useShell } from "../context";
import { Icon } from "../icons";
import { EmptyState, Field, LinesInput } from "../ui/controls";
import { money, number, plural } from "../ui/fmt";

export function Projects() {
  const { state, draft, busy, dirty, change, execute, save, saveThen, exportData } = useWorkspace();
  const { projectSel, setProjectSel } = useShell();
  const [confirming, setConfirming] = useState(""),
    [leaving, setLeaving] = useState("");
  const projects = draft.projects,
    selected = projects.find((p) => p.id === projectSel) ?? projects[0];
  const sessions = state.ai?.combined?.sessions;
  const usage = useMemo(() => {
    if (!sessions) return { all: new Map<string, ReturnType<typeof matchProjects>[number]>(), recent: new Map<string, ReturnType<typeof matchProjects>[number]>() };
    const cut = Date.now() - 30 * 86400000;
    return {
      all: new Map(matchProjects(sessions, projects).map((u) => [u.projectId, u])),
      recent: new Map(matchProjects(sessions.filter((s) => s[2] >= cut), projects).map((u) => [u.projectId, u])),
    };
  }, [sessions, projects]);
  const maxTok = Math.max(1, ...[...usage.all.values()].map((u) => u.tokens));
  const update = (id: string, edits: Partial<Omit<Project, "id">>) =>
    change((s) => {
      const p = s.projects.find((x) => x.id === id);
      if (p) Object.assign(p, edits);
    });
  const remove = (id: string) => {
    const finish = () => {
      setConfirming("");
      setLeaving("");
      if (selected?.id === id) setProjectSel(projects.find((x) => x.id !== id)?.id ?? "");
      change((s) => {
        s.projects = s.projects.filter((x) => x.id !== id);
      });
    };
    if (reduced()) return finish();
    setLeaving(id);
    setTimeout(finish, 260);
  };

  // The exclusions panel moves when another project is picked.
  const exclBody = useRef<HTMLDivElement>(null),
    shownFor = useRef(selected?.id);
  useLayoutEffect(() => {
    if (shownFor.current === selected?.id) return;
    shownFor.current = selected?.id;
    play(exclBody.current, [{ opacity: 0.2, transform: "translateX(8px)" }, { opacity: 1, transform: "none" }], { duration: 220 });
  }, [selected?.id]);

  return (
    <>
      <div className="section-bar">
        <div>
          <h2>Project sources</h2>
          <p className="muted">{plural(projects.length, "folder")} · enable, rename, or add folders to the workspace</p>
        </div>
        <span className="spacer" />
        <div className="toolbar">
          <button className="btn" type="button" disabled={!!busy || !selected} onClick={() => selected && void execute("scan", selected.id)}>
            <Icon name="play" />
            Scan selected
          </button>
          <button
            className="btn"
            type="button"
            disabled={!!busy}
            onClick={() => void saveThen(() => window.codelines.importProjects(), "Project list imported")}
          >
            <Icon name="upload" />
            Import…
          </button>
          <button className="btn" type="button" disabled={!!busy || !projects.length} onClick={() => void exportData("projects", "json")}>
            <Icon name="download" />
            Export
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={!!busy}
            onClick={() =>
              void saveThen(async () => {
                const next = await window.codelines.addProject();
                const added = next.settings.projects.find((p) => !projects.some((old) => old.id === p.id));
                if (added) setProjectSel(added.id);
                return next;
              }, "Project added")
            }
          >
            <Icon name="plus" />
            Add project
          </button>
        </div>
      </div>
      {!projects.length ? (
        <EmptyState title="A home for your projects">
          Choose a local folder with the native folder picker. CodeLines reads it when you scan.
        </EmptyState>
      ) : (
        <div className="projects-layout">
          <section className="sheet projects-sheet">
            <div className="table-scroll projects-scroll" tabIndex={0} role="region" aria-label="Project sources">
              <table className="projects-table" aria-label="Projects">
                <colgroup>
                  <col className="c-en" />
                  <col className="c-name" />
                  <col />
                  <col className="c-tok" />
                  <col className="c-tok2" />
                  <col className="c-cost" />
                  <col className="c-act" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Enabled</th>
                    <th scope="col">Name</th>
                    <th scope="col">Root path</th>
                    <th scope="col" className="num">
                      AI tokens · 30d
                    </th>
                    <th scope="col" className="num">
                      AI tokens
                    </th>
                    <th scope="col" className="num">
                      AI cost
                    </th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const a = usage.all.get(p.id),
                      r = usage.recent.get(p.id),
                      conf = confirming === p.id,
                      on = selected?.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        tabIndex={0}
                        aria-selected={on}
                        className={[on ? "selected" : "", p.isEnabled ? "" : "is-disabled", conf ? "confirming" : "", leaving === p.id ? "leaving" : ""].join(" ")}
                        onClick={(e) => {
                          if (!(e.target as Element).closest("input, button")) setProjectSel(p.id);
                        }}
                        onFocusCapture={() => setProjectSel(p.id)}
                        onKeyDown={(e) => {
                          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            setProjectSel(p.id);
                          }
                        }}
                      >
                        <td className="c-en">
                          <label className="switch" title={p.isEnabled ? "Enabled" : "Disabled"}>
                            <input
                              type="checkbox"
                              aria-label={"Enable " + p.name}
                              checked={p.isEnabled}
                              disabled={!!busy}
                              onChange={(e) => update(p.id, { isEnabled: e.target.checked })}
                            />
                            <span aria-hidden="true" />
                          </label>
                        </td>
                        <td>
                          <input
                            className="cell-input"
                            aria-label={"Project name for " + p.name}
                            value={p.name}
                            title={p.name}
                            disabled={!!busy}
                            onChange={(e) => update(p.id, { name: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="cell-input mono"
                            aria-label={"Root path for " + p.name}
                            value={p.rootPath}
                            title={p.rootPath}
                            disabled={!!busy}
                            onChange={(e) => update(p.id, { rootPath: e.target.value })}
                          />
                        </td>
                        <td className="num">{number(r?.tokens)}</td>
                        <td className="num">
                          <span className="tok-cell">
                            {number(a?.tokens)}
                            {a && <i style={{ ["--w" as string]: ((a.tokens / maxTok) * 100).toFixed(1) + "%" }} />}
                          </span>
                        </td>
                        <td className="num" title="API equivalent">
                          {!a || !a.sessions || (a.cost === 0 && a.costPartial) ? "—" : money(a.cost, a.costPartial)}
                        </td>
                        <td className="c-act">
                          {conf ? (
                            <div className="confirm-pair">
                              <button type="button" className="btn sm" disabled={!!busy} onClick={() => setConfirming("")}>
                                Keep
                              </button>
                              <button
                                type="button"
                                className="btn sm danger solid"
                                disabled={!!busy || leaving === p.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  remove(p.id);
                                }}
                              >
                                <Icon name="trash" />
                                Confirm remove
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn sm danger"
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
          </section>
          {selected && (
            <aside className="sheet exclusions" aria-labelledby="lw-excl-h">
              <header className="sheet-head">
                <div>
                  <h2 id="lw-excl-h">Project exclusions</h2>
                  <p>One .gitignore-style pattern per line. Applied after global patterns and repository .gitignore rules.</p>
                </div>
              </header>
              <div className="sheet-body" ref={exclBody}>
                <div className="excl-target">
                  <Icon name="folder" />
                  <div>
                    <b>{selected.name}</b>
                    <span className="mono">{selected.rootPath}</span>
                  </div>
                </div>
                <Field label={"Patterns for " + selected.name}>
                  <LinesInput
                    key={selected.id}
                    className="mono"
                    rows={7}
                    disabled={!!busy}
                    value={selected.excludePatterns}
                    onChange={(lines) => update(selected.id, { excludePatterns: lines })}
                  />
                </Field>
                <p className="muted small">
                  {plural(selected.excludePatterns.length, "pattern")} · global rules → .gitignore → these
                </p>
              </div>
            </aside>
          )}
        </div>
      )}
      {(projects.length > 0 || dirty) && (
        <div className="save-bar">
          <button className="btn primary" type="button" disabled={!!busy || !dirty} onClick={() => void save()}>
            Save project changes
          </button>
          <span className={"save-msg" + (dirty ? " dirty" : "")}>
            {dirty ? "You have unsaved changes. Starting a scan also saves them." : "All project changes are saved."}
          </span>
        </div>
      )}
    </>
  );
}

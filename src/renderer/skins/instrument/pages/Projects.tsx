/** Projects: the project list (master) and the selected project's exclusions and facts (detail). */
import { useMemo, useRef, useState } from "react";
import type { Project } from "../../../../shared/contracts";
import { matchProjects } from "../../../../domain/daily";
import { compact, money, number } from "../../../format";
import { play } from "../../../motion/core";
import { useWorkspace } from "../../../workspace";
import { memo } from "../context";
import { Icon } from "../icons";
import { Button, Check, LinesInput } from "../ui/controls";
import { Empty, Split, SwapIn } from "../ui/layout";
import { toast } from "../ui/overlays";
import { DataTable, type Column } from "../ui/Table";
export function Projects() {
  const { state, draft, busy, dirty, change, execute, save, saveThen, exportData } = useWorkspace();
  const [selectedId, setSelectedIdState] = useState(memo.projectId),
    [confirming, setConfirming] = useState("");
  const setSelectedId = (id: string) => {
    memo.projectId = id;
    setSelectedIdState(id);
  };
  const root = useRef<HTMLDivElement>(null);
  const projects = draft.projects,
    selected = projects.find((p) => p.id === selectedId) ?? projects[0];
  const sessions = state.ai?.combined?.sessions;
  const usage = useMemo(() => {
    if (!sessions) return { all: [], recent: [] };
    const cut = Date.now() - 30 * 86400000;
    return { all: matchProjects(sessions, projects), recent: matchProjects(sessions.filter((s) => s[2] >= cut), projects) };
  }, [sessions, projects]);
  const u = (list: typeof usage.all, p: Project) => list.find((x) => x.projectId === p.id);
  const update = (id: string, edits: Partial<Omit<Project, "id">>) =>
    change((s) => {
      const project = s.projects.find((p) => p.id === id);
      if (project) Object.assign(project, edits);
    });
  const remove = (p: Project) => {
    const index = projects.findIndex((x) => x.id === p.id),
      row = root.current?.querySelector<HTMLElement>(`tr[data-k="${CSS.escape(p.id)}"]`);
    const apply = () => {
      setConfirming("");
      if (selected?.id === p.id) setSelectedId(projects.find((x) => x.id !== p.id)?.id ?? "");
      change((s) => {
        s.projects = s.projects.filter((x) => x.id !== p.id);
      });
      toast(`Removed ${p.name} from the list`, {
        icon: "trash",
        action: {
          label: "Undo",
          run: () => {
            change((s) => {
              if (!s.projects.some((x) => x.id === p.id)) s.projects.splice(Math.min(index, s.projects.length), 0, p);
            });
            setSelectedId(p.id);
          },
        },
      });
    };
    const a = play(row, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(-24px)" }], { duration: 200, fill: "forwards" });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      apply();
    };
    if (a) a.onfinish = finish;
    setTimeout(finish, a ? 280 : 0);
  };
  const columns: Column<Project>[] = [
    {
      key: "enabled",
      label: "Enabled",
      className: "col-check",
      value: (p) => (p.isEnabled ? "On" : "Off"),
      render: (p) => <Check aria={"Enable " + p.name} checked={p.isEnabled} disabled={!!busy} onChange={(on) => update(p.id, { isEnabled: on })} />,
    },
    {
      key: "name",
      label: "Name",
      value: (p) => p.name,
      render: (p) => (
        <input
          className="cell-input"
          type="text"
          aria-label={"Project name for " + p.name}
          value={p.name}
          title={p.name}
          spellCheck={false}
          disabled={!!busy}
          onChange={(e) => update(p.id, { name: e.target.value })}
        />
      ),
    },
    {
      key: "root",
      label: "Root path",
      value: (p) => p.rootPath,
      render: (p) => (
        <input
          className="cell-input mono"
          type="text"
          aria-label={"Root path for " + p.name}
          value={p.rootPath}
          title={p.rootPath}
          spellCheck={false}
          disabled={!!busy}
          onChange={(e) => update(p.id, { rootPath: e.target.value })}
        />
      ),
    },
    { key: "ai30", label: "AI tokens · 30d", value: (p) => u(usage.recent, p)?.tokens, bar: true },
    { key: "ai", label: "AI tokens", value: (p) => u(usage.all, p)?.tokens },
    {
      key: "cost",
      label: "AI cost",
      hint: "API equivalent",
      title: () => "API equivalent",
      value: (p) => {
        const x = u(usage.all, p);
        return x && x.sessions ? x.cost : undefined;
      },
      render: (p) => {
        const x = u(usage.all, p);
        return !x || !x.sessions || (x.cost === 0 && x.costPartial) ? "—" : money(x.cost, x.costPartial);
      },
    },
    {
      key: "actions",
      label: "Actions",
      className: "col-actions",
      value: () => "",
      render: (p) =>
        confirming === p.id ? (
          <SwapIn className="row-actions" dir={1} distance={10} dur={200}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!!busy}
              onClick={(e) => {
                e.stopPropagation();
                setConfirming("");
              }}
            >
              Keep
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger is-solid"
              disabled={!!busy}
              onClick={(e) => {
                e.stopPropagation();
                remove(p);
              }}
            >
              Confirm remove
            </button>
          </SwapIn>
        ) : (
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-sm btn-danger"
              aria-label={"Remove " + p.name}
              disabled={!!busy}
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(p.id);
              }}
            >
              <Icon name="trash" size={14} />
              <span>Remove</span>
            </button>
          </div>
        ),
    },
  ];
  const pm = selected ? state.settings.lastSnapshot?.projects.find((x) => x.projectId === selected.id) : undefined,
    all = selected ? u(usage.all, selected) : undefined,
    recent = selected ? u(usage.recent, selected) : undefined;
  const add = () =>
    void saveThen(async () => {
      const next = await window.codelines.addProject();
      const added = next.settings.projects.find((p) => !projects.some((old) => old.id === p.id));
      if (added) setSelectedId(added.id);
      return next;
    }, "Project added");
  return (
    <div ref={root} className="stack">
      <div className="toolbar section-toolbar">
        <div>
          <h2>Project sources</h2>
          <p className="muted">{`${projects.length} ${projects.length === 1 ? "folder" : "folders"} · enable, rename, or add folders to the workspace`}</p>
        </div>
        <span className="spacer" />
        <div className="toolbar wrap">
          <Button label="Scan selected" icon="play" disabled={!!busy || !selected} onClick={() => selected && void execute("scan", selected.id)} />
          <Button label="Import…" icon="upload" disabled={!!busy} onClick={() => void saveThen(() => window.codelines.importProjects(), "Project list imported")} />
          <Button label="Export" icon="download" disabled={!!busy || !projects.length} onClick={() => void exportData("projects", "json")} />
          <Button label="Add project" primary icon="plus" disabled={!!busy} onClick={add} />
        </div>
      </div>
      {!projects.length ? (
        <Empty
          art="folder"
          title="A home for your projects"
          text="Choose a local folder with the native folder picker. CodeLines reads it when you scan."
          action={<Button label="Add project" primary icon="plus" disabled={!!busy} onClick={add} />}
        />
      ) : (
        <Split
          id="projects"
          initial={0.68}
          label="Resize the project list and its exclusions"
          left={
            <section className="panel panel-flush" aria-label="Projects">
              <DataTable
                label="Project sources"
                rows={projects}
                columns={columns}
                rowKey={(p) => p.id}
                onSelect={(p) => setSelectedId(p.id)}
                selected={(p) => selected?.id === p.id}
                rowFocusSelect
                noRowLink
                rowClass={(p) => (p.isEnabled ? "" : "is-disabled")}
                className="dt-projects"
              />
            </section>
          }
          right={
            <div className="panel inspector" aria-label="Project exclusions" aria-live="polite">
              {selected && (
                <SwapIn key={selected.id} className="stack-s" y={8} dur={240} dir={0}>
                  <div>
                    <h2>Project exclusions</h2>
                    <p className="muted">One .gitignore-style pattern per line. Applied after global patterns and repository .gitignore rules.</p>
                  </div>
                  <div className="field">
                    <span className="field-label">{"Patterns for " + selected.name}</span>
                    <LinesInput
                      key={selected.id}
                      label={"Exclusion patterns for " + selected.name}
                      rows={5}
                      disabled={!!busy}
                      value={selected.excludePatterns}
                      onChange={(lines) => update(selected.id, { excludePatterns: lines })}
                    />
                  </div>
                  <div className="inspector-facts">
                    <h3>Last scan</h3>
                    {pm ? (
                      <dl className="facts">
                        {(
                          [
                            ["Files", number(pm.fileCount)],
                            ["Physical lines", number(pm.physicalLines)],
                            ["Code lines", number(pm.codeLines)],
                            ["Source tokens", number(pm.totalTokens)],
                            ["Top language", pm.languages[0]?.language ?? "—"],
                            ["AI sessions", all ? number(all.sessions) : "—"],
                            ["AI tokens · 30d", recent ? compact(recent.tokens) : "—"],
                          ] as const
                        ).map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="muted">{selected.isEnabled ? "Not scanned yet. Use Scan selected to read this folder." : "This folder is disabled, so scans skip it."}</p>
                    )}
                  </div>
                </SwapIn>
              )}
            </div>
          }
        />
      )}
      {(projects.length > 0 || dirty) && (
        <div className={"save-bar" + (dirty ? " is-dirty" : "")}>
          <Button label="Save project changes" primary icon="save" disabled={!!busy || !dirty} onClick={() => void save()} />
          <span className="muted">{dirty ? "You have unsaved changes. Starting a scan also saves them." : "All project changes are saved."}</span>
        </div>
      )}
    </div>
  );
}

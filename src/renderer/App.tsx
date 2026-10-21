import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  FolderOpen,
  ChartNoAxesCombined,
  GitBranch,
  CalendarDays,
  Sparkles,
  Settings as SettingsIcon,
  Play,
  Plus,
  Download,
  RefreshCw,
  Square,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import type {
  AgentStatus,
  AppState,
  Settings,
  Progress,
  OperationKind,
  ExportKind,
  ProjectMetric,
  GitProject,
  FileMetric,
  LanguageMetric,
} from "../shared/contracts";
import { scopes } from "../shared/contracts";
import {
  Card,
  Tiles,
  Table,
  Empty,
  Field,
  col,
  number,
  signed,
  percent,
  type Column,
} from "./components";
import { Reports } from "./reports";
import { agentLabels } from "../shared/agents";
import {
  matchProjects,
  timeline,
  compareDays,
  effectiveLines,
} from "../domain/daily";
import { payloadTotals } from "../ai/aggregate";
import { tokens, dayParts } from "../ai/model";
import { gitTotals } from "../domain/history";
// Only pure domain helpers are imported by the renderer. No Node or filesystem modules enter this bundle.
type Page =
  | "Dashboard"
  | "Projects"
  | "Analysis"
  | "Code changes"
  | "Daily log"
  | "AI usage"
  | "Settings";
const pages: { name: Page; icon: typeof LayoutDashboard; hint: string }[] = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    hint: "Your workspace at a glance",
  },
  { name: "Projects", icon: FolderOpen, hint: "The source of your numbers" },
  {
    name: "Analysis",
    icon: ChartNoAxesCombined,
    hint: "Explore every line and token",
  },
  {
    name: "Code changes",
    icon: GitBranch,
    hint: "Committed activity, captured locally",
  },
  {
    name: "Daily log",
    icon: CalendarDays,
    hint: "The shape of your work over time",
  },
  { name: "AI usage", icon: Sparkles, hint: "Local agents, one clear picture" },
  {
    name: "Settings",
    icon: SettingsIcon,
    hint: "Make CodeLines work your way",
  },
];
const duration = (ms: number) =>
  `${Math.floor(ms / 60000)}m ${Math.floor(ms / 1000) % 60}s`;
const scopeLabel = (s: string) =>
  s === "SourceOnly"
    ? "Source only"
    : s === "SourceAndConfiguration"
      ? "Source + configuration"
      : "All verified text";
const split = (s: string) =>
  s
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
const projectColumns: Column<ProjectMetric>[] = [
  col("projectName", "Project", true),
  col("fileCount", "Files"),
  col("physicalLines", "Physical lines"),
  col("codeLines", "Code lines"),
  col("totalTokens", "Source tokens"),
];
const languageColumns: Column<LanguageMetric>[] = [
  col("language", "Language", true),
  col("category", "Category"),
  col("files", "Files"),
  col("bytes", "Bytes"),
  col("tokens", "Tokens"),
  col("physicalLines", "Physical"),
  col("blankLines", "Blank"),
  col("codeLines", "Code"),
  col("commentLines", "Comment"),
  col("mixedLines", "Mixed"),
  col("contentLines", "Content"),
];
const fileColumns: Column<FileMetric>[] = [
  col("relativePath", "Path", true),
  col("extension", "Extension"),
  col("language", "Language"),
  col("category", "Category"),
  col("bytes", "Bytes"),
  col("tokens", "Tokens"),
  ...(
    [
      "physicalLines",
      "blankLines",
      "codeLines",
      "commentLines",
      "mixedLines",
      "contentLines",
    ] as const
  ).map((k) => ({
    key: k,
    label: k.replace("Lines", ""),
    value: (f: FileMetric) => f.lines[k],
  })),
];
export function App() {
  const [state, setState] = useState<AppState | null>(null),
    [draft, setDraft] = useState<Settings | null>(null),
    [page, setPage] = useState<Page>("Dashboard"),
    [status, setStatus] = useState("Loading local workspace…"),
    [error, setError] = useState(""),
    [progress, setProgress] = useState<Progress | null>(null),
    [busy, setBusy] = useState<{ id: string; kind: OperationKind } | null>(
      null,
    ),
    [selected, setSelected] = useState(""),
    [dailyProject, setDailyProject] = useState("enabled"),
    [allAgents, setAllAgents] = useState(true),
    [dateA, setDateA] = useState(""),
    [dateB, setDateB] = useState(""),
    [analysisTab, setAnalysisTab] = useState("Languages"),
    [category, setCategory] = useState("all"),
    [historyProject, setHistoryProject] = useState(""),
    [partial, setPartial] = useState<GitProject[]>([]);
  const aiOpened = useRef(false),
    activeId = useRef("");
  const apply = (s: AppState) => {
    setState(s);
    setDraft(structuredClone(s.settings));
  };
  useEffect(() => {
    window.codelines
      .load()
      .then((s) => {
        apply(s);
        setStatus("Ready to scan");
        setSelected(s.settings.lastSnapshot?.projects[0]?.projectId ?? "");
      })
      .catch((e) => setError(String(e)));
    return window.codelines.onProgress((p) => {
      if (p.id !== activeId.current) return;
      setProgress(p);
      if (p.partial) setPartial(p.partial);
    });
  }, []);
  useEffect(() => {
    if (!draft) return;
    const media = matchMedia("(prefers-color-scheme: dark)"),
      update = () => {
        document.documentElement.dataset.theme =
          draft.theme === "Dark" || (draft.theme === "System" && media.matches)
            ? "dark"
            : "light";
      };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [draft?.theme]);
  const execute = async (
    kind: OperationKind,
    projectId?: string,
    rescan = false,
    settings = draft,
  ) => {
    if (!settings || busy) return;
    if (kind === "ai") aiOpened.current = true;
    const id = crypto.randomUUID();
    activeId.current = id;
    setBusy({ id, kind });
    setProgress(null);
    setError("");
    setStatus(`Starting ${kind}…`);
    if (kind === "history") setPartial([]);
    try {
      const result = await window.codelines.run({
        id,
        kind,
        projectId,
        rescan,
        settings,
      });
      apply(result.state);
      setStatus(
        result.status === "completed"
          ? `${kind === "scan" ? "Scan" : kind === "history" ? "Git history" : "AI usage"} complete`
          : result.status === "cancelled"
            ? `${kind} cancelled; visible history totals are partial`
            : `${kind} failed`,
      );
      if (result.error) setError(result.error);
      if (result.partial) setPartial(result.partial);
      if (result.status === "completed" && kind === "scan") {
        const next = result.state.settings;
        if (projectId) setSelected(projectId);
        else setSelected(next.lastSnapshot?.projects[0]?.projectId ?? "");
        if (next.aiUsage.enabled && next.dailyLog.refreshAiAfterScan) {
          aiOpened.current = true;
          setBusy(null);
          activeId.current = "";
          const aiId = crypto.randomUUID();
          activeId.current = aiId;
          setBusy({ id: aiId, kind: "ai" });
          setStatus("Scan complete · refreshing AI usage for the daily log…");
          const ai = await window.codelines.run({
            id: aiId,
            kind: "ai",
            settings: next,
          });
          apply(ai.state);
          setStatus("Scan complete · AI usage " + ai.status);
          if (ai.error) setError(ai.error);
        }
      }
    } catch (e) {
      setError(String(e));
      setStatus("Operation failed");
    } finally {
      setBusy(null);
      activeId.current = "";
      setProgress(null);
    }
  };
  useEffect(() => {
    if (
      page === "AI usage" &&
      draft?.aiUsage.enabled &&
      draft.aiUsage.autoRefreshOnOpen &&
      !aiOpened.current &&
      !busy
    ) {
      aiOpened.current = true;
      void execute("ai");
    }
  }, [page, draft?.aiUsage.enabled, busy]);
  const act = async (action: () => Promise<AppState>, message: string) => {
    setError("");
    try {
      apply(await action());
      setStatus(message);
    } catch (e) {
      setError(String(e));
    }
  };
  const save = () =>
    draft
      ? act(() => window.codelines.save(draft), "Settings saved")
      : Promise.resolve();
  const exportData = async (
    kind: ExportKind,
    format: "json" | "csv" | "html",
  ) => {
    setError("");
    try {
      if (
        kind === "projects" &&
        draft &&
        JSON.stringify(draft) !== JSON.stringify(state?.settings)
      )
        apply(await window.codelines.save(draft));
      const selectedIds =
        dailyProject === "enabled"
          ? draft!.projects.filter((p) => p.isEnabled).map((p) => p.id)
          : dailyProject === "all"
            ? undefined
            : [dailyProject];
      const file = await window.codelines.export({
        kind,
        format,
        projectIds: selectedIds,
        allAgents,
      });
      if (file) setStatus("Exported " + file);
    } catch (e) {
      setError(String(e));
    }
  };
  if (!state || !draft)
    return (
      <main className="loading">
        <h1>CodeLines</h1>
        <p>{error || "Opening your local workspace…"}</p>
      </main>
    );
  const change = (fn: (s: Settings) => void) =>
    setDraft((current) => {
      const next = structuredClone(current!);
      fn(next);
      return next;
    });
  const results = state.settings.lastSnapshot?.projects ?? [],
    selectedResult =
      results.find((p) => p.projectId === selected) ?? results[0];
  const usage = state.ai?.combined
    ? matchProjects(state.ai.combined.sessions, draft.projects)
    : [];
  const recent = state.ai?.combined
    ? matchProjects(
        state.ai.combined.sessions.filter(
          (s) => s[2] >= Date.now() - 30 * 86400000,
        ),
        draft.projects,
      )
    : [];
  const recentCut = dayParts(Date.now() - 30 * 86400000, false).day,
    ai30 = state.ai?.combined
      ? tokens(payloadTotals(state.ai.combined, (d) => d > recentCut))
      : null;
  const selectedIds =
    dailyProject === "enabled"
      ? draft.projects.filter((p) => p.isEnabled).map((p) => p.id)
      : dailyProject === "all"
        ? undefined
        : [dailyProject];
  const dailyRows = timeline(state.daily, selectedIds, allAgents),
    dates = dailyRows.map((r) => r.date).reverse(),
    a = dateA || dates[1] || dates[0] || "",
    b = dateB || dates[0] || "",
    comparison = compareDays(state.daily, a, b, selectedIds, allAgents);
  const history = state.settings.lastGitHistory,
    histories =
      busy?.kind === "history" || !history ? partial : history.projects,
    historyTotals = gitTotals(
      histories,
      history?.mode ?? draft.gitHistory.mode,
    ),
    chosenHistory =
      histories.find((p) => p.projectId === historyProject) ?? histories[0];
  const invalidates =
    JSON.stringify([
      draft.projects,
      draft.scanOptions.countingScope,
      draft.scanOptions.globalExcludePatterns,
      draft.gitHistory,
    ]) !==
    JSON.stringify([
      state.settings.projects,
      state.settings.scanOptions.countingScope,
      state.settings.scanOptions.globalExcludePatterns,
      state.settings.gitHistory,
    ]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.settings);
  const visiblePages = pages.filter(
    (p) =>
      (p.name !== "Code changes" || draft.gitHistory.enabled) &&
      (p.name !== "AI usage" || draft.aiUsage.enabled),
  );
  const title = pages.find((p) => p.name === page)!;
  const toolbarExport = (kind: ExportKind, html = false) => (
    <>
      <button
        disabled={!!busy}
        onClick={() => void exportData(kind, html ? "html" : "csv")}
      >
        <Download size={15} />
        {html ? "Export HTML" : "Export CSV"}
      </button>
      <button disabled={!!busy} onClick={() => void exportData(kind, "json")}>
        JSON
      </button>
    </>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CL</div>
          <div>
            <strong>CodeLines</strong>
            <span>PROJECT INTELLIGENCE</span>
          </div>
        </div>
        <div className="rail-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {visiblePages.map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-current={page === name ? "page" : undefined}
              className={page === name ? "active" : ""}
              onClick={() => setPage(name)}
            >
              <Icon size={18} />
              <span>{name}</span>
              {page === name && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="privacy">
          <ShieldCheck size={20} />
          <strong>Local by design</strong>
          <p>Your source and usage stay on this computer.</p>
          <span className="online-dot" /> Offline ready
        </div>
        <small className="version">CodeLines TS · 1.0</small>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            <span className="workspace-dot" /> Local workspace{" "}
            <ChevronRight size={13} /> {page}
          </span>
          <div>
            <select
              aria-label="Appearance"
              disabled={!!busy}
              value={draft.theme}
              onChange={(e) =>
                change((s) => {
                  s.theme = e.target.value as Settings["theme"];
                })
              }
            >
              {["System", "Light", "Dark"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {dirty && (
              <button disabled={!!busy} onClick={() => void save()}>
                Save changes
              </button>
            )}
          </div>
        </header>
        <main>
          <header className="page-header">
            <div>
              <span className="eyebrow">{title.hint}</span>
              <h1>{page}</h1>
              <p>
                {state.settings.lastSnapshot
                  ? "Latest scan " +
                    new Date(
                      state.settings.lastSnapshot.scannedAt,
                    ).toLocaleString()
                  : "A clearer view starts with your first scan."}
              </p>
            </div>
            <div className="toolbar wrap">
              <select
                aria-label="Counting scope"
                disabled={!!busy}
                value={draft.scanOptions.countingScope}
                onChange={(e) =>
                  change((s) => {
                    s.scanOptions.countingScope = e.target
                      .value as Settings["scanOptions"]["countingScope"];
                  })
                }
              >
                {scopes.map((s) => (
                  <option key={s} value={s}>
                    {scopeLabel(s)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Tokenizer"
                disabled={!!busy}
                value={draft.scanOptions.tokenizerEncoding}
                onChange={(e) =>
                  change((s) => {
                    s.scanOptions.tokenizerEncoding = e.target.value as
                      "o200k_base" | "cl100k_base";
                  })
                }
              >
                <option>o200k_base</option>
                <option>cl100k_base</option>
              </select>
              <button
                className="primary"
                disabled={!!busy || !draft.projects.some((p) => p.isEnabled)}
                onClick={() => void execute("scan")}
              >
                <Play size={15} />
                Scan all projects
              </button>
            </div>
          </header>
          {error && (
            <div className="error" role="alert">
              <strong>Something needs attention</strong>
              <p>{error}</p>
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          {busy && (
            <Card className="progress-card">
              <div className="toolbar">
                <strong>
                  {progress?.stage ?? "Starting background worker…"}
                </strong>
                <div className="spacer" />
                <button
                  onClick={() => {
                    setStatus("Cancelling…");
                    void window.codelines.cancel(busy.id);
                  }}
                >
                  <Square size={13} />
                  Cancel
                </button>
              </div>
              <p>
                {progress?.project}{" "}
                {progress?.projectIndex !== undefined
                  ? ` · Project ${progress.projectIndex + 1}/${progress.projectCount}`
                  : ""}{" "}
                · {duration(progress?.elapsed ?? 0)} elapsed
                {progress?.eta
                  ? ` · Current project ETA ≈ ${duration(progress.eta)}`
                  : ""}
              </p>
              <progress
                max={progress?.total ?? undefined}
                value={
                  progress?.total === null ? undefined : progress?.completed
                }
              />
              <div className="progress-detail">
                {progress?.total !== null && progress?.total !== undefined
                  ? `${number(progress.completed)}/${number(progress.total)} comparisons or files complete`
                  : "Discovering work; remaining count not known yet"}
                {progress?.totalFiles !== undefined &&
                  ` · Current comparison files ${progress.completedFiles}/${progress.totalFiles}`}
                <span title={progress?.path}>{progress?.path}</span>
              </div>
            </Card>
          )}
          {page === "Dashboard" && (
            <>
              <Tiles
                items={[
                  {
                    label: "Projects",
                    value: number(results.length),
                    detail: `${draft.projects.filter((p) => p.isEnabled).length} enabled`,
                  },
                  {
                    label: "Files",
                    value: number(results.reduce((n, p) => n + p.fileCount, 0)),
                  },
                  {
                    label: "Physical lines",
                    value: number(
                      results.reduce((n, p) => n + p.physicalLines, 0),
                    ),
                  },
                  {
                    label: "Code lines",
                    value: number(results.reduce((n, p) => n + p.codeLines, 0)),
                  },
                  {
                    label: "Source tokens",
                    value: number(
                      results.reduce((n, p) => n + p.totalTokens, 0),
                    ),
                    detail: state.settings.lastSnapshot?.tokenizerEncoding,
                  },
                  {
                    label: "AI tokens · 30 days",
                    value: number(ai30),
                    detail: "Cache included · all agents",
                  },
                ]}
              />
              {results.length ? (
                <div className="dashboard-grid">
                  <Card
                    title="Project overview"
                    subtitle="Latest scan · select a project to explore its languages"
                  >
                    <Table
                      label="Project overview"
                      rows={results}
                      columns={projectColumns}
                      onSelect={(r) => setSelected(r.projectId)}
                      selected={(r) =>
                        r.projectId === selectedResult?.projectId
                      }
                    />
                  </Card>
                  <Card
                    title="Language share"
                    subtitle={selectedResult?.projectName}
                  >
                    {selectedResult?.languages.map((l, i) => (
                      <div className="language-share" key={l.language}>
                        <div>
                          <span>
                            <i
                              style={{
                                background: [
                                  "#6d8bff",
                                  "#38bca4",
                                  "#b396f5",
                                  "#e5aa59",
                                ][i % 4],
                              }}
                            />
                            {l.language}
                          </span>
                          <strong>
                            {percent(
                              l.physicalLines /
                                (selectedResult.physicalLines || 1),
                            )}
                          </strong>
                        </div>
                        <div className="share-track">
                          <div
                            style={{
                              width: percent(
                                l.physicalLines /
                                  (selectedResult.physicalLines || 1),
                              ),
                            }}
                          />
                        </div>
                        <small>
                          {number(l.files)} files · {number(l.physicalLines)}{" "}
                          lines · {number(l.tokens)} tokens
                        </small>
                      </div>
                    ))}
                  </Card>
                </div>
              ) : (
                <Empty title="Meet your codebase">
                  Add your project folders, then scan to see files, languages,
                  lines, and tokens.
                  <button
                    className="primary"
                    disabled={!!busy}
                    onClick={() =>
                      void act(
                        () => window.codelines.addProject(),
                        "Project added",
                      )
                    }
                  >
                    <Plus size={16} />
                    Add your first project
                  </button>
                </Empty>
              )}
            </>
          )}
          {page === "Projects" && (
            <>
              <div className="toolbar section-toolbar">
                <div>
                  <h2>Project sources</h2>
                  <p className="muted">
                    {draft.projects.length} folders · edit names, paths, and
                    exclusions below
                  </p>
                </div>
                <div className="spacer" />
                <button
                  disabled={!!busy}
                  onClick={() =>
                    void act(async () => {
                      await window.codelines.save(draft);
                      return window.codelines.importProjects();
                    }, "Project list imported")
                  }
                >
                  Import…
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => void exportData("projects", "json")}
                >
                  <Download size={15} />
                  Export
                </button>
                <button
                  className="primary"
                  disabled={!!busy}
                  onClick={() =>
                    void act(async () => {
                      await window.codelines.save(draft);
                      return window.codelines.addProject();
                    }, "Project added")
                  }
                >
                  <Plus size={15} />
                  Add project
                </button>
              </div>
              {!draft.projects.length ? (
                <Empty title="A home for your projects">
                  Choose a local folder with the native folder picker. CodeLines
                  reads it when you scan.
                </Empty>
              ) : (
                <div className="project-list">
                  {draft.projects.map((p, i) => {
                    const u = usage.find((u) => u.projectId === p.id),
                      r = recent.find((u) => u.projectId === p.id);
                    return (
                      <Card key={p.id}>
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
                            onClick={() =>
                              change((s) => {
                                s.projects.splice(i, 1);
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                        <div className="project-usage">
                          <span>
                            AI tokens · 30d <strong>{number(r?.tokens)}</strong>
                          </span>
                          <span>
                            AI tokens · all time{" "}
                            <strong>{number(u?.tokens)}</strong>
                          </span>
                          <span>
                            API equivalent{" "}
                            <strong>
                              {!u ||
                              !u.sessions ||
                              (u.cost === 0 && u.costPartial)
                                ? "—"
                                : "$" +
                                  u.cost.toFixed(2) +
                                  (u.costPartial ? "*" : "")}
                            </strong>
                          </span>
                          <span>{number(u?.sessions)} sessions</span>
                        </div>
                        <details>
                          <summary>Project exclusions</summary>
                          <Field
                            label="Patterns (one per line)"
                            help="Applied after global patterns and repository .gitignore rules."
                          >
                            <textarea
                              className="mono"
                              disabled={!!busy}
                              value={p.excludePatterns.join("\n")}
                              onChange={(e) =>
                                change((s) => {
                                  s.projects[i].excludePatterns = split(
                                    e.target.value,
                                  );
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
              <div className="toolbar">
                <button
                  className="primary"
                  disabled={!!busy || !dirty}
                  onClick={() => void save()}
                >
                  Save project changes
                </button>
                <span className="muted">
                  Project edits are saved when you save or start a scan.
                </span>
              </div>
            </>
          )}
          {page === "Analysis" &&
            (results.length ? (
              <>
                <div className="toolbar section-toolbar">
                  <label>
                    Project{" "}
                    <select
                      aria-label="Analysis project"
                      value={selectedResult?.projectId}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {results.map((p) => (
                        <option value={p.projectId} key={p.projectId}>
                          {p.projectName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Category{" "}
                    <select
                      aria-label="Analysis category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="all">All categories</option>
                      {["SourceCode", "Configuration", "DocumentationText"].map(
                        (c) => (
                          <option key={c}>{c}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <div className="spacer" />
                  {toolbarExport("analysis")}
                </div>
                {selectedResult && (
                  <>
                    <Tiles
                      items={[
                        {
                          label: "Files",
                          value: number(selectedResult.fileCount),
                        },
                        {
                          label: "Physical lines",
                          value: number(selectedResult.physicalLines),
                        },
                        {
                          label: "Code",
                          value: number(selectedResult.codeLines),
                        },
                        {
                          label: "Comments",
                          value: number(selectedResult.commentLines),
                        },
                        {
                          label: "Content",
                          value: number(selectedResult.contentLines),
                        },
                        {
                          label: "Tokens",
                          value: number(selectedResult.totalTokens),
                        },
                      ]}
                    />
                    <div className="tabs">
                      {["Languages", "Categories", "Files", "Warnings"].map(
                        (t) => (
                          <button
                            key={t}
                            aria-pressed={analysisTab === t}
                            onClick={() => setAnalysisTab(t)}
                          >
                            {t}
                            {t === "Warnings"
                              ? " · " + selectedResult.warnings.length
                              : ""}
                          </button>
                        ),
                      )}
                    </div>
                    <Card
                      title={analysisTab}
                      subtitle={selectedResult.rootPath}
                    >
                      {analysisTab === "Languages" && (
                        <Table
                          label="Language analysis"
                          rows={selectedResult.languages.filter(
                            (l) =>
                              category === "all" || l.category === category,
                          )}
                          columns={languageColumns}
                        />
                      )}{" "}
                      {analysisTab === "Categories" && (
                        <Table
                          label="Category analysis"
                          rows={selectedResult.categories}
                          columns={[
                            col("category", "Category", true),
                            col("files", "Files"),
                            col("tokens", "Tokens"),
                            col("physicalLines", "Physical lines"),
                            col("codeOrContentLines", "Code + content"),
                          ]}
                        />
                      )}{" "}
                      {analysisTab === "Files" && (
                        <Table
                          label="File analysis"
                          rows={selectedResult.files.filter(
                            (f) =>
                              category === "all" || f.category === category,
                          )}
                          columns={fileColumns}
                        />
                      )}{" "}
                      {analysisTab === "Warnings" &&
                        (selectedResult.warnings.length ? (
                          <ul className="warnings">
                            {selectedResult.warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>No warnings or skipped paths were reported.</p>
                        ))}
                    </Card>
                  </>
                )}
              </>
            ) : (
              <Empty title="Every line has a story">
                Scan a project to explore detailed language, category, file, and
                token metrics.
              </Empty>
            ))}
          {page === "Code changes" && (
            <>
              <div className="toolbar section-toolbar">
                <Field label="Period">
                  <select
                    aria-label="History period"
                    disabled={!!busy}
                    value={
                      [7, 30, 365].includes(draft.gitHistory.days)
                        ? draft.gitHistory.days
                        : "custom"
                    }
                    onChange={(e) =>
                      change((s) => {
                        s.gitHistory.days =
                          e.target.value === "custom"
                            ? 90
                            : Number(e.target.value);
                      })
                    }
                  >
                    {[7, 30, 365].map((n) => (
                      <option value={n} key={n}>
                        {n} days
                      </option>
                    ))}
                    <option value="custom">Custom</option>
                  </select>
                </Field>
                {![7, 30, 365].includes(draft.gitHistory.days) && (
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
                          s.gitHistory.days = Number(e.target.value);
                        })
                      }
                    />
                  </Field>
                )}
                <Field label="Mode">
                  <select
                    aria-label="History mode"
                    disabled={!!busy}
                    value={draft.gitHistory.mode}
                    onChange={(e) =>
                      change((s) => {
                        s.gitHistory.mode = e.target.value as
                          "Activity" | "NetChange";
                      })
                    }
                  >
                    <option>Activity</option>
                    <option>NetChange</option>
                  </select>
                </Field>
                <button
                  className="primary"
                  disabled={!!busy}
                  onClick={() => void execute("history")}
                >
                  <RefreshCw size={15} />
                  Refresh history
                </button>
                <div className="spacer" />
                {history && !invalidates && !busy && toolbarExport("history")}
              </div>
              <p className="notice">
                Modified estimates overlap added/deleted lines. Net = added −
                deleted. Only committed first-parent history is counted. No
                repository is changed or fetched.
              </p>
              {invalidates ? (
                <p className="notice">
                  Options or project details changed. Refresh to analyze this
                  configuration.
                </p>
              ) : (
                <>
                  <Tiles
                    items={[
                      { label: "Added", value: number(historyTotals.added) },
                      {
                        label: "Deleted",
                        value: number(historyTotals.deleted),
                      },
                      {
                        label: "Modified · est.",
                        value: number(historyTotals.modifiedEstimate),
                      },
                      { label: "Net lines", value: signed(historyTotals.net) },
                      {
                        label: "Changed files",
                        value: number(historyTotals.changedFiles),
                        detail: `${historyTotals.binaryFiles} binary`,
                      },
                      {
                        label: "Commits",
                        value: number(historyTotals.commits),
                        detail: `${historyTotals.incompleteProjects} incomplete / unavailable`,
                      },
                    ]}
                  />
                  <p className="muted">
                    {history && !busy
                      ? `${new Date(history.start).toLocaleString()} → ${new Date(history.end).toLocaleString()} · ${history.mode} · ${history.scope}`
                      : `Partial totals · ${histories.length} projects processed. Refresh before exporting.`}
                  </p>
                  <Card title="Repositories">
                    <Table
                      label="History project results"
                      rows={histories}
                      onSelect={(p) => setHistoryProject(p.projectId)}
                      selected={(p) => p.projectId === chosenHistory?.projectId}
                      columns={[
                        col("projectName", "Project", true),
                        col("branch", "Branch"),
                        col("head", "Captured HEAD"),
                        col("status", "Status"),
                        col("added", "Added"),
                        col("deleted", "Deleted"),
                        col("modifiedEstimate", "Modified est."),
                        col("net", "Net"),
                        col("commits", "Commits"),
                      ]}
                    />
                  </Card>
                  {chosenHistory && (
                    <Card
                      title={chosenHistory.projectName + " · changed files"}
                    >
                      <Table
                        label="Git changed files"
                        rows={chosenHistory.files}
                        columns={[
                          col("path", "Path", true),
                          col("added", "Added"),
                          col("deleted", "Deleted"),
                          col("modifiedEstimate", "Modified est."),
                          col("net", "Net"),
                          {
                            key: "binary",
                            label: "Binary",
                            value: (r) => (r.binary ? "Yes" : "No"),
                          },
                        ]}
                      />
                    </Card>
                  )}
                </>
              )}
            </>
          )}
          {page === "Daily log" && (
            <>
              <div className="toolbar section-toolbar">
                <label>
                  Projects{" "}
                  <select
                    aria-label="Daily log project"
                    value={dailyProject}
                    onChange={(e) => {
                      setDailyProject(e.target.value);
                      setAllAgents(e.target.value === "enabled");
                    }}
                  >
                    <option value="enabled">All enabled projects</option>
                    {draft.projects.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={allAgents}
                    onChange={(e) => setAllAgents(e.target.checked)}
                  />
                  AI usage of the whole computer
                </label>
                <div className="spacer" />
                <button onClick={() => void exportData("daily", "csv")}>
                  <Download size={15} />
                  Export daily CSV
                </button>
              </div>
              <p className="muted">
                Latest scan per project per day. Earlier project values carry
                forward and are identified below.
              </p>
              {dailyRows.length ? (
                <>
                  <Card title="Daily timeline">
                    <Table
                      label="Daily log timeline"
                      rows={[...dailyRows].reverse()}
                      columns={[
                        {
                          key: "date",
                          label: "Date",
                          value: (r) => r.date,
                          path: true,
                        },
                        {
                          key: "projects",
                          label: "Projects",
                          value: (r) => r.projects,
                        },
                        {
                          key: "carried",
                          label: "Carried",
                          value: (r) => r.carriedProjects,
                        },
                        {
                          key: "files",
                          label: "Files",
                          value: (r) => r.lines?.files,
                        },
                        {
                          key: "lines",
                          label: "Lines",
                          value: (r) => r.lines?.physicalLines,
                        },
                        {
                          key: "delta",
                          label: "Δ lines",
                          value: (r) => r.deltaLines,
                          render: (r) => signed(r.deltaLines),
                        },
                        {
                          key: "code",
                          label: "Code",
                          value: (r) => r.lines?.codeLines,
                        },
                        {
                          key: "deltaCode",
                          label: "Δ code",
                          value: (r) => r.deltaCode,
                          render: (r) => signed(r.deltaCode),
                        },
                        {
                          key: "tokens",
                          label: "Tokens",
                          value: (r) => r.lines?.tokens,
                        },
                        {
                          key: "deltaTokens",
                          label: "Δ tokens",
                          value: (r) => r.deltaTokens,
                          render: (r) => signed(r.deltaTokens),
                        },
                        {
                          key: "ai",
                          label: "AI tokens",
                          value: (r) => r.ai?.tokens,
                        },
                        {
                          key: "cost",
                          label: "API equivalent",
                          value: (r) => r.ai?.cost,
                          render: (r) =>
                            r.ai
                              ? "$" +
                                r.ai.cost.toFixed(2) +
                                (r.ai.costPartial ? "*" : "")
                              : "—",
                        },
                        { key: "notes", label: "Notes", value: (r) => r.notes },
                      ]}
                    />
                  </Card>
                  <div className="toolbar section-toolbar">
                    <h2>Compare dates</h2>
                    <select
                      aria-label="Comparison date A"
                      value={a}
                      onChange={(e) => setDateA(e.target.value)}
                    >
                      {dates.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                    <span>→</span>
                    <select
                      aria-label="Comparison date B"
                      value={b}
                      onChange={(e) => setDateB(e.target.value)}
                    >
                      {dates.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  {comparison.warning && (
                    <p className="notice">{comparison.warning}</p>
                  )}
                  <Card title="Overall difference">
                    <Table
                      label="Date comparison metrics"
                      rows={comparison.metrics}
                      columns={[
                        col("metric", "Metric", true),
                        col("a", "Day A"),
                        col("b", "Day B"),
                        {
                          key: "delta",
                          label: "Δ",
                          value: (r) => r.delta,
                          render: (r) => signed(r.delta),
                        },
                        {
                          key: "percent",
                          label: "Δ %",
                          value: (r) => r.deltaPercent,
                          render: (r) =>
                            r.deltaPercent === null
                              ? "—"
                              : (r.deltaPercent > 0 ? "+" : "") +
                                percent(r.deltaPercent),
                        },
                      ]}
                    />
                  </Card>
                  <Card title="Language difference">
                    <Table
                      label="Date comparison languages"
                      rows={comparison.languages}
                      columns={[
                        col("language", "Language", true),
                        col("category", "Category"),
                        col("linesA", "Lines A"),
                        col("linesB", "Lines B"),
                        col("codeA", "Code A"),
                        col("codeB", "Code B"),
                        col("deltaLines", "Δ lines"),
                        col("deltaCode", "Δ code"),
                      ]}
                    />
                  </Card>
                  <Card title={"Project values as of " + b}>
                    <Table
                      label="Effective project values"
                      rows={effectiveLines(state.daily, b, selectedIds)}
                      columns={[
                        {
                          key: "name",
                          label: "Project",
                          value: (r) => r.entry.name,
                          path: true,
                        },
                        {
                          key: "date",
                          label: "Scanned on",
                          value: (r) => r.scannedOn,
                        },
                        {
                          key: "carried",
                          label: "Carried forward",
                          value: (r) => (r.isCarried ? "Yes" : "No"),
                        },
                        {
                          key: "lines",
                          label: "Physical lines",
                          value: (r) => r.entry.physicalLines,
                        },
                        {
                          key: "tokens",
                          label: "Tokens",
                          value: (r) => r.entry.tokens,
                        },
                      ]}
                    />
                  </Card>
                </>
              ) : (
                <Empty title="Your timeline starts here">
                  Every completed scan records today’s project values. AI
                  refreshes add daily usage.
                </Empty>
              )}
            </>
          )}
          {page === "AI usage" && (
            <>
              <div className="toolbar section-toolbar">
                <button
                  className="primary"
                  disabled={!!busy}
                  onClick={() => {
                    aiOpened.current = true;
                    void execute("ai");
                  }}
                >
                  <RefreshCw size={15} />
                  Refresh
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => {
                    aiOpened.current = true;
                    void execute("ai", undefined, true);
                  }}
                >
                  Full rescan
                </button>
                <div className="spacer" />
                <button
                  disabled={!!busy || !state.ai?.combined}
                  onClick={() => {
                    void window.codelines
                      .openReport()
                      .catch((e) => setError(String(e)));
                  }}
                >
                  Open in browser
                </button>
                {state.ai?.combined && toolbarExport("ai", true)}
              </div>
              {state.ai ? (
                <Reports result={state.ai} />
              ) : (
                <Empty title="A clearer picture of AI usage">
                  Refresh to read local coding-agent usage. Cache reads and
                  writes count toward real tokens.
                </Empty>
              )}
              <Card title="Agent sources">
                <Table<AgentStatus>
                  label="AI adapter status"
                  rows={
                    state.ai?.agents ??
                    Object.entries(agentLabels).map(([id, label]) => ({
                      id,
                      label,
                      state: "NotFound",
                      records: 0,
                      elapsed: 0,
                      error: undefined,
                    }))
                  }
                  columns={[
                    col("label", "Agent", true),
                    col("state", "Status"),
                    col("records", "Records"),
                    {
                      key: "error",
                      label: "Details",
                      value: (r) => r.error ?? "",
                    },
                  ]}
                />
              </Card>
            </>
          )}
          {page === "Settings" && (
            <>
              <div className="toolbar section-toolbar">
                <p className="muted">
                  Changes take effect when saved or used by an analysis.
                </p>
                <div className="spacer" />
                <button
                  disabled={!!busy || !dirty}
                  onClick={() => setDraft(structuredClone(state.settings))}
                >
                  Discard edits
                </button>
                <button
                  className="primary"
                  disabled={!!busy}
                  onClick={() => void save()}
                >
                  Save settings
                </button>
              </div>
              <fieldset disabled={!!busy}>
                <Card
                  title="Analysis defaults"
                  subtitle="Exact counts, calculated entirely offline"
                >
                  <div className="settings-grid">
                    <Field label="Counting scope">
                      <select
                        value={draft.scanOptions.countingScope}
                        onChange={(e) =>
                          change((s) => {
                            s.scanOptions.countingScope = e.target
                              .value as Settings["scanOptions"]["countingScope"];
                          })
                        }
                      >
                        {scopes.map((s) => (
                          <option key={s} value={s}>
                            {scopeLabel(s)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Tokenizer">
                      <select
                        value={draft.scanOptions.tokenizerEncoding}
                        onChange={(e) =>
                          change((s) => {
                            s.scanOptions.tokenizerEncoding = e.target.value as
                              "o200k_base" | "cl100k_base";
                          })
                        }
                      >
                        <option>o200k_base</option>
                        <option>cl100k_base</option>
                      </select>
                    </Field>
                    <Field label="Maximum file size (MB)">
                      <input
                        type="number"
                        min={0.01}
                        max={1024}
                        step={0.1}
                        value={draft.scanOptions.maxFileSizeBytes / 1024 ** 2}
                        onChange={(e) =>
                          change((s) => {
                            s.scanOptions.maxFileSizeBytes = Math.round(
                              Number(e.target.value) * 1024 ** 2,
                            );
                          })
                        }
                      />
                    </Field>
                    <Field label="Scan concurrency">
                      <input
                        type="number"
                        min={1}
                        max={128}
                        value={draft.scanOptions.maxDegreeOfParallelism}
                        onChange={(e) =>
                          change((s) => {
                            s.scanOptions.maxDegreeOfParallelism = Number(
                              e.target.value,
                            );
                          })
                        }
                      />
                    </Field>
                    <Field label="Appearance">
                      <select
                        value={draft.theme}
                        onChange={(e) =>
                          change((s) => {
                            s.theme = e.target.value as Settings["theme"];
                          })
                        }
                      >
                        {["System", "Light", "Dark"].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field
                    label="Global exclusions"
                    help="One .gitignore-style rule per line; project exclusions are applied last."
                  >
                    <textarea
                      className="mono"
                      rows={8}
                      value={draft.scanOptions.globalExcludePatterns.join("\n")}
                      onChange={(e) =>
                        change((s) => {
                          s.scanOptions.globalExcludePatterns = split(
                            e.target.value,
                          );
                        })
                      }
                    />
                  </Field>
                </Card>
                <Card title="Git history">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.gitHistory.enabled}
                      onChange={(e) =>
                        change((s) => {
                          s.gitHistory.enabled = e.target.checked;
                        })
                      }
                    />
                    Enable Git history statistics
                  </label>
                  <p className="muted">
                    Uses the installed Git executable. Source scans and reports
                    do not require Git.
                  </p>
                </Card>
                <Card
                  title="AI usage"
                  subtitle="Equivalent API costs from local logs; no accounts or API keys"
                >
                  <div className="check-list">
                    {(
                      [
                        { label: "Show AI usage page", key: "enabled" },
                        {
                          label: "Refresh when first opened in this session",
                          key: "autoRefreshOnOpen",
                        },
                        {
                          label:
                            "Count each Claude request once (off = raw records)",
                          key: "deduplicate",
                        },
                        { label: "Bucket AI usage in UTC", key: "useUtc" },
                      ] as const
                    ).map(({ label, key }) => (
                      <label className="check" key={key}>
                        <input
                          type="checkbox"
                          checked={draft.aiUsage[key]}
                          onChange={(e) =>
                            change((s) => {
                              s.aiUsage[key] = e.target.checked;
                            })
                          }
                        />
                        {label}
                      </label>
                    ))}
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.dailyLog.refreshAiAfterScan}
                        onChange={(e) =>
                          change((s) => {
                            s.dailyLog.refreshAiAfterScan = e.target.checked;
                          })
                        }
                      />
                      Refresh AI usage after every scan
                    </label>
                  </div>
                  <h3>Agents</h3>
                  <div className="agents-grid">
                    {Object.entries(agentLabels).map(([id, label]) => (
                      <label className="check" key={id}>
                        <input
                          type="checkbox"
                          checked={!draft.aiUsage.disabledAgents.includes(id)}
                          onChange={(e) =>
                            change((s) => {
                              s.aiUsage.disabledAgents =
                                s.aiUsage.disabledAgents.filter(
                                  (x) => x !== id,
                                );
                              if (!e.target.checked)
                                s.aiUsage.disabledAgents.push(id);
                            })
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Field label="Extra Claude transcript folders (one per line)">
                    <textarea
                      className="mono"
                      value={draft.aiUsage.extraClaudeRoots.join("\n")}
                      onChange={(e) =>
                        change((s) => {
                          s.aiUsage.extraClaudeRoots = split(e.target.value);
                        })
                      }
                    />
                  </Field>
                </Card>
              </fieldset>
              <Card
                title="Local data & migration"
                subtitle="Import existing CodeLines projects, settings, snapshots, history, and daily records"
              >
                <p className="mono selectable" title={state.dataDirectory}>
                  {state.dataDirectory}
                </p>
                <p className="muted">
                  Data uses a separate directory. Imports preserve legacy files,
                  keep recovery copies, and can be repeated safely.
                </p>
                <button
                  disabled={!!busy}
                  onClick={() =>
                    void act(
                      () => window.codelines.migrate(),
                      "Legacy data migration finished",
                    )
                  }
                >
                  Import legacy CodeLines data
                </button>
              </Card>
            </>
          )}
          {state.warnings.length > 0 && (
            <details className="system-notices">
              <summary>
                {state.warnings.length} data or recovery notices
              </summary>
              <ul>
                {state.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </main>
        <footer className="statusbar" aria-live="polite">
          <span className={busy ? "working-dot" : "online-dot"} />
          <span title={status}>{status}</span>
          <div className="spacer" />
          <span>
            {busy
              ? "Processing locally"
              : dirty
                ? "Unsaved changes"
                : "All data stays local"}
          </span>
        </footer>
      </div>
    </div>
  );
}

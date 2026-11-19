import type { ComponentType } from "react";
import {
  Play,
  Download,
  RefreshCw,
  Square,
  ShieldCheck,
  Monitor,
  Sun,
  Moon,
} from "lucide-react";
import type { Settings } from "../../../shared/contracts";
import { Card } from "../../components";
import { duration, lines, number, scopeOptions, tokenizerOptions } from "../../format";
import { Select } from "../../ui/Select";
import { PageTransition } from "../../PageTransition";
import { DesktopShell } from "../../TitleBar";
import { useWorkspace } from "../../workspace";
import type { Page as PageName, ShellProps } from "../../pages";
import { Dashboard } from "../../pages/Dashboard";
import { Projects } from "../../pages/Projects";
import { Analysis } from "../../pages/Analysis";
import { CodeChanges } from "../../pages/CodeChanges";
import { DailyLog } from "../../pages/DailyLog";
import { AiUsage } from "../../pages/AiUsage";
import { SettingsPage } from "../../pages/SettingsPage";
const bodies: Record<PageName, ComponentType> = {
  Dashboard,
  Projects,
  Analysis,
  "Code changes": CodeChanges,
  "Daily log": DailyLog,
  "AI usage": AiUsage,
  Settings: SettingsPage,
};
export function ClassicLoading({ error }: { error: string }) {
  return (
    <DesktopShell>
      <main className="loading">
        <h1>CodeLines</h1>
        <p>{error || "Opening your local workspace…"}</p>
      </main>
    </DesktopShell>
  );
}
/** The original CodeLines layout: a sidebar, a page header and a status bar. */
export function ClassicShell({ page: current, visible, setPage }: ShellProps) {
  const Body = bodies[current.name];
  return (
    <DesktopShell tools>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              CL
            </div>
            <div>
              <strong>CodeLines</strong>
              <span>Project intelligence</span>
            </div>
          </div>
          <nav aria-label="Main navigation">
            {visible.map(({ name, icon: Icon }) => (
              <button
                key={name}
                aria-current={current.name === name ? "page" : undefined}
                className={current.name === name ? "active" : ""}
                onClick={() => setPage(name)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{name}</span>
              </button>
            ))}
          </nav>
          <div className="privacy">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>Local by design</strong>
              <p>Your source and usage stay on this computer.</p>
            </div>
          </div>
          <ThemeSwitch />
        </aside>
        <div className="workspace">
          <PageTransition page={current.name}>
            <PageHeader
              name={current.name}
              hint={current.hint}
              scan={!!current.scan}
            />
            <Alerts />
            <Body />
            <SystemNotices />
          </PageTransition>
          <StatusBar />
        </div>
      </div>
    </DesktopShell>
  );
}
function PageHeader({
  name,
  hint,
  scan,
}: {
  name: PageName;
  hint: string;
  scan: boolean;
}) {
  const { state, draft, busy, change, execute } = useWorkspace();
  const ai = name === "AI usage";
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{hint}</span>
        <h1>{name}</h1>
        <p>
          {ai
            ? state.ai
              ? "Latest AI refresh " +
                new Date(state.ai.generatedAt).toLocaleString()
              : "Refresh to read local AI agent usage."
            : state.settings.lastSnapshot
              ? "Latest scan " +
                new Date(state.settings.lastSnapshot.scannedAt).toLocaleString()
              : "A clearer view starts with your first scan."}
        </p>
      </div>
      <div className="toolbar wrap header-actions">
        {scan && (
          <>
            <Select
              aria-label="Counting scope"
              disabled={!!busy}
              value={draft.scanOptions.countingScope}
              options={scopeOptions}
              onChange={(v) =>
                change((s) => {
                  s.scanOptions.countingScope = v;
                })
              }
            />
            <Select
              aria-label="Tokenizer"
              disabled={!!busy}
              value={draft.scanOptions.tokenizerEncoding}
              options={tokenizerOptions}
              onChange={(v) =>
                change((s) => {
                  s.scanOptions.tokenizerEncoding = v;
                })
              }
            />
            <button
              className="primary"
              disabled={!!busy || !draft.projects.some((p) => p.isEnabled)}
              onClick={() => void execute("scan")}
            >
              <Play size={15} />
              Scan all projects
            </button>
          </>
        )}
        {ai && <AiActions />}
      </div>
    </header>
  );
}
const themes = [
  { value: "System", icon: Monitor },
  { value: "Light", icon: Sun },
  { value: "Dark", icon: Moon },
] as const;
function ThemeSwitch() {
  const { draft, busy, setTheme } = useWorkspace();
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Appearance">
      {themes.map(({ value, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={draft.theme === value}
          aria-label={value + " theme"}
          title={value + " theme"}
          disabled={!!busy}
          onClick={(e) => void setTheme(value as Settings["theme"], e.currentTarget)}
        >
          <Icon size={15} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
function AiActions() {
  const { state, busy, execute, exportData, setError } = useWorkspace();
  const ready = !!state.ai?.combined;
  return (
    <>
      <button
        className="primary"
        disabled={!!busy}
        onClick={() => void execute("ai")}
      >
        <RefreshCw size={15} />
        Refresh
      </button>
      <button disabled={!!busy} onClick={() => void execute("ai", undefined, true)}>
        Full rescan
      </button>
      <button
        disabled={!!busy || !ready}
        onClick={() => {
          void window.codelines.openReport().catch((e: unknown) => setError(e));
        }}
      >
        Open in browser
      </button>
      {ready && (
        <>
          <button
            disabled={!!busy}
            onClick={() => void exportData("ai", "html")}
          >
            <Download size={15} />
            Export HTML
          </button>
          <button
            disabled={!!busy}
            onClick={() => void exportData("ai", "json")}
          >
            JSON
          </button>
        </>
      )}
    </>
  );
}
function Alerts() {
  const { error, setError, busy, progress, cancel } = useWorkspace();
  return (
    <>
      {error && (
        <div className="error" role="alert">
          <div>
            <strong>Something needs attention</strong>
            <p>{error}</p>
          </div>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {busy && (
        <Card className="progress-card">
          <div className="toolbar wrap">
            <strong>{progress?.stage ?? "Starting background worker…"}</strong>
            <div className="spacer" />
            <button onClick={cancel}>
              <Square size={13} />
              Cancel
            </button>
          </div>
          <p>
            {lines([
              progress?.project,
              progress?.projectIndex !== undefined &&
                `Project ${progress.projectIndex + 1}/${progress.projectCount}`,
              `${duration(progress?.elapsed ?? 0)} elapsed`,
              !!progress?.eta &&
                `Current project ETA ≈ ${duration(progress.eta)}`,
            ])}
          </p>
          <progress
            max={progress?.total ?? undefined}
            value={progress?.total == null ? undefined : progress.completed}
          />
          <div className="progress-detail">
            <span>
              {lines([
                progress?.total != null
                  ? `${number(progress.completed)}/${number(progress.total)} ${busy.kind === "history" ? "comparisons" : "items"} complete`
                  : "Discovering work; remaining count not known yet",
                progress?.totalFiles !== undefined &&
                  `Current comparison files ${progress.completedFiles}/${progress.totalFiles}`,
              ])}
            </span>
            <span title={progress?.path}>{progress?.path}</span>
          </div>
        </Card>
      )}
    </>
  );
}
function SystemNotices() {
  const { state } = useWorkspace();
  if (!state.warnings.length) return null;
  return (
    <details className="system-notices">
      <summary>
        {state.warnings.length} data or recovery{" "}
        {state.warnings.length === 1 ? "notice" : "notices"}
      </summary>
      <ul>
        {state.warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </details>
  );
}
function StatusBar() {
  const { status, busy, dirty, save } = useWorkspace();
  return (
    <footer className="statusbar">
      <span className={busy ? "working-dot" : "online-dot"} aria-hidden="true" />
      <span title={status} role="status" aria-live="polite">
        {status}
      </span>
      <div className="spacer" />
      {dirty && !busy ? (
        <button className="statusbar-save" onClick={() => void save()}>
          Unsaved changes · Save
        </button>
      ) : (
        <span>{busy ? "Processing locally" : "All data stays local"}</span>
      )}
    </footer>
  );
}

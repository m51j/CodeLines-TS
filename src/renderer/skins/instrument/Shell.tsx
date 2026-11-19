/**
 * The Instrument shell: navigation inside the frameless title bar, a page masthead, alerts, and the
 * bottom edge (notices, operation dock, status bar). Pages slide in from the side of the tab you
 * moved toward.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { pageDefs, type Page, type PageDef, type ShellProps } from "../../pages";
import { scopes, type Settings } from "../../../shared/contracts";
import { scopeLabel } from "../../format";
import { play } from "../../motion/core";
import { useWindowControls } from "../../window";
import { useWorkspace } from "../../workspace";
import { SkinContext, type SkinApi } from "./context";
import { dateTime } from "./format";
import { Icon } from "./icons";
import { finishBoot } from "./Loading";
import { initSimpleTips, tip } from "./overlay";
import { Palette } from "./Palette";
import { Dock, Notices, StatusBar } from "./StatusBar";
import { TitleBar } from "./TitleBar";
import { Button, Select } from "./ui/controls";
import { Toasts, toast } from "./ui/overlays";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { Analysis } from "./pages/Analysis";
import { CodeChanges } from "./pages/CodeChanges";
import { DailyLog } from "./pages/DailyLog";
import { AiUsage } from "./pages/AiUsage";
import { SettingsPage } from "./pages/Settings";
const bodies: Record<Page, ComponentType> = {
  Dashboard,
  Projects,
  Analysis,
  "Code changes": CodeChanges,
  "Daily log": DailyLog,
  "AI usage": AiUsage,
  Settings: SettingsPage,
};
function ScanActions() {
  const { draft, busy, change, execute } = useWorkspace();
  return (
    <>
      <Select
        label="Counting scope"
        value={draft.scanOptions.countingScope}
        disabled={!!busy}
        options={scopes.map((s) => [s, scopeLabel(s)] as [string, string])}
        onChange={(v) =>
          change((s) => {
            s.scanOptions.countingScope = v as Settings["scanOptions"]["countingScope"];
          })
        }
      />
      <Select
        label="Tokenizer"
        value={draft.scanOptions.tokenizerEncoding}
        disabled={!!busy}
        options={["o200k_base", "cl100k_base"]}
        onChange={(v) =>
          change((s) => {
            s.scanOptions.tokenizerEncoding = v as "o200k_base" | "cl100k_base";
          })
        }
      />
      <Button
        label="Scan all projects"
        primary
        icon="play"
        tip="Scan every enabled project · Ctrl+Enter"
        disabled={!!busy || !draft.projects.some((p) => p.isEnabled)}
        onClick={() => void execute("scan")}
      />
    </>
  );
}
function AiActions() {
  const { state, busy, execute, exportData, setError } = useWorkspace();
  const ready = !!state.ai?.combined;
  return (
    <>
      <Button label="Refresh" primary icon="refresh" disabled={!!busy} onClick={() => void execute("ai")} />
      <Button label="Full rescan" disabled={!!busy} tip="Ignore the incremental cache and read every record again" onClick={() => void execute("ai", undefined, true)} />
      <Button
        label="Open in browser"
        icon="external"
        disabled={!!busy || !ready}
        onClick={() => {
          void window.codelines.openReport().catch((e: unknown) => setError(e));
        }}
      />
      {ready && (
        <>
          <Button label="Export HTML" icon="download" disabled={!!busy} onClick={() => void exportData("ai", "html")} />
          <Button label="JSON" disabled={!!busy} onClick={() => void exportData("ai", "json")} />
        </>
      )}
    </>
  );
}
function Mast({ page }: { page: PageDef }) {
  const { state } = useWorkspace();
  const ai = page.name === "AI usage";
  return (
    <header className="mast">
      <div className="mast-text">
        <span className="eyebrow">{page.hint}</span>
        <h1>{page.name}</h1>
        <p className="mast-sub">
          {ai
            ? state.ai
              ? "Latest AI refresh " + dateTime(state.ai.generatedAt)
              : "Refresh to read local AI agent usage."
            : state.settings.lastSnapshot
              ? "Latest scan " + dateTime(state.settings.lastSnapshot.scannedAt)
              : "A clearer view starts with your first scan."}
        </p>
      </div>
      <div className="mast-actions">
        {page.scan && <ScanActions />}
        {ai && <AiActions />}
      </div>
    </header>
  );
}
/** The error alert slides in under the masthead and leaves upward when dismissed. */
function Alerts() {
  const { error, setError } = useWorkspace();
  const [shown, setShown] = useState(error);
  const el = useRef<HTMLDivElement>(null);
  if (error && error !== shown) setShown(error);
  useLayoutEffect(() => {
    if (error) play(el.current, [{ opacity: 0, transform: "translateY(-10px) scale(.99)" }, { opacity: 1, transform: "none" }], { duration: 280 });
  }, [error]);
  useEffect(() => {
    if (error || !shown) return;
    const a = play(el.current, [{ opacity: 1 }, { opacity: 0, transform: "translateY(-6px)" }], { duration: 140, fill: "forwards" });
    const t = setTimeout(() => setShown(""), a ? 200 : 0);
    return () => clearTimeout(t);
  }, [error, shown]);
  return (
    <div className="alerts">
      {shown && (
        <div ref={el} className="alert" role="alert">
          <Icon name="alert" size={18} />
          <div>
            <strong>Something needs attention</strong>
            <p>{shown}</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
const order = (p: Page) => pageDefs.findIndex((d) => d.name === p);
export function InstrumentShell({ page, visible, setPage }: ShellProps) {
  const ws = useWorkspace();
  const win = useWindowControls();
  const [palette, setPalette] = useState(false),
    [noticesOpen, setNoticesOpen] = useState(false),
    [aiAgent, setAiAgent] = useState("all");
  const titlebar = useRef<HTMLElement>(null),
    statusbar = useRef<HTMLElement>(null),
    host = useRef<HTMLDivElement>(null),
    view = useRef<HTMLElement>(null),
    pageEl = useRef<HTMLDivElement>(null),
    previous = useRef(page.name);
  const go = useCallback((p: Page) => setPage(p), [setPage]);
  const openPalette = useCallback(() => setPalette(true), []);
  const api = useMemo<SkinApi>(() => ({ go, aiAgent, setAiAgent, openPalette }), [go, aiAgent, openPalette]);
  // Tooltips and the boot hand-over.
  useEffect(() => initSimpleTips(), []);
  useLayoutEffect(
    () =>
      finishBoot(() => {
        play(titlebar.current, [{ opacity: 0, transform: "translateY(-100%)" }, { opacity: 1, transform: "none" }], { duration: 420 });
        play(statusbar.current, [{ opacity: 0, transform: "translateY(100%)" }, { opacity: 1, transform: "none" }], { duration: 420 });
        play(host.current, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: 60 });
      }),
    [],
  );
  // Direction-aware page transition: slide in from the side of the tab you moved toward.
  useLayoutEffect(() => {
    const from = previous.current;
    if (from === page.name) return;
    previous.current = page.name;
    tip.hide();
    if (view.current) view.current.scrollTop = 0;
    const dir = Math.sign(order(page.name) - order(from)) || 1;
    play(pageEl.current, [{ opacity: 0, transform: `translateX(${dir * 28}px)` }, { opacity: 1, transform: "none" }], { duration: 320 });
  }, [page.name]);
  // Keyboard: Ctrl+K palette, Ctrl+S save, Ctrl+Enter scan, Alt+1…7 pages, / table search.
  const latest = useRef({ ws, page, visible });
  latest.current = { ws, page, visible };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { ws, page, visible } = latest.current;
      const mod = e.ctrlKey || e.metaKey,
        target = e.target as HTMLElement,
        typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (ws.dirty && !ws.busy) void ws.save();
        return;
      }
      if (mod && e.key === "Enter" && page.scan && !ws.busy && ws.draft.projects.some((p) => p.isEnabled)) {
        e.preventDefault();
        void ws.execute("scan");
        return;
      }
      if (e.altKey && !mod && /^[1-7]$/.test(e.key)) {
        const p = visible[Number(e.key) - 1];
        if (p) {
          e.preventDefault();
          setPage(p.name);
        }
        return;
      }
      if (e.key === "/" && !typing && !mod && !document.querySelector(".pal-back")) {
        const box = [...(host.current?.querySelectorAll<HTMLInputElement>(".dt-search") ?? [])].find((x) => x.offsetParent && !x.closest("[hidden]"));
        if (box) {
          e.preventDefault();
          box.focus();
          box.scrollIntoView({ block: "center", behavior: document.documentElement.dataset.motion === "reduce" ? "auto" : "smooth" });
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setPage]);
  useEffect(() => {
    if (!ws.state.warnings.length) setNoticesOpen(false);
  }, [ws.state.warnings.length]);
  // A finished operation, an export or a save is confirmed by a toast.
  const lastStatus = useRef(ws.status);
  useEffect(() => {
    const s = ws.status;
    if (s === lastStatus.current) return;
    lastStatus.current = s;
    if (/^Exported /.test(s)) toast("Exported " + (s.split(/[\\/]/).pop() ?? ""), { icon: "download" });
    else if (!ws.busy && /complete|Project added|imported|migration finished|Settings saved/.test(s)) toast(s, { icon: "check" });
  }, [ws.status, ws.busy]);
  const Body = bodies[page.name];
  return (
    <SkinContext.Provider value={api}>
      <div className={"window is-max" + (win.state.focused ? "" : " is-unfocused")} data-busy={ws.busy ? "" : undefined}>
        <TitleBar ref={titlebar} current={page.name} visible={visible} go={go} openPalette={openPalette} win={win} />
        <main ref={view} className="view" tabIndex={-1}>
          <div ref={host} className="page-host">
            <div ref={pageEl} key={page.name} className="page" data-page={page.name.toLowerCase().replace(/\s+/g, "-")}>
              <Mast page={page} />
              <Alerts />
              <div className="page-body">
                <Body />
              </div>
            </div>
          </div>
        </main>
        <Notices open={noticesOpen} onClose={() => setNoticesOpen(false)} />
        <Dock />
        <StatusBar ref={statusbar} noticesOpen={noticesOpen} toggleNotices={() => setNoticesOpen(!noticesOpen)} />
        <Toasts />
        {palette && <Palette visible={visible} onClose={() => setPalette(false)} />}
      </div>
    </SkinContext.Provider>
  );
}

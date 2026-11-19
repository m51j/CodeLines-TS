/**
 * The Linework shell: title bar, line rail, masthead, alerts, the page and the status line,
 * with the overlays (tooltip, toasts, command palette). Page changes rise from the
 * direction of travel along the rail with the masthead and blocks staggered; the title
 * slides out of a mask and the page numeral rolls like an odometer.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { pageDefs, type Page, type ShellProps } from "../../pages";
import { reduced } from "../../motion/core";
import { useWorkspace } from "../../workspace";
import { ShellContext, type AnalysisTab, type Shell } from "./context";
import { BootCurtain, takeBoot } from "./Loader";
import { Masthead } from "./Masthead";
import { Palette } from "./Palette";
import { Rail } from "./Rail";
import { Alerts, Notices, StatusLine } from "./Status";
import { TitleBar } from "./TitleBar";
import { TipLayer } from "./ui/tip";
import { Toasts, toast } from "./ui/toast";
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
const easing = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/** Status changes worth a toast: finished, cancelled or failed operations, saves and file actions. */
const toastFor = (status: string): "ok" | "info" | "error" | null =>
  /failed/i.test(status)
    ? "error"
    : /cancelled/i.test(status)
      ? "info"
      : /complete|Exported|saved|added|imported|finished|discarded/i.test(status)
        ? "ok"
        : null;

export function LineworkShell({ page, visible, setPage }: ShellProps) {
  const ws = useWorkspace();
  const root = useRef<HTMLDivElement>(null),
    scroller = useRef<HTMLDivElement>(null),
    masthead = useRef<HTMLElement>(null),
    main = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(() => innerWidth < 1000),
    [palette, setPalette] = useState<null | "commands" | "shortcuts">(null),
    [projectSel, setProjectSel] = useState(""),
    [boot, setBoot] = useState(() => takeBoot());
  const analysisTab = useRef<AnalysisTab | null>(null);
  const visibleNames = useMemo(() => visible.map((p) => p.name), [visible]);

  const go = useCallback(
    (p: Page, opts?: { tab?: AnalysisTab }) => {
      if (opts?.tab) analysisTab.current = opts.tab;
      setPage(p);
    },
    [setPage],
  );
  const toggleRail = useCallback(() => setCollapsed((c) => !c), []);
  const shell = useMemo<Shell>(
    () => ({
      go,
      takeAnalysisTab: () => {
        const t = analysisTab.current;
        analysisTab.current = null;
        return t;
      },
      scroller,
      projectSel,
      setProjectSel,
      openPalette: (mode = "commands") => setPalette(mode),
      visible: visibleNames,
    }),
    [go, projectSel, visibleNames],
  );

  // Page change: direction follows the rail; blocks stagger in; title and numeral roll.
  const previous = useRef(page.name);
  useLayoutEffect(() => {
    const from = previous.current;
    if (from === page.name) return;
    previous.current = page.name;
    if (scroller.current) scroller.current.scrollTop = 0;
    const dir = pageDefs.findIndex((p) => p.name === page.name) >= pageDefs.findIndex((p) => p.name === from) ? 1 : -1;
    const mh = masthead.current,
      body = main.current;
    if (!mh || !body) return;
    if (reduced()) {
      body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 90 });
      return;
    }
    [...mh.children, ...body.children].slice(0, 9).forEach((el, i) =>
      el.animate([{ opacity: 0, transform: `translateY(${dir * 14}px)` }, { opacity: 1, transform: "none" }], {
        duration: 300,
        delay: i * 32,
        easing,
        fill: "backwards",
      }),
    );
    mh.querySelector(".mh-title")?.animate([{ transform: "translateY(105%)" }, { transform: "none" }], { duration: 360, easing });
    mh.querySelector(".mh-num")?.animate([{ transform: `translateY(${dir * 40}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], {
      duration: 420,
      easing,
    });
  }, [page.name]);

  // The entrance after the opening: the window rises, stations slide in, tiles cascade.
  const entrance = useCallback(() => {
    const el = root.current;
    if (!el || reduced()) return;
    el.querySelector(".win-body")?.animate([{ opacity: 0, transform: "translateY(14px) scale(0.985)" }, { opacity: 1, transform: "none" }], {
      duration: 420,
      easing,
    });
    el.querySelectorAll(".st-item:not(.gone)").forEach((s, i) =>
      s.animate([{ opacity: 0, transform: "translateX(-10px)" }, { opacity: 1, transform: "none" }], {
        duration: 300,
        delay: 120 + i * 40,
        easing,
        fill: "backwards",
      }),
    );
    el.querySelectorAll(".page .tile, .page .metric, .page .footprint").forEach((t, i) =>
      t.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], {
        duration: 340,
        delay: 200 + i * 45,
        easing,
        fill: "backwards",
      }),
    );
  }, []);

  // Finished operations, saves and exports also show a toast.
  const lastStatus = useRef(ws.status);
  useEffect(() => {
    if (lastStatus.current === ws.status) return;
    lastStatus.current = ws.status;
    const kind = toastFor(ws.status);
    if (kind) toast(ws.status, kind);
  }, [ws.status]);

  // Ctrl+K palette, Ctrl+S save, Alt+1…7 pages, ? shortcuts.
  const keys = useRef({ ws, visible, go });
  keys.current = { ws, visible, go };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const { ws, visible, go } = keys.current;
      const typing = (e.target as Element | null)?.matches?.("input, textarea, select, [contenteditable]");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => (p ? null : "commands"));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (ws.dirty && !ws.busy) void ws.save();
      } else if (e.altKey && /^[1-9]$/.test(e.key)) {
        const p = visible[Number(e.key) - 1];
        if (p) {
          e.preventDefault();
          go(p.name);
        }
      } else if (e.key === "?" && !typing) {
        e.preventDefault();
        setPalette((p) => p ?? "shortcuts");
      }
    };
    addEventListener("keydown", down);
    return () => removeEventListener("keydown", down);
  }, []);

  const Body = bodies[page.name];
  const index = visible.findIndex((p) => p.name === page.name) + 1;
  return (
    <ShellContext.Provider value={shell}>
      <div className="window" ref={root}>
        <a className="skip-link" href="#lw-page">
          Skip to content
        </a>
        <TitleBar />
        <div className="win-body">
          <Rail page={page} visible={visible} go={(p) => go(p)} collapsed={collapsed} onCollapse={toggleRail} />
          <div className="main">
            <div className="scroller" ref={scroller}>
              <div className="page-wrap">
                <Masthead ref={masthead} page={page} index={index} />
                <Alerts />
                <main id="lw-page" className="page" tabIndex={-1} key={page.name} ref={main} data-page={page.name}>
                  <Body />
                </main>
                <Notices />
              </div>
            </div>
            <StatusLine />
          </div>
        </div>
      </div>
      <TipLayer />
      <Toasts />
      {palette && <Palette key={palette} mode={palette} onClose={() => setPalette(null)} toggleRail={toggleRail} />}
      {boot !== null && <BootCurtain start={boot} onLift={entrance} onDone={() => setBoot(null)} />}
    </ShellContext.Provider>
  );
}

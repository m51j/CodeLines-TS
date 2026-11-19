/**
 * The frameless title bar: brand (About), page tabs with a sliding indicator, the command palette
 * button, widget and appearance tools, the caption buttons and the progress lifeline.
 */
import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { pageDefs, type Page, type PageDef } from "../../pages";
import type { useWindowControls } from "../../window";
import { useWorkspace } from "../../workspace";
import { LookControls } from "./Appearance";
import { progressFraction } from "./format";
import { Icon, Logo, type IconName } from "./icons";
import { Popover, usePopover } from "./ui/overlays";
import { appVersion, developer, openAboutLink } from "../../about";
import { NexteLogo } from "../../ui/NexteLogo";
export const pageIcons: Record<Page, IconName> = {
  Dashboard: "dashboard",
  Projects: "folder",
  Analysis: "analysis",
  "Code changes": "branch",
  "Daily log": "calendar",
  "AI usage": "spark",
  Settings: "settings",
};
type NavEntry = { def: PageDef; state: "on" | "entering" | "leaving" };
/**
 * Tabs for the visible pages. A page switched off in Settings collapses in place before it leaves
 * the DOM; a page switched on expands from nothing.
 */
function Nav({ current, visible, go }: { current: Page; visible: PageDef[]; go: (p: Page) => void }) {
  const [entries, setEntries] = useState<NavEntry[]>(() => visible.map((def) => ({ def, state: "on" })));
  const names = visible.map((p) => p.name).join("|");
  useEffect(() => {
    const vis = new Set(names.split("|"));
    setEntries((prev) => {
      const had = new Set(prev.map((e) => e.def.name));
      return pageDefs
        .filter((d) => vis.has(d.name) || had.has(d.name))
        .map((def) => {
          const old = prev.find((e) => e.def.name === def.name);
          if (!vis.has(def.name)) return { def, state: "leaving" };
          if (!old || old.state === "leaving") return { def, state: old ? "on" : "entering" };
          return old;
        });
    });
  }, [names]);
  useEffect(() => {
    if (entries.some((e) => e.state === "entering")) {
      const id = requestAnimationFrame(() => setEntries((prev) => prev.map((e) => (e.state === "entering" ? { ...e, state: "on" } : e))));
      return () => cancelAnimationFrame(id);
    }
    if (entries.some((e) => e.state === "leaving")) {
      const t = setTimeout(() => setEntries((prev) => prev.filter((e) => e.state !== "leaving")), 340);
      return () => clearTimeout(t);
    }
  }, [entries]);
  const nav = useRef<HTMLElement>(null),
    ind = useRef<HTMLElement>(null),
    placed = useRef(false);
  const move = (animate: boolean) => {
    const b = nav.current?.querySelector<HTMLElement>('.nav-btn[aria-current="page"]'),
      i = ind.current;
    if (!b || !i) return;
    if (!animate) i.style.transition = "none";
    i.style.width = b.offsetWidth + "px";
    i.style.transform = `translateX(${b.offsetLeft}px)`;
    if (!animate) {
      void i.offsetWidth;
      i.style.transition = "";
    }
  };
  const moveRef = useRef(move);
  moveRef.current = move;
  useLayoutEffect(() => {
    moveRef.current(placed.current);
    placed.current = true;
  }, [current, entries]);
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const ro = new ResizeObserver(() => moveRef.current(false));
    ro.observe(el);
    const end = (e: TransitionEvent) => {
      if ((e.target as Element).classList.contains("nav-btn")) moveRef.current(false);
    };
    el.addEventListener("transitionend", end);
    return () => {
      ro.disconnect();
      el.removeEventListener("transitionend", end);
    };
  }, []);
  let n = 0;
  return (
    <nav ref={nav} className="nav" aria-label="Main navigation">
      <i ref={ind} className="nav-ind" aria-hidden="true" />
      {entries.map(({ def, state }) => {
        const on = state !== "leaving",
          cur = def.name === current;
        if (on) n++;
        return (
          <button
            key={def.name}
            type="button"
            className={"nav-btn" + (state === "leaving" ? " is-off" : state === "entering" ? " is-entering" : "")}
            aria-label={def.name}
            aria-current={cur && on ? "page" : undefined}
            aria-hidden={on ? undefined : true}
            inert={!on}
            data-tip={on ? `${def.name} · Alt+${n}` : undefined}
            onClick={() => go(def.name)}
          >
            <Icon name={pageIcons[def.name]} size={17} />
            <span>{def.name}</span>
          </button>
        );
      })}
    </nav>
  );
}
function About({ onClose }: { onClose: () => void }) {
  const { setError } = useWorkspace();
  const keys: [string, string][] = [
    ["Ctrl K", "Command palette"],
    ["Alt 1 – 7", "Switch page"],
    ["Ctrl S", "Save changes"],
    ["Ctrl Enter", "Scan all projects"],
    ["/", "Search the table"],
    ["← →", "Tabs, charts, heatmaps"],
  ];
  return (
    <div className="pop-pad about">
      <div className="about-head">
        <Logo size={40} />
        <div>
          <strong>CodeLines</strong>
          <span>Project intelligence · v{appVersion()}</span>
        </div>
      </div>
      <p className="about-priv">
        <Icon name="shield" size={16} />
        <span>
          <b>Local by design. </b>Your source and usage stay on this computer.
        </span>
      </p>
      <dl className="about-keys">
        {keys.map(([k, v]) => (
          <div key={k}>
            <dt>
              <kbd>{k}</kbd>
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="about-dev" aria-label={`Developed by ${developer.name}. Opens ${developer.site} in your browser`} onClick={() => openAboutLink("website", setError)}>
        <span>Developed by</span>
        <NexteLogo height={13} />
        <Icon name="external" size={13} />
      </button>
      <p className="about-foot">
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => openAboutLink("repo", setError)}>
          <Icon name="code" size={14} />
          <span>GitHub</span>
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
          Close
        </button>
      </p>
    </div>
  );
}
export type WindowControls = ReturnType<typeof useWindowControls>;
export const TitleBar = forwardRef<HTMLElement, { current: Page; visible: PageDef[]; go: (p: Page) => void; openPalette: () => void; win: WindowControls }>(function TitleBar(
  { current, visible, go, openPalette, win },
  ref,
) {
  const { busy, progress, draft, setWidget } = useWorkspace();
  const { state, error, control } = win;
  const about = usePopover(),
    look = usePopover();
  const fraction = busy ? progressFraction(progress) : 0;
  return (
    <>
      <header ref={ref} className={"titlebar" + (state.focused ? "" : " titlebar-inactive")} aria-label="Application title bar">
        <button type="button" className="brand" aria-haspopup="dialog" aria-label="CodeLines — about and keyboard shortcuts" onClick={(e) => about.toggle(e.currentTarget)}>
          <Logo size={22} />
          <span className="brand-name titlebar-brand">CodeLines</span>
          <span className="brand-cap">Local workspace</span>
        </button>
        <Nav current={current} visible={visible} go={go} />
        <div className="tb-drag" aria-hidden="true" />
        <div className="tb-tools">
          <button type="button" className="tb-cmd" aria-label="Open the command palette" aria-keyshortcuts="Control+K" onClick={openPalette}>
            <Icon name="search" size={15} />
            <span>Search or run a command</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button
            type="button"
            className="tb-btn"
            aria-pressed={draft.widget.enabled}
            aria-label="Desktop widget"
            data-tip="Show or hide the desktop widget"
            onClick={() => void setWidget({ enabled: !draft.widget.enabled })}
          >
            <Icon name="widget" size={16} />
            <span>Widget</span>
          </button>
          <button type="button" className="tb-btn" aria-haspopup="dialog" aria-label="Appearance" data-tip="Skin, theme, accent, motion, density" onClick={(e) => look.toggle(e.currentTarget)}>
            <Icon name="palette" size={16} />
            <span>Appearance</span>
          </button>
        </div>
        <div className="winctl" role="group" aria-label="Window controls">
          <button type="button" className="win-btn" aria-label="Minimize window" data-tip="Minimize" onClick={() => void control("minimize")}>
            <Icon name="min" size={16} />
          </button>
          <button
            type="button"
            className="win-btn"
            aria-label={state.maximized ? "Restore window" : "Maximize window"}
            data-tip={state.maximized ? "Restore down" : "Maximize"}
            onClick={() => void control("toggleMaximize")}
          >
            <Icon name={state.maximized ? "restore" : "max"} size={14} />
          </button>
          <button type="button" className="win-btn win-close" aria-label="Close window" data-tip="Close" onClick={() => void control("close")}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="lifeline" aria-hidden="true" data-busy={busy ? "" : undefined} style={{ "--p": fraction } as CSSProperties}>
          <i />
          <b />
        </div>
      </header>
      {error && (
        <div className="win-error" role="alert">
          {error}
        </div>
      )}
      <Popover anchor={about.anchor} onClose={about.close} label="About CodeLines" className="pop-about">
        <About onClose={about.close} />
      </Popover>
      <Popover anchor={look.anchor} onClose={look.close} placement="bottom-end" label="Appearance" className="pop-look">
        <div className="pop-pad">
          <strong className="pop-title">Appearance</strong>
          <LookControls />
        </div>
      </Popover>
    </>
  );
});

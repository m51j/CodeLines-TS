/**
 * The frameless title bar: brand, caption, command search, the desktop-widget toggle,
 * the appearance popover (accent dot) and the window controls. The bar drags the window;
 * every control in it is excluded from the drag region.
 */
import { useRef, useState, type RefObject } from "react";
import { useAppearanceControls } from "../../appearance/controls";
import { usePopover } from "../../motion/popover";
import { useWindowControls } from "../../window";
import { useWorkspace } from "../../workspace";
import { AccentPicker, ContrastReadout, DensitySeg, MotionSeg, SkinPicker, ThemeSeg } from "./Appearance";
import { useShell } from "./context";
import { Icon } from "./icons";

export function TitleBar() {
  const { state: win, error, control } = useWindowControls();
  const { draft, setWidget } = useWorkspace();
  const shell = useShell();
  const [pop, setPop] = useState(false),
    themeBtn = useRef<HTMLButtonElement>(null);
  const widgetOn = draft.widget.enabled;
  return (
    <>
      <header className={"titlebar" + (win.focused ? "" : " inactive")} aria-label="Application title bar">
        <div className="tb-brand" aria-hidden="true">
          <svg className="tb-mark" viewBox="0 0 20 20">
            <path d="M4 6h9M7 10h9M7 14h6" />
          </svg>
          <span>CodeLines</span>
        </div>
        <span className="tb-caption">Local workspace</span>
        <button className="tb-command" type="button" aria-label="Search pages and commands (Ctrl+K)" onClick={() => shell.openPalette()}>
          <Icon name="search" />
          <span>Search pages, actions, settings…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="tb-tools">
          <button
            className="tb-tool icon-only"
            type="button"
            aria-pressed={widgetOn}
            title={widgetOn ? "Desktop widget is on — click to turn it off" : "Show the desktop widget"}
            onClick={() => void setWidget({ enabled: !widgetOn })}
          >
            <Icon name="widget" />
            <span className="sr-only">Desktop widget</span>
          </button>
          <button
            ref={themeBtn}
            className="tb-tool icon-only"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={pop}
            aria-controls="lw-theme-pop"
            title="Skin, theme, accent and motion"
            onClick={() => setPop((p) => !p)}
          >
            <span className="accent-dot" aria-hidden="true" />
            <span className="sr-only">Appearance</span>
          </button>
        </div>
        <div className="window-controls" role="group" aria-label="Window controls">
          <button type="button" aria-label="Minimize window" title="Minimize" onClick={() => void control("minimize")}>
            <Icon name="min" />
          </button>
          <button
            type="button"
            aria-label={win.maximized ? "Restore window" : "Maximize window"}
            title={win.maximized ? "Restore down" : "Maximize"}
            onClick={() => void control("toggleMaximize")}
          >
            <Icon name={win.maximized ? "restore" : "max"} />
          </button>
          <button type="button" className="wc-close" aria-label="Close window" title="Close" onClick={() => void control("close")}>
            <Icon name="x" />
          </button>
        </div>
      </header>
      {error && (
        <div className="window-error" role="alert">
          {error}
        </div>
      )}
      {pop && <ThemePopover trigger={themeBtn} onClose={() => setPop(false)} />}
    </>
  );
}

function ThemePopover({ trigger, onClose }: { trigger: RefObject<HTMLElement | null>; onClose: () => void }) {
  const c = useAppearanceControls(),
    box = useRef<HTMLDivElement>(null);
  usePopover(box, trigger, onClose);
  return (
    <div ref={box} id="lw-theme-pop" className="popover theme-pop" role="dialog" aria-label="Appearance">
      <div className="tp-head">
        <strong>Appearance</strong>
        <span className="muted">Saved with your settings</span>
      </div>
      <div className="tp-row">
        <span className="tp-label">Skin</span>
        <SkinPicker c={c} compact />
      </div>
      <div className="tp-row">
        <span className="tp-label">Theme</span>
        <ThemeSeg c={c} />
      </div>
      <div className="tp-row">
        <span className="tp-label">Accent</span>
        <AccentPicker c={c} />
      </div>
      <div className="tp-row">
        <span className="tp-label">Motion</span>
        <MotionSeg c={c} />
      </div>
      <div className="tp-row">
        <span className="tp-label">Density</span>
        <DensitySeg c={c} />
      </div>
      <ContrastReadout c={c} />
    </div>
  );
}

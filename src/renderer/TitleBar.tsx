import { useRef, useState, type ReactNode, type RefObject } from "react";
import { Minus, Square, Copy, X, PictureInPicture2 } from "lucide-react";
import { useAppearanceControls } from "./appearance/controls";
import { usePopover } from "./motion/popover";
import {
  AccentChoices,
  ContrastRatios,
  DensitySelect,
  MotionSelect,
  SkinChoices,
  ThemeChoices,
} from "./skins/classic/AppearanceCard";
import { useWindowControls } from "./window";
import { useWorkspace } from "./workspace";

/**
 * Classic's frameless title bar: brand, caption, widget toggle, appearance popover and window controls.
 * `tools` adds the widget toggle and appearance popover; leave it off outside the workspace (loading).
 */
export function DesktopShell({ children, tools }: { children: ReactNode; tools?: boolean }) {
  const { state, error, control } = useWindowControls();
  return (
    <div className="desktop-shell">
      <header
        className={`titlebar${state.focused ? "" : " titlebar-inactive"}`}
        aria-label="Application title bar"
      >
        <div className="titlebar-brand">
          <svg className="titlebar-mark" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 6h9M7 10h9M7 14h6" />
          </svg>
          <span>CodeLines</span>
        </div>
        <span className="titlebar-caption">Local workspace</span>
        {tools && <TitleBarTools />}
        <div
          className="window-controls"
          role="group"
          aria-label="Window controls"
        >
          <button
            type="button"
            aria-label="Minimize window"
            title="Minimize"
            onClick={() => void control("minimize")}
          >
            <Minus size={15} strokeWidth={1.3} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={state.maximized ? "Restore window" : "Maximize window"}
            title={state.maximized ? "Restore down" : "Maximize"}
            onClick={() => void control("toggleMaximize")}
          >
            {state.maximized ? (
              <Copy size={13} strokeWidth={1.3} aria-hidden="true" />
            ) : (
              <Square size={13} strokeWidth={1.3} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="window-close"
            aria-label="Close window"
            title="Close"
            onClick={() => void control("close")}
          >
            <X size={16} strokeWidth={1.3} aria-hidden="true" />
          </button>
        </div>
      </header>
      {error && (
        <div className="window-error" role="alert">
          {error}
        </div>
      )}
      {children}
    </div>
  );
}

/** The widget toggle and appearance button; needs the workspace. */
function TitleBarTools() {
  const { draft, setWidget } = useWorkspace();
  const [pop, setPop] = useState(false),
    lookBtn = useRef<HTMLButtonElement>(null);
  const widgetOn = draft.widget.enabled;
  return (
    <>
      <div className="titlebar-tools">
        <button
          type="button"
          className="titlebar-tool"
          aria-pressed={widgetOn}
          title={widgetOn ? "Desktop widget is on — click to turn it off" : "Show the desktop widget"}
          onClick={() => void setWidget({ enabled: !widgetOn })}
        >
          <PictureInPicture2 size={16} strokeWidth={1.6} aria-hidden="true" />
          <span className="sr-only">Desktop widget</span>
        </button>
        <button
          ref={lookBtn}
          type="button"
          className="titlebar-tool"
          aria-haspopup="dialog"
          aria-expanded={pop}
          aria-controls="cl-look-pop"
          title="Skin, theme, accent and motion"
          onClick={() => setPop((p) => !p)}
        >
          <span className="accent-dot" aria-hidden="true" />
          <span className="sr-only">Appearance</span>
        </button>
      </div>
      {pop && <AppearancePopover trigger={lookBtn} onClose={() => setPop(false)} />}
    </>
  );
}

function AppearancePopover({ trigger, onClose }: { trigger: RefObject<HTMLElement | null>; onClose: () => void }) {
  const c = useAppearanceControls(),
    box = useRef<HTMLDivElement>(null);
  usePopover(box, trigger, onClose);
  return (
    <div ref={box} id="cl-look-pop" className="cl-popover" role="dialog" aria-label="Appearance">
      <div className="cl-popover-head">
        <strong>Appearance</strong>
        <span className="muted">Saved with your settings</span>
      </div>
      <div className="cl-popover-row">
        <span className="cl-popover-label">Skin</span>
        <SkinChoices c={c} compact />
      </div>
      <div className="cl-popover-row">
        <span className="cl-popover-label">Theme</span>
        <ThemeChoices c={c} />
      </div>
      <div className="cl-popover-row">
        <span className="cl-popover-label">Accent</span>
        <div className="cl-popover-accent">
          <AccentChoices c={c} compact />
        </div>
      </div>
      <div className="cl-popover-row">
        <span className="cl-popover-label">Motion</span>
        <MotionSelect c={c} />
      </div>
      <div className="cl-popover-row">
        <span className="cl-popover-label">Density</span>
        <DensitySelect c={c} />
      </div>
      <ContrastRatios c={c} />
    </div>
  );
}

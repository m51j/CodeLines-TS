/**
 * The opening: the three-line logo draws itself, a cursor dot blinks, the wordmark rises
 * and a curtain lifts. The loading screen shows while the workspace opens; when the shell
 * takes over it continues the same animation (offset by the time already played) and lifts
 * the curtain, so a fast load never cuts the opening short. Any key or click skips it.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { reduced } from "../../motion/core";
import { useWindowControls } from "../../window";
import { Icon } from "./icons";

let bootStart: number | null = null;
/** The moment the loading screen appeared, once (null when the shell opened without it, e.g. a skin switch). */
export const takeBoot = () => {
  const t = bootStart;
  bootStart = null;
  return t;
};

function Mark() {
  return (
    <svg className="loader-mark" viewBox="0 0 120 120" aria-hidden="true">
      <path className="ld ld-1" d="M24 38h52" />
      <path className="ld ld-2" d="M42 60h56" />
      <path className="ld ld-3" d="M42 82h30" />
      <circle className="ld-dot" cx="78" cy="82" r="4" />
    </svg>
  );
}

/** A drag strip with the window controls, so the window can be moved or closed while it opens. */
function LoaderBar() {
  const { state, control } = useWindowControls();
  return (
    <header className="titlebar loader-bar" aria-label="Application title bar">
      <span className="spacer" />
      <div className="window-controls" role="group" aria-label="Window controls">
        <button type="button" aria-label="Minimize window" title="Minimize" onClick={() => void control("minimize")}>
          <Icon name="min" />
        </button>
        <button
          type="button"
          aria-label={state.maximized ? "Restore window" : "Maximize window"}
          title={state.maximized ? "Restore down" : "Maximize"}
          onClick={() => void control("toggleMaximize")}
        >
          <Icon name={state.maximized ? "restore" : "max"} />
        </button>
        <button type="button" className="wc-close" aria-label="Close window" title="Close" onClick={() => void control("close")}>
          <Icon name="x" />
        </button>
      </div>
    </header>
  );
}

export function LineworkLoading({ error }: { error: string }) {
  useLayoutEffect(() => {
    if (bootStart === null) bootStart = performance.now();
  }, []);
  return (
    <div className={"loader play" + (error ? " error" : "")} role="status" aria-live="polite">
      <LoaderBar />
      <div className="loader-inner">
        <Mark />
        <h1 className="loader-word">
          <span>Code</span>
          <span>Lines</span>
        </h1>
        <div className="loader-caption">
          {error ? (
            <>
              <span>Could not open the local workspace: {error}</span>
              <button type="button" className="btn sm" onClick={() => location.reload()}>
                <Icon name="refresh" />
                Try again
              </button>
            </>
          ) : (
            "Opening your local workspace…"
          )}
        </div>
        <div className="loader-scan" aria-hidden="true">
          <i />
        </div>
      </div>
    </div>
  );
}

/** The loading screen's last moment, played over the freshly mounted shell. */
export function BootCurtain({ start, onLift, onDone }: { start: number; onLift: () => void; onDone: () => void }) {
  const [played] = useState(() => performance.now() - start),
    [out, setOut] = useState(false);
  const cb = useRef({ onLift, onDone });
  cb.current = { onLift, onDone };
  useEffect(() => {
    let lifted = false;
    let doneTimer: ReturnType<typeof setTimeout> | undefined;
    const lift = () => {
      if (lifted) return;
      lifted = true;
      setOut(true);
      cb.current.onLift();
      doneTimer = setTimeout(() => cb.current.onDone(), reduced() ? 60 : 420);
    };
    const timer = setTimeout(lift, Math.max(0, (reduced() ? 350 : 1250) - played));
    const skip = () => lift();
    addEventListener("keydown", skip, true);
    addEventListener("pointerdown", skip, true);
    return () => {
      clearTimeout(timer);
      clearTimeout(doneTimer);
      removeEventListener("keydown", skip, true);
      removeEventListener("pointerdown", skip, true);
    };
  }, [played]);
  return (
    <div className={"loader play" + (out ? " out" : "")} aria-hidden="true" style={{ "--ld-t": played + "ms" } as CSSProperties}>
      <div className="titlebar loader-bar" />
      <div className="loader-inner">
        <Mark />
        <h1 className="loader-word">
          <span>Code</span>
          <span>Lines</span>
        </h1>
        <div className="loader-caption">Opening your local workspace…</div>
        <div className="loader-scan">
          <i />
        </div>
      </div>
      <span className="loader-skip">Skip</span>
    </div>
  );
}

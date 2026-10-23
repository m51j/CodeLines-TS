import { useEffect, useState, type ReactNode } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import type { WindowAction, WindowState } from "../shared/contracts";

export function DesktopShell({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WindowState>({
    maximized: false,
    focused: true,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let listening = true;
    const unsubscribe = window.codelines.onWindowState((next) => {
      if (listening) setState(next);
    });
    void window.codelines.getWindowState().then(
      (next) => {
        if (listening) setState(next);
      },
      (reason: unknown) => {
        if (listening) setError(String(reason));
      },
    );
    return () => {
      listening = false;
      unsubscribe();
    };
  }, []);

  const control = async (action: WindowAction) => {
    setError("");
    try {
      await window.codelines.windowAction(action);
    } catch (reason) {
      setError(String(reason));
    }
  };

  return (
    <div className="desktop-shell">
      <header
        className={`titlebar${state.focused ? "" : " titlebar-inactive"}`}
        aria-label="Application title bar"
      >
        <div className="titlebar-brand">
          CodeLines <span className="titlebar-edition">TS</span>
        </div>
        <span className="titlebar-caption">Local workspace</span>
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
            <Minus size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={state.maximized ? "Restore window" : "Maximize window"}
            title={state.maximized ? "Restore down" : "Maximize"}
            onClick={() => void control("toggleMaximize")}
          >
            {state.maximized ? (
              <Copy size={12} aria-hidden="true" />
            ) : (
              <Square size={12} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="window-close"
            aria-label="Close window"
            title="Close"
            onClick={() => void control("close")}
          >
            <X size={15} aria-hidden="true" />
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

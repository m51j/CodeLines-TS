import { useCallback, useEffect, useState } from "react";
import type { WindowAction, WindowState } from "../shared/contracts";
/** The frameless window's state and its caption-button actions, for every skin's title bar. */
export function useWindowControls() {
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
  const control = useCallback(async (action: WindowAction) => {
    setError("");
    try {
      await window.codelines.windowAction(action);
    } catch (reason) {
      setError(String(reason));
    }
  }, []);
  return { state, error, control };
}

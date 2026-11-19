import { useEffect, useState } from "react";
import type { UpdateState } from "../shared/contracts";

/** The updater's state, kept current from the main process; null until the first answer. */
export function useUpdateState(): UpdateState | null {
  const [state, setState] = useState<UpdateState | null>(null);
  useEffect(() => {
    const api = typeof window !== "undefined" ? window.codelines : undefined;
    if (!api?.getUpdateState) return;
    let live = true;
    void api
      .getUpdateState()
      .then((s) => live && setState(s))
      .catch(() => undefined);
    const off = api.onUpdateState(setState);
    return () => {
      live = false;
      off();
    };
  }, []);
  return state;
}
export interface UpdateView {
  /** One line for the About section. */
  text: string;
  tone: "muted" | "good" | "busy" | "error";
  /** What the main button does; null hides it. */
  action: { kind: "check" | "install"; icon: "check" | "restart" | "download"; label: string; disabled?: boolean } | null;
  /** 0–100 while downloading. */
  progress: number | null;
  /** The automatic-check switch only applies where updates can run at all. */
  canAutoCheck: boolean;
}
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
/** What the About section shows for an update state, shared by every skin. */
export function updateView(state: UpdateState | null): UpdateView {
  const check = { kind: "check", icon: "check", label: "Check for updates" } as const;
  if (!state) return { text: "", tone: "muted", action: null, progress: null, canAutoCheck: false };
  switch (state.status) {
    case "disabled":
      return {
        text:
          state.reason === "development"
            ? "Updates are checked only in the installed app."
            : "Updates are off while testing.",
        tone: "muted",
        action: null,
        progress: null,
        canAutoCheck: false,
      };
    case "idle":
      return { text: "CodeLines can check GitHub for new versions.", tone: "muted", action: check, progress: null, canAutoCheck: true };
    case "checking":
      return { text: "Checking for updates…", tone: "busy", action: { ...check, disabled: true }, progress: null, canAutoCheck: true };
    case "upToDate":
      return { text: `You have the latest version (checked at ${time(state.checkedAt)}).`, tone: "good", action: check, progress: null, canAutoCheck: true };
    case "available":
      return state.manual
        ? {
            text: `CodeLines ${state.version} is available. The portable app is updated by downloading the new version.`,
            tone: "good",
            action: { kind: "install", icon: "download", label: `Download ${state.version}` },
            progress: null,
            canAutoCheck: true,
          }
        : { text: `Downloading CodeLines ${state.version}…`, tone: "busy", action: null, progress: 0, canAutoCheck: true };
    case "downloading":
      return {
        text: `Downloading CodeLines ${state.version}… ${Math.round(state.percent)}%`,
        tone: "busy",
        action: null,
        progress: state.percent,
        canAutoCheck: true,
      };
    case "ready":
      return {
        text: `CodeLines ${state.version} is ready. It installs when you restart or the next time CodeLines closes.`,
        tone: "good",
        action: { kind: "install", icon: "restart", label: "Restart to update" },
        progress: null,
        canAutoCheck: true,
      };
    case "error":
      return { text: state.message, tone: "error", action: { ...check, label: "Try again" }, progress: null, canAutoCheck: true };
  }
}
/** Runs the About button's action; failures go to the skin's error banner. */
export function runUpdateAction(kind: "check" | "install", onError: (e: unknown) => void) {
  const api = window.codelines;
  void (kind === "check" ? api.checkForUpdates() : api.installUpdate()).catch(onError);
}
/** A finished download, or a portable build with a newer release: worth a notice outside Settings. */
export function noticeVersion(state: UpdateState | null): string | null {
  if (state?.status === "ready") return state.version;
  if (state?.status === "available" && state.manual) return state.version;
  return null;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AppState,
  ExportKind,
  GitProject,
  OperationKind,
  Progress,
  Settings,
} from "../shared/contracts";
import { errorMessage } from "./format";
type Busy = { id: string; kind: OperationKind } | null;
const operationName = (kind: OperationKind) =>
  kind === "scan" ? "Scan" : kind === "history" ? "Git history" : "AI usage";
/** Settings the renderer edits; stored results are excluded so comparisons stay cheap. */
export const editable = (s: Settings) =>
  JSON.stringify({ ...s, lastSnapshot: null, lastGitHistory: null });
export const historyInputs = (s: Settings) =>
  JSON.stringify([
    s.projects,
    s.scanOptions.countingScope,
    s.scanOptions.globalExcludePatterns,
    s.gitHistory,
  ]);
export function useWorkspaceState() {
  const [state, setState] = useState<AppState | null>(null),
    [draft, setDraft] = useState<Settings | null>(null),
    [status, setStatus] = useState("Loading local workspace…"),
    [error, setErrorText] = useState(""),
    [progress, setProgress] = useState<Progress | null>(null),
    [busy, setBusy] = useState<Busy>(null),
    [partial, setPartial] = useState<GitProject[]>([]),
    [selected, setSelected] = useState("");
  const activeId = useRef(""),
    aiOpened = useRef(false),
    latest = useRef({ draft, busy, state });
  latest.current = { draft, busy, state };
  const setError = useCallback((e: unknown) => setErrorText(e ? errorMessage(e) : ""), []);
  const apply = useCallback((s: AppState) => {
    setState(s);
    setDraft(structuredClone(s.settings));
  }, []);
  useEffect(() => {
    window.codelines.load().then(
      (s) => {
        apply(s);
        setStatus("Ready to scan");
      },
      (e: unknown) => setError(e),
    );
    return window.codelines.onProgress((p) => {
      if (p.id !== activeId.current) return;
      setProgress(p);
      if (p.partial) setPartial(p.partial);
    });
  }, [apply, setError]);
  useEffect(() => {
    const theme = draft?.theme;
    if (!theme) return;
    const media = matchMedia("(prefers-color-scheme: dark)"),
      update = () => {
        document.documentElement.dataset.theme =
          theme === "Dark" || (theme === "System" && media.matches)
            ? "dark"
            : "light";
      };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [draft?.theme]);
  const change = useCallback(
    (fn: (s: Settings) => void) =>
      setDraft((current) => {
        if (!current) return current;
        const next = structuredClone(current);
        fn(next);
        return next;
      }),
    [],
  );
  const start = (kind: OperationKind) => {
    const id = crypto.randomUUID();
    activeId.current = id;
    setBusy({ id, kind });
    setProgress(null);
    return id;
  };
  const execute = useCallback(
    async (kind: OperationKind, projectId?: string, rescan = false) => {
      const settings = latest.current.draft;
      if (!settings || latest.current.busy) return;
      if (kind === "ai") aiOpened.current = true;
      const id = start(kind);
      setError("");
      setStatus(`Starting ${operationName(kind).toLowerCase()}…`);
      if (kind === "history") setPartial([]);
      try {
        const result = await window.codelines.run({
          id,
          kind,
          projectId,
          rescan,
          settings,
        });
        apply(result.state);
        setStatus(
          result.status === "completed"
            ? `${operationName(kind)} complete`
            : result.status === "cancelled"
              ? `${operationName(kind)} cancelled` +
                (kind === "history" ? "; visible totals are partial" : "")
              : `${operationName(kind)} failed`,
        );
        if (result.error) setError(result.error);
        if (result.partial) setPartial(result.partial);
        const next = result.state.settings;
        if (result.status === "completed" && kind === "scan" && projectId)
          setSelected(projectId);
        if (
          result.status === "completed" &&
          kind === "scan" &&
          next.aiUsage.enabled &&
          next.dailyLog.refreshAiAfterScan
        ) {
          aiOpened.current = true;
          const aiId = start("ai");
          setStatus("Scan complete · refreshing AI usage for the daily log…");
          const ai = await window.codelines.run({
            id: aiId,
            kind: "ai",
            settings: next,
          });
          apply(ai.state);
          setStatus("Scan complete · AI usage " + ai.status);
          if (ai.error) setError(ai.error);
        }
      } catch (e) {
        setError(e);
        setStatus(`${operationName(kind)} failed`);
      } finally {
        setBusy(null);
        activeId.current = "";
        setProgress(null);
      }
    },
    [apply, setError],
  );
  const act = useCallback(
    async (action: () => Promise<AppState>, message: string) => {
      setError("");
      try {
        apply(await action());
        setStatus(message);
      } catch (e) {
        setError(e);
      }
    },
    [apply, setError],
  );
  const save = useCallback(() => {
    const d = latest.current.draft;
    return d
      ? act(() => window.codelines.save(d), "Settings saved")
      : Promise.resolve();
  }, [act]);
  /** Saves pending edits first so the main process acts on what the user sees. */
  const saveThen = useCallback(
    (action: () => Promise<AppState>, message: string) =>
      act(async () => {
        const { draft: d, state: s } = latest.current;
        if (d && s && editable(d) !== editable(s.settings))
          await window.codelines.save(d);
        return action();
      }, message),
    [act],
  );
  /** The theme applies and persists immediately without saving other pending edits. */
  const setTheme = useCallback(
    async (theme: Settings["theme"]) => {
      change((s) => {
        s.theme = theme;
      });
      const saved = latest.current.state?.settings;
      if (!saved) return;
      try {
        const next = await window.codelines.save({ ...saved, theme });
        setState(next);
      } catch (e) {
        setError(e);
      }
    },
    [change, setError],
  );
  const exportData = useCallback(
    async (
      kind: ExportKind,
      format: "json" | "csv" | "html",
      options: { projectIds?: string[]; allAgents?: boolean } = {},
    ) => {
      setError("");
      try {
        const { draft: d, state: s } = latest.current;
        if (kind === "projects" && d && s && editable(d) !== editable(s.settings))
          apply(await window.codelines.save(d));
        const file = await window.codelines.export({ kind, format, ...options });
        if (file) setStatus("Exported " + file);
      } catch (e) {
        setError(e);
      }
    },
    [apply, setError],
  );
  const cancel = useCallback(() => {
    const b = latest.current.busy;
    if (!b) return;
    setStatus("Cancelling…");
    void window.codelines.cancel(b.id);
  }, []);
  const dirty = useMemo(
    () => !!state && !!draft && editable(draft) !== editable(state.settings),
    [draft, state],
  );
  return {
    state,
    draft,
    status,
    error,
    progress,
    busy,
    partial,
    dirty,
    selected,
    setSelected,
    aiOpened,
    setError,
    setDraft,
    change,
    execute,
    act,
    save,
    saveThen,
    setTheme,
    exportData,
    cancel,
  };
}
export type Workspace = ReturnType<typeof useWorkspaceState> & {
  state: AppState;
  draft: Settings;
};
export const WorkspaceContext = createContext<Workspace | null>(null);
export function useWorkspace(): Workspace {
  const ws = useContext(WorkspaceContext);
  if (!ws) throw new Error("useWorkspace must be used inside the workspace.");
  return ws;
}

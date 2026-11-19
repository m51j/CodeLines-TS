import type { UpdateState } from "../shared/contracts";

/** The parts of electron-updater's AppUpdater CodeLines uses, so tests can supply a fake. */
export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  forceDevUpdateConfig: boolean;
  on(event: string, listener: (...args: never[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  setFeedURL(options: { provider: "generic"; url: string }): void;
}
export interface UpdaterOptions {
  /** Loaded only when updates are enabled, so development and tests never touch it. */
  load(): UpdaterLike;
  /** Not packaged / running under the desktop tests, unless a feed override is set. */
  disabled: "development" | "test" | null;
  /** The portable build cannot replace itself: offer the release page instead. */
  manual: boolean;
  /** A generic feed (a local folder served over HTTP) that replaces GitHub, for testing. */
  feedUrl?: string;
  /** Whether automatic checks are on; read each time they are scheduled. */
  autoCheck(): boolean;
  onState(state: UpdateState): void;
  openReleases(): void;
  /** Runs right before the app quits to install, e.g. so closing is not turned into hiding. */
  beforeInstall(): void;
  startupDelayMs?: number;
  intervalMs?: number;
}
export interface UpdaterController {
  state(): UpdateState;
  check(): Promise<UpdateState>;
  install(): void;
  /** Re-reads the automatic-check setting and starts or stops the timer. */
  schedule(): void;
  dispose(): void;
}
const offline =
  /net::ERR_|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|socket hang up/i;
/** A short message a person can act on, instead of electron-updater's raw stack. */
export function updateErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (offline.test(raw))
    return "Could not reach GitHub. Check your internet connection and try again.";
  if (/latest\.yml|404|HttpError: 4\d\d/i.test(raw))
    return "The latest release has no update information yet. Try again later.";
  const line = raw.split("\n")[0].trim();
  return line.length > 200 ? line.slice(0, 199) + "…" : line || "The update check failed.";
}
export function createUpdater(options: UpdaterOptions): UpdaterController {
  const manual = options.manual,
    startupDelay = options.startupDelayMs ?? 10_000,
    interval = options.intervalMs ?? 6 * 60 * 60 * 1000;
  let current: UpdateState = options.disabled
    ? { status: "disabled", reason: options.disabled }
    : { status: "idle", manual };
  let updater: UpdaterLike | null = null,
    inflight: Promise<UpdateState> | null = null,
    timer: NodeJS.Timeout | undefined,
    scheduled = false;
  const status = (): UpdateState["status"] => current.status;
  const set = (next: UpdateState) => {
    current = next;
    options.onState(next);
  };
  const version = (info: unknown) =>
    String((info as { version?: unknown } | null)?.version ?? "");
  function instance(): UpdaterLike {
    if (updater) return updater;
    const u = options.load();
    u.autoDownload = !manual;
    // A downloaded update installs the next time CodeLines quits, even without a restart click.
    u.autoInstallOnAppQuit = !manual;
    if (options.feedUrl) {
      u.forceDevUpdateConfig = true;
      u.setFeedURL({ provider: "generic", url: options.feedUrl });
    }
    u.on("checking-for-update", () => set({ status: "checking", manual }));
    u.on("update-not-available", () =>
      set({ status: "upToDate", manual, checkedAt: new Date().toISOString() }),
    );
    u.on("update-available", (info: never) =>
      set({ status: "available", manual, version: version(info) }),
    );
    u.on("download-progress", (progress: never) => {
      if (manual) return;
      const percent = Number((progress as { percent?: unknown }).percent);
      set({
        status: "downloading",
        manual: false,
        version: "version" in current ? current.version : "",
        percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0,
      });
    });
    u.on("update-downloaded", (info: never) =>
      set({ status: "ready", manual: false, version: version(info) }),
    );
    u.on("error", (error: never) => {
      // A finished download stays installable even if a later check fails.
      if (current.status !== "ready")
        set({ status: "error", manual, message: updateErrorMessage(error) });
    });
    updater = u;
    return u;
  }
  function check(): Promise<UpdateState> {
    if (current.status === "disabled" || current.status === "ready" || current.status === "downloading")
      return Promise.resolve(current);
    inflight ??= (async () => {
      try {
        set({ status: "checking", manual });
        await instance().checkForUpdates();
        // electron-updater can resolve without an event (e.g. when it skips the check).
        if (status() === "checking")
          set({ status: "upToDate", manual, checkedAt: new Date().toISOString() });
      } catch (error) {
        // Events fire while awaiting, so read the state afresh rather than the narrowed value.
        if (status() !== "ready")
          set({ status: "error", manual, message: updateErrorMessage(error) });
      } finally {
        inflight = null;
      }
      return current;
    })();
    return inflight;
  }
  function run() {
    void check().finally(() => {
      if (scheduled) timer = setTimeout(run, interval);
    });
  }
  function schedule() {
    const wanted = current.status !== "disabled" && options.autoCheck();
    if (wanted === scheduled) return;
    scheduled = wanted;
    clearTimeout(timer);
    timer = wanted ? setTimeout(run, startupDelay) : undefined;
  }
  function install() {
    if (current.status === "ready" && updater) {
      options.beforeInstall();
      // Silent: the installer reuses the existing install folder; then relaunch CodeLines.
      updater.quitAndInstall(true, true);
    } else if (manual && current.status === "available") options.openReleases();
  }
  return {
    state: () => current,
    check,
    install,
    schedule,
    dispose: () => {
      scheduled = false;
      clearTimeout(timer);
    },
  };
}

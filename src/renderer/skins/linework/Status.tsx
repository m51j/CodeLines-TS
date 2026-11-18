/**
 * Alerts under the masthead (an error that shakes in, the progress card with its sweep,
 * shimmer and indeterminate bar), the data notices disclosure and the status line (a dot
 * that pulses while working, text that rises on change, and the save shortcut).
 */
import { useLayoutEffect, useRef } from "react";
import { play } from "../../motion/core";
import { useWorkspace } from "../../workspace";
import { Icon } from "./icons";
import { duration, lines, number } from "./ui/fmt";

export function Alerts() {
  const { error, setError, busy, progress, cancel, status } = useWorkspace();
  const errEl = useRef<HTMLDivElement>(null),
    cardEl = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!error) return;
    play(errEl.current, [{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 260 });
    play(
      errEl.current,
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "none" },
      ],
      { duration: 360, delay: 260, fill: "none", composite: "add" },
    );
  }, [error]);
  const working = !!busy;
  useLayoutEffect(() => {
    if (working) play(cardEl.current, [{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 260 });
  }, [working]);
  const p = progress,
    det = p?.total != null,
    cancelling = status === "Cancelling…";
  return (
    <div className="alerts">
      {error && (
        <div className="alert-error" role="alert" ref={errEl}>
          <Icon name="alert" />
          <div>
            <strong>Something needs attention</strong>
            <p>{error}</p>
          </div>
          <button className="btn sm" type="button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
      {busy && (
        <section className="progress-card" aria-label="Background operation" ref={cardEl}>
          <div className="pc-head">
            <span className="pc-orbit" aria-hidden="true">
              <i />
            </span>
            <strong>{p?.stage ?? "Starting background worker…"}</strong>
            <span className="spacer" />
            <button className="btn sm" type="button" disabled={cancelling} onClick={cancel}>
              <Icon name="stop" />
              Cancel
            </button>
          </div>
          <p className="pc-meta">
            {lines([
              p?.project,
              p?.projectIndex !== undefined && `Project ${p.projectIndex + 1}/${p.projectCount}`,
              `${duration(p?.elapsed ?? 0)} elapsed`,
              !!p?.eta && `Current project ETA ≈ ${duration(p.eta)}`,
            ])}
          </p>
          <div
            className={"pc-bar" + (det ? "" : " indeterminate")}
            role="progressbar"
            aria-label="Progress"
            aria-valuemin={0}
            aria-valuemax={det ? p!.total! : undefined}
            aria-valuenow={det ? p!.completed : undefined}
          >
            <i style={det ? { width: (p!.completed / Math.max(1, p!.total!)) * 100 + "%" } : undefined} />
          </div>
          <div className="pc-detail">
            <span>
              {lines([
                det
                  ? `${number(p!.completed)}/${number(p!.total)} ${busy.kind === "history" ? "comparisons" : "items"} complete`
                  : "Discovering work; remaining count not known yet",
                p?.totalFiles !== undefined && `Current comparison files ${p.completedFiles}/${p.totalFiles}`,
              ])}
            </span>
            <span className="mono pc-path" title={p?.path}>
              {p?.path}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}

export function Notices() {
  const { state } = useWorkspace();
  const n = state.warnings.length;
  if (!n) return null;
  return (
    <details className="disclosure notices">
      <summary>
        <Icon name="chev" className="disc-ic" />
        <Icon name="info" />
        {n} data or recovery {n === 1 ? "notice" : "notices"}
      </summary>
      <ul>
        {state.warnings.map((w, i) => (
          <li key={i} className="mono">
            {w}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function StatusLine() {
  const { status, busy, dirty, save } = useWorkspace();
  const text = useRef<HTMLSpanElement>(null),
    right = useRef<HTMLSpanElement>(null),
    last = useRef(status);
  useLayoutEffect(() => {
    const before = last.current;
    last.current = status;
    if (before === status) return;
    // Progress ticks of the same stage do not replay the rise.
    if (before.split(" · ")[0] === status.split(" · ")[0] && busy) return;
    play(text.current, [{ opacity: 0, transform: "translateY(60%)" }, { opacity: 1, transform: "none" }], { duration: 200 });
  }, [status, busy]);
  const mode = dirty && !busy ? "save" : busy ? "busy" : "idle";
  useLayoutEffect(() => {
    play(right.current?.firstElementChild, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 200 });
  }, [mode]);
  return (
    <footer className="statusline">
      <span className={"status-dot" + (busy ? " working" : "")} aria-hidden="true" />
      <span className="status-text" role="status" aria-live="polite" title={status} ref={text}>
        {status}
      </span>
      <span className="spacer" />
      <span ref={right}>
        {mode === "save" ? (
          <button type="button" className="status-save" onClick={() => void save()}>
            <Icon name="db" />
            Unsaved changes · Save
          </button>
        ) : (
          <span className="status-local">
            <Icon name="shield" />
            {busy ? "Processing locally" : "All data stays local"}
          </span>
        )}
      </span>
    </footer>
  );
}

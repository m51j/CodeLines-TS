/**
 * The bottom edge: notices drawer, operation dock (rises from the status bar while something runs)
 * and the status bar itself. Nothing here pushes the page down.
 */
import { forwardRef, useLayoutEffect, useRef } from "react";
import { play } from "../../motion/core";
import { duration, lines, number } from "../../format";
import { useWorkspace } from "../../workspace";
import { progressFraction } from "./format";
import { Icon } from "./icons";
import { Popover, usePopover } from "./ui/overlays";
export function Notices({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useWorkspace();
  const n = state.warnings.length,
    shown = open && n > 0;
  return (
    <section className="notices" aria-label="Data and recovery notices" data-open={shown ? "" : undefined}>
      <div className="notices-inner" inert={!shown}>
        {n > 0 && (
          <>
            <div className="notices-head">
              <strong>{`${n} data or recovery ${n === 1 ? "notice" : "notices"}`}</strong>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Collapse notices" onClick={onClose}>
                <Icon name="chevron" size={15} />
              </button>
            </div>
            <ul>
              {state.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
export function Dock() {
  const { busy, progress: p, cancel } = useWorkspace();
  const known = !!p && p.total !== null && p.total !== undefined;
  return (
    <section
      className="dock"
      aria-label="Operation progress"
      data-open={busy ? "" : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
      }}
    >
      <div className="dock-inner" inert={!busy}>
        <div className="dock-top">
          <span className="dock-spinner" aria-hidden="true" />
          <strong className="dock-stage">{p?.stage ?? "Starting background worker…"}</strong>
          <span className="spacer" />
          <button type="button" className="btn btn-sm" onClick={cancel}>
            <Icon name="stop" size={13} />
            <span>Cancel</span>
          </button>
        </div>
        <p className="dock-meta">
          {lines([
            p?.project,
            p?.projectIndex !== undefined && `Project ${p.projectIndex + 1}/${p.projectCount}`,
            `${duration(p?.elapsed ?? 0)} elapsed`,
            !!p?.eta && `Current project ETA ≈ ${duration(p.eta)}`,
          ])}
        </p>
        <div
          className={"pbar" + (known ? "" : " is-indeterminate")}
          role="progressbar"
          aria-label="Operation progress"
          aria-valuemin={0}
          aria-valuemax={known ? (p?.total ?? undefined) : undefined}
          aria-valuenow={known ? p?.completed : undefined}
        >
          <i style={known && p?.total ? { width: (p.completed / p.total) * 100 + "%" } : undefined} />
        </div>
        <div className="dock-foot">
          <span className="dock-detail">
            {lines([
              known && p
                ? `${number(p.completed)}/${number(p.total)} ${busy?.kind === "history" ? "comparisons" : "items"} complete`
                : "Discovering work; remaining count not known yet",
              p?.totalFiles !== undefined && `Current comparison files ${p.completedFiles}/${p.totalFiles}`,
            ])}
          </span>
          <span className="dock-path mono" title={p?.path}>
            {p?.path ?? ""}
          </span>
        </div>
      </div>
    </section>
  );
}
export const StatusBar = forwardRef<HTMLElement, { noticesOpen: boolean; toggleNotices: () => void }>(function StatusBar({ noticesOpen, toggleNotices }, ref) {
  const { status, busy, progress, dirty, save, state } = useWorkspace();
  const priv = usePopover();
  const text = busy && progress && status !== "Cancelling…" ? `${progress.stage}${progress.project ? " · " + progress.project : ""}` : status;
  const key = busy ? "busy" : dirty ? "dirty" : "idle";
  const right = useRef<HTMLSpanElement>(null),
    last = useRef(key);
  useLayoutEffect(() => {
    if (last.current === key) return;
    last.current = key;
    if (key === "dirty") play(right.current?.firstElementChild, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 260 });
  }, [key]);
  const n = state.warnings.length;
  return (
    <footer ref={ref} className="statusbar">
      <span className={"status-dot" + (busy ? " is-working" : "")} aria-hidden="true" />
      <span className="status-text" role="status" aria-live="polite" title={text}>
        {text}
      </span>
      <span className="status-pct" aria-hidden="true">
        {busy && progress ? Math.round(progressFraction(progress) * 100) + "%" : ""}
      </span>
      <span className="spacer" />
      {n > 0 && (
        <button type="button" className="status-chip is-warn" aria-expanded={noticesOpen} onClick={toggleNotices}>
          <Icon name="notes" size={13} />
          {`${n} data or recovery ${n === 1 ? "notice" : "notices"}`}
        </button>
      )}
      <button type="button" className="status-chip" id="status-priv" aria-haspopup="dialog" onClick={(e) => priv.toggle(e.currentTarget)}>
        <Icon name="shield" size={13} />
        Local by design
      </button>
      <span className="status-right" ref={right}>
        {dirty && !busy ? (
          <button type="button" className="status-save" data-tip="Ctrl+S" onClick={() => void save()}>
            <Icon name="save" size={13} />
            Unsaved changes · Save
          </button>
        ) : (
          <span>{busy ? "Processing locally" : "All data stays local"}</span>
        )}
      </span>
      <Popover anchor={priv.anchor} onClose={priv.close} placement="top-end" label="Local by design">
        <div className="pop-pad priv">
          <strong className="pop-title">
            <Icon name="shield" size={16} />
            Local by design
          </strong>
          <p>Your source and usage stay on this computer.</p>
          <p className="muted">No account, no API key. Scans, Git history and AI usage are read from local files only.</p>
        </div>
      </Popover>
    </footer>
  );
});

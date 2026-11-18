/** Linework's building blocks: readouts, sheets, notices, fields, checkboxes and tiles. */
import { useLayoutEffect, useRef, type ReactNode, type SelectHTMLAttributes } from "react";
import { ease, play, useCount } from "../../../motion/core";
import { Icon } from "../icons";
import { tileNumber } from "./fmt";

export { LinesInput } from "../../../components";

/**
 * A readout: numbers count from the last shown value to the new one (the first time
 * from zero); text values rise into place when they change.
 */
export function Tk({
  value,
  fmt = tileNumber,
  k,
  className = "",
  dur = 520,
}: {
  value: number | string | null | undefined;
  fmt?: (n: number) => string;
  k?: string;
  className?: string;
  dur?: number;
}) {
  const ref = useCount<HTMLSpanElement>(value, fmt, { key: k, dur, firstDur: 760, ease: ease.outQuint });
  const prev = useRef<typeof value | typeof NaN>(NaN);
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (typeof value === "number" || Number.isNaN(before) || before === value) return;
    play(ref.current, [{ opacity: 0, transform: "translateY(40%)" }, { opacity: 1, transform: "none" }], { duration: 240 });
  }, [value, ref]);
  return <span ref={ref} className={"tk " + className} />;
}

export function Sheet({
  title,
  sub,
  actions,
  children,
  className = "",
  id,
  bodyClass = "",
  labelledBy,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
  bodyClass?: string;
  labelledBy?: string;
}) {
  return (
    <section className={"sheet " + className} id={id} aria-labelledby={labelledBy}>
      {title !== undefined && (
        <header className="sheet-head">
          <div>
            <h2 id={labelledBy}>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          {actions && <div className="sheet-actions">{actions}</div>}
        </header>
      )}
      <div className={"sheet-body " + bodyClass}>{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  children,
  action,
  art = "lines",
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  art?: "lines" | "search" | "spark";
}) {
  return (
    <div className="empty-state">
      <svg className="empty-art" viewBox="0 0 160 110" aria-hidden="true">
        <rect className="ea-frame" x="18" y="10" width="124" height="86" rx="12" />
        <path className="ea-l ea-1" d="M36 34h52" />
        <path className="ea-l ea-2" d="M48 50h64" />
        <path className="ea-l ea-3" d="M48 66h36" />
        <path className="ea-l ea-4" d="M36 82h20" />
        {art === "search" ? (
          <>
            <circle className="ea-lens" cx="112" cy="72" r="14" />
            <path className="ea-lens" d="m122 82 10 10" />
          </>
        ) : art === "spark" ? (
          <path className="ea-lens" d="M118 58l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
        ) : (
          <circle className="ea-dot" cx="96" cy="66" r="4" />
        )}
      </svg>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Notice({ kind = "warn", children, extra }: { kind?: "warn" | "info"; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className={"notice notice-" + kind}>
      <Icon name={kind === "info" ? "info" : "alert"} />
      <p>{children}</p>
      {extra}
    </div>
  );
}

export function Field({ label, children, help, className = "" }: { label: ReactNode; children: ReactNode; help?: ReactNode; className?: string }) {
  return (
    <label className={"field " + className}>
      <span className="field-label">{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}

/** A field whose control is not a form control (a segmented group): no wrapping label. */
export function Group({ label, children, help }: { label: ReactNode; children: ReactNode; help?: ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {help && <small>{help}</small>}
    </div>
  );
}

/** A checkbox whose tick draws itself. */
export function Check({
  label,
  checked,
  onChange,
  disabled,
  className = "",
  before,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  before?: ReactNode;
}) {
  return (
    <label className={"check " + className}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-box" aria-hidden="true">
        <svg className="ic" viewBox="0 0 20 20" aria-hidden="true">
          <path d="m4.5 10.5 3.5 3.5 7.5-8" pathLength={20} />
        </svg>
      </span>
      {before}
      <span>{label}</span>
    </label>
  );
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <span className="select">
      <select {...props}>{children}</select>
      <Icon name="chevdown" />
    </span>
  );
}

export interface TileItem {
  id: string;
  label: string;
  value: number | string | null | undefined;
  fmt?: (n: number) => string;
  detail?: ReactNode;
  tone?: "success" | "danger" | "accent" | "";
  title?: string;
  tip?: { title: string; detail: string };
}

/** Instrument tiles; values count to their new readings. */
export function Tiles({ items, className = "", prefix }: { items: TileItem[]; className?: string; prefix: string }) {
  return (
    <div className={"tiles " + className}>
      {items.map((t, i) => (
        <div className={"tile" + (t.tone ? " tone-" + t.tone : "")} data-tile={t.id} key={t.id} style={{ ["--i" as string]: i }}>
          <span className="tile-label">{t.label}</span>
          <strong
            className="tile-value"
            title={t.tip ? undefined : t.title}
            tabIndex={t.tip ? 0 : undefined}
            data-tip-t={t.tip?.title}
            data-tip={t.tip?.detail}
          >
            <Tk value={t.value} fmt={t.fmt} k={prefix + "." + t.id} />
          </strong>
          {t.detail !== undefined && <small className="tile-detail">{t.detail}</small>}
        </div>
      ))}
    </div>
  );
}

/** A disclosure that opens with ::details-content animation. */
export function Disclosure({
  summary,
  children,
  className = "",
  defaultOpen,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className={"disclosure " + className} open={defaultOpen}>
      <summary>
        <Icon name="chev" className="disc-ic" />
        {summary}
      </summary>
      {children}
    </details>
  );
}

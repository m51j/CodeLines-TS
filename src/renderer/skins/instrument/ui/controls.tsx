/** Small controls ported from the prototype's util.js: buttons, segmented controls, selects, checks, fields. */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "../icons";
const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
export interface ButtonProps {
  label?: ReactNode;
  icon?: IconName;
  primary?: boolean;
  ghost?: boolean;
  small?: boolean;
  danger?: boolean;
  solid?: boolean;
  disabled?: boolean;
  tip?: string;
  aria?: string;
  kbd?: string;
  className?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  hidden?: boolean;
}
export function Button(p: ButtonProps) {
  return (
    <button
      type="button"
      hidden={p.hidden}
      className={cx("btn", p.primary && "btn-primary", p.danger && "btn-danger", p.solid && "is-solid", p.ghost && "btn-ghost", p.small && "btn-sm", p.className)}
      disabled={p.disabled}
      data-tip={p.tip}
      aria-label={p.aria}
      onClick={p.onClick}
    >
      {p.icon && <Icon name={p.icon} size={15} />}
      {p.label !== undefined && <span>{p.label}</span>}
      {p.kbd && <kbd>{p.kbd}</kbd>}
    </button>
  );
}
export interface SegOption<T> {
  value: T;
  label?: string;
  icon?: IconName;
  tip?: string;
  aria?: string;
  id?: string;
  controls?: string;
  badge?: string;
  disabled?: boolean;
}
/** Segmented control with a sliding thumb. role: "tablist" | "radiogroup" | "group". */
export function Seg<T extends string | number>({
  label,
  role = "group",
  value,
  options,
  onChange,
  className,
  disabled,
  hidden,
}: {
  label: string;
  role?: "tablist" | "radiogroup" | "group";
  value: T | null;
  options: SegOption<T>[];
  onChange: (v: T, el: HTMLButtonElement) => void;
  className?: string;
  disabled?: boolean;
  hidden?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    thumb = useRef<HTMLElement>(null),
    first = useRef(true);
  const sync = (animate: boolean) => {
    const el = root.current,
      t = thumb.current;
    if (!el || !t) return;
    const active = el.querySelector<HTMLElement>('.seg-btn[data-on="1"]');
    if (!active || !active.offsetWidth) {
      t.style.opacity = "0";
      return;
    }
    t.style.opacity = "";
    if (!animate) t.style.transition = "none";
    t.style.width = active.offsetWidth + "px";
    t.style.transform = `translateX(${active.offsetLeft}px)`;
    if (!animate) {
      void t.offsetWidth;
      t.style.transition = "";
    }
  };
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const labels = options.map((o) => `${o.value}:${o.label ?? ""}:${o.badge ?? ""}`).join("|");
  useLayoutEffect(() => {
    syncRef.current(!first.current);
    first.current = false;
  }, [value, labels]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncRef.current(false));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (role === "group") return;
    const btns = [...(root.current?.querySelectorAll<HTMLButtonElement>(".seg-btn:not(:disabled)") ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const to =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (i + 1) % btns.length
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (i + btns.length - 1) % btns.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? btns.length - 1
              : -1;
    if (to >= 0) {
      e.preventDefault();
      btns[to].focus();
      btns[to].click();
    }
  };
  return (
    <div ref={root} className={cx("seg", className)} role={role} aria-label={label} onKeyDown={keys} hidden={hidden}>
      <i ref={thumb} className="seg-thumb" aria-hidden="true" />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            className="seg-btn"
            data-on={on ? "1" : undefined}
            data-tip={o.tip}
            aria-label={o.aria}
            id={o.id}
            aria-controls={o.controls}
            role={role === "tablist" ? "tab" : role === "radiogroup" ? "radio" : undefined}
            aria-selected={role === "tablist" ? on : undefined}
            aria-checked={role === "radiogroup" ? on : undefined}
            aria-pressed={role === "group" ? on : undefined}
            tabIndex={role === "group" ? undefined : on || (value === null && o === options[0]) ? 0 : -1}
            disabled={disabled || o.disabled}
            onClick={(e) => {
              if (!on) onChange(o.value, e.currentTarget);
            }}
          >
            {o.icon && <Icon name={o.icon} size={15} />}
            {o.label !== undefined && <span>{o.label}</span>}
            {o.badge !== undefined && <b className="seg-badge">{o.badge}</b>}
          </button>
        );
      })}
    </div>
  );
}
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
  id,
}: {
  label: string;
  value: T;
  options: (T | [T, string])[];
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <span className={cx("select", className)}>
      <select id={id} aria-label={label} disabled={disabled} value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, String(o)];
          return (
            <option key={String(v)} value={String(v)}>
              {l}
            </option>
          );
        })}
      </select>
      <Icon name="chevron" size={14} />
    </span>
  );
}
export function Check({
  label,
  note,
  checked,
  onChange,
  disabled,
  switch: isSwitch,
  aria,
  className,
}: {
  label?: ReactNode;
  note?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  switch?: boolean;
  aria?: string;
  className?: string;
}) {
  return (
    <label className={cx(isSwitch ? "switch" : "check", className)}>
      <input
        type="checkbox"
        role={isSwitch ? "switch" : undefined}
        aria-label={aria}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {isSwitch && <i className="switch-track" aria-hidden="true" />}
      {label !== undefined && (
        <span className="check-label">
          {label}
          {note && <small>{note}</small>}
        </span>
      )}
    </label>
  );
}
export function Field({
  label,
  help,
  className,
  children,
  hidden,
}: {
  label: ReactNode;
  help?: ReactNode;
  className?: string;
  children: ReactNode;
  hidden?: boolean;
}) {
  return (
    <label className={cx("field", className)} hidden={hidden}>
      <span className="field-label">{label}</span>
      {children}
      {help && <small className="field-help">{help}</small>}
    </label>
  );
}
const splitLines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
/** One-entry-per-line textarea with a line-number gutter and an entry count. */
export function LinesInput({
  label,
  value,
  onChange,
  rows = 4,
  disabled,
}: {
  label: string;
  value: string[];
  onChange: (lines: string[]) => void;
  rows?: number;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => value.join("\n"));
  const joined = value.join("\n");
  if (joined !== splitLines(text).join("\n")) setText(joined);
  const gutter = useRef<HTMLDivElement>(null);
  const n = Math.max(text.split("\n").length, rows),
    k = splitLines(text).length;
  return (
    <div className="lines">
      <div className="lines-gutter" aria-hidden="true" ref={gutter}>
        {Array.from({ length: n }, (_, i) => i + 1).join("\n")}
      </div>
      <textarea
        className="mono"
        rows={rows}
        aria-label={label}
        disabled={disabled}
        spellCheck={false}
        value={text}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(splitLines(e.target.value));
        }}
      />
      <span className="lines-count">{k + (k === 1 ? " entry" : " entries")}</span>
    </div>
  );
}
/** Animated disclosure (the prototype's replacement for <details>). */
export function Disclosure({
  summary,
  className,
  defaultOpen = false,
  children,
}: {
  summary: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen),
    id = useId();
  return (
    <div className={cx("clp", className)} data-open={open ? "" : undefined}>
      <button type="button" className="clp-sum" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Icon name="chevron" size={14} />
        <span className="clp-title">{summary}</span>
      </button>
      <div className="clp-body" id={id}>
        <div className="clp-inner" inert={!open}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Segmented controls (a sliding thumb) and underline tabs (a sliding ink bar). The
 * indicator follows the active option, resizes with it, and moves instantly on layout
 * changes; arrow keys move between options of tab lists and radio groups.
 */
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { reduced } from "../../../motion/core";

export interface ChoiceOption<V extends string> {
  v: V;
  l: ReactNode;
  title?: string;
  aria?: string;
  disabled?: boolean;
  id?: string;
  controls?: string;
}

/** A short pressed response (decorative). */
export function press(el: Element | null) {
  if (!el || reduced() || !("animate" in el)) return;
  el.animate([{ transform: "scale(0.96)" }, { transform: "scale(1)" }], {
    duration: 220,
    easing: "cubic-bezier(0.34, 1.4, 0.64, 1)",
  });
}

function useIndicator(host: RefObject<HTMLDivElement | null>, value: string) {
  const first = useRef(true);
  const place = (instant: boolean) => {
    const el = host.current;
    if (!el) return;
    const thumb = el.querySelector<HTMLElement>(":scope > .seg-thumb, :scope > .tabs-ink");
    const on = el.querySelector<HTMLElement>(':scope > button[data-on="true"]');
    if (!thumb) return;
    if (!on || !on.offsetWidth) {
      thumb.style.opacity = "0";
      return;
    }
    if (instant) thumb.style.transition = "none";
    thumb.style.opacity = "1";
    thumb.style.setProperty("--x", on.offsetLeft + "px");
    thumb.style.setProperty("--w", on.offsetWidth + "px");
    if (instant) {
      void thumb.offsetWidth;
      thumb.style.transition = "";
    }
  };
  const latest = useRef(place);
  latest.current = place;
  useLayoutEffect(() => {
    latest.current(first.current);
    first.current = false;
  }, [value]);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => latest.current(true));
    ro.observe(el);
    return () => ro.disconnect();
  }, [host]);
}

function keys<V extends string>(
  e: KeyboardEvent<HTMLDivElement>,
  options: ChoiceOption<V>[],
  onChange: (v: V, el: HTMLElement) => void,
) {
  const list = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(":scope > button:not(:disabled)")];
  const i = list.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  const n =
    e.key === "ArrowRight" || e.key === "ArrowDown"
      ? (i + 1) % list.length
      : e.key === "ArrowLeft" || e.key === "ArrowUp"
        ? (i - 1 + list.length) % list.length
        : e.key === "Home"
          ? 0
          : e.key === "End"
            ? list.length - 1
            : -1;
  if (n < 0) return;
  e.preventDefault();
  list[n].focus();
  const v = options.find((o) => o.v === list[n].dataset.v)?.v;
  if (v !== undefined) onChange(v, list[n]);
}

export function Seg<V extends string>({
  label,
  options,
  value,
  onChange,
  kind = "group",
  className = "",
  disabled,
  hidden,
}: {
  label: string;
  options: ChoiceOption<V>[];
  value: V | "";
  onChange: (v: V, el: HTMLElement) => void;
  kind?: "group" | "radio" | "tablist";
  className?: string;
  disabled?: boolean;
  hidden?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  useIndicator(host, value);
  const role = kind === "tablist" ? "tablist" : kind === "radio" ? "radiogroup" : "group";
  return (
    <div
      ref={host}
      className={"seg " + className}
      role={role}
      aria-label={label}
      hidden={hidden}
      onKeyDown={kind === "group" ? undefined : (e) => keys(e, options, onChange)}
    >
      <i className="seg-thumb" aria-hidden="true" />
      {options.map((o) => {
        const on = o.v === value;
        const a =
          kind === "tablist"
            ? { role: "tab", "aria-selected": on, tabIndex: on ? 0 : -1 }
            : kind === "radio"
              ? { role: "radio", "aria-checked": on, tabIndex: on || !value ? 0 : -1 }
              : { "aria-pressed": on };
        return (
          <button
            key={o.v}
            type="button"
            data-v={o.v}
            data-on={on}
            {...a}
            title={o.title}
            aria-label={o.aria}
            disabled={disabled || o.disabled}
            onClick={(e) => {
              press(e.currentTarget);
              onChange(o.v, e.currentTarget);
            }}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<V extends string>({
  label,
  options,
  value,
  onChange,
  id,
}: {
  label: string;
  options: ChoiceOption<V>[];
  value: V;
  onChange: (v: V) => void;
  id: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  useIndicator(host, value);
  return (
    <div ref={host} className="tabs" role="tablist" aria-label={label} onKeyDown={(e) => keys(e, options, onChange)}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            role="tab"
            id={`${id}-t-${o.v}`}
            data-v={o.v}
            data-on={on}
            aria-selected={on}
            aria-controls={o.controls}
            tabIndex={on ? 0 : -1}
            onClick={(e) => {
              press(e.currentTarget);
              onChange(o.v);
            }}
          >
            {o.l}
          </button>
        );
      })}
      <i className="tabs-ink" aria-hidden="true" />
    </div>
  );
}

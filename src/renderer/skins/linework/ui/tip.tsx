/**
 * The shared tooltip. Any element with data-tip="Label: value · Label: value" (and an
 * optional data-tip-t title) shows it on hover and keyboard focus; charts call tip.show
 * with rows and a pointer position. One tooltip element for the whole window.
 */
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { clamp, play } from "../../../motion/core";

export interface TipData {
  title?: string;
  detail?: string;
  rows?: [string, string][];
  swatch?: string;
}
interface TipState {
  data: TipData;
  target: Element;
  point?: { x: number; y: number };
  n: number;
}
let current: TipState | null = null,
  serial = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const tip = {
  show(target: Element, data: TipData, point?: { x: number; y: number }) {
    current = { data, target, point, n: ++serial };
    emit();
  },
  hide() {
    if (!current) return;
    current = null;
    emit();
  },
  owner: () => current?.target ?? null,
};

/** Attributes for an element with a delegated tooltip. */
export const tipAttrs = (title: string, detail: string) => ({ "data-tip-t": title, "data-tip": detail });

const rowsOf = (d: TipData): [string, string][] =>
  d.rows ??
  String(d.detail ?? "")
    .split(" · ")
    .filter(Boolean)
    .map((r) => {
      const i = r.indexOf(": ");
      return i < 0 ? [r, ""] : [r.slice(0, i), r.slice(i + 2)];
    });

export function TipLayer() {
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  const el = useRef<HTMLDivElement>(null),
    shownFor = useRef<Element | null>(null);

  // Delegated hover and focus for [data-tip].
  useEffect(() => {
    const show = (e: Event) => {
      const t = (e.target as Element | null)?.closest?.("[data-tip]");
      if (!t || t === tip.owner()) return;
      const d = (t as HTMLElement).dataset;
      tip.show(t, { title: d.tipT ?? "", detail: d.tip ?? "" });
    };
    const hide = (e: Event) => {
      const t = (e.target as Element | null)?.closest?.("[data-tip]");
      const related = (e as MouseEvent).relatedTarget as Node | null;
      if (t && t === tip.owner() && !t.contains(related)) tip.hide();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") tip.hide();
    };
    const scroll = () => tip.hide();
    document.addEventListener("mouseover", show);
    document.addEventListener("mouseout", hide);
    document.addEventListener("focusin", show);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", key);
    document.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("mouseover", show);
      document.removeEventListener("mouseout", hide);
      document.removeEventListener("focusin", show);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", key);
      document.removeEventListener("scroll", scroll, true);
    };
  }, []);

  // A tooltip whose owner left the page goes with it.
  useEffect(() => {
    if (!state) return;
    const timer = setInterval(() => {
      if (current && !current.target.isConnected) tip.hide();
    }, 400);
    return () => clearInterval(timer);
  }, [state]);

  useLayoutEffect(() => {
    const box = el.current;
    if (!box || !state) {
      shownFor.current = null;
      return;
    }
    const r = state.point
      ? { left: state.point.x, top: state.point.y, bottom: state.point.y, width: 0 }
      : state.target.getBoundingClientRect();
    const tw = box.offsetWidth,
      th = box.offsetHeight;
    let x = state.point ? r.left + 14 : r.left + r.width / 2 - tw / 2;
    let y = r.bottom + 10;
    if (y + th > innerHeight - 8) y = r.top - th - 10;
    if (state.point && x + tw > innerWidth - 8) x = r.left - tw - 14;
    box.style.left = clamp(x, 8, innerWidth - tw - 8) + "px";
    box.style.top = clamp(y, 8, innerHeight - th - 8) + "px";
    // Pops in when it appears for a new owner; follows the pointer without replaying.
    if (shownFor.current !== state.target)
      play(box, [{ opacity: 0, transform: "translateY(4px) scale(0.98)" }, { opacity: 1, transform: "none" }], { duration: 140 });
    shownFor.current = state.target;
  }, [state]);

  if (!state) return null;
  const rows = rowsOf(state.data);
  return (
    <div className="tip" role="tooltip" ref={el}>
      {state.data.title && (
        <strong>
          {state.data.swatch && <i style={{ background: state.data.swatch }} />}
          {state.data.title}
        </strong>
      )}
      {rows.length > 0 && (
        <dl>
          {rows.map(([k, v], i) => (
            <div key={i}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

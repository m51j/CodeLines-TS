/**
 * Motion primitives shared by the Instrument and Linework skins (ported from both
 * prototypes): rAF tweens, a Web Animations wrapper, staggered entrances, FLIP and
 * count-ups. Everything respects the merged reduced-motion flag on <html>.
 */
import { useLayoutEffect, useRef, type RefObject } from "react";
import { reducedMotion } from "../appearance/apply";
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const ease = {
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  expo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
  spring: (t: number) => {
    const c4 = (2 * Math.PI) / 3.2;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  linear: (t: number) => t,
};
export type Easing = (t: number) => number;
export const reduced = () => reducedMotion();
export interface Tween {
  cancel(): void;
}
/** Runs fn(easedT, rawT) every frame for `dur` ms; reduced motion jumps straight to the end. */
export function tween(
  dur: number,
  fn: (t: number, raw: number) => void,
  opt: { ease?: Easing; delay?: number; done?: () => void } = {},
): Tween {
  if (reduced() || dur <= 0) {
    fn(1, 1);
    opt.done?.();
    return { cancel() {} };
  }
  const e = opt.ease ?? ease.out,
    delay = opt.delay ?? 0;
  let raf = 0,
    start = 0,
    dead = false;
  const end = () => {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    clearTimeout(guard);
    fn(1, 1);
    opt.done?.();
  };
  const step = (now: number) => {
    if (dead) return;
    if (!start) start = now;
    const raw = clamp((now - start - delay) / dur, 0, 1);
    if (raw >= 1) return end();
    if (now - start >= delay) fn(e(raw), raw);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  // Frames stop in a hidden or throttled window: never leave a value half-way.
  const guard = setTimeout(end, delay + dur + 400);
  return {
    cancel() {
      dead = true;
      cancelAnimationFrame(raf);
      clearTimeout(guard);
    },
  };
}
/** Element.animate that respects reduced motion (opacity only, short). */
export function play(
  el: Element | null | undefined,
  frames: Keyframe[],
  opt: KeyframeAnimationOptions = {},
  easing = "cubic-bezier(0.22, 1, 0.36, 1)",
): Animation | null {
  if (!el || !("animate" in el)) return null;
  if (reduced()) {
    const o = frames.filter((f) => "opacity" in f).map((f) => ({ opacity: f.opacity }));
    return o.length > 1 ? el.animate(o, { duration: 90, fill: "backwards" }) : null;
  }
  return el.animate(frames, { duration: 240, easing, fill: "backwards", ...opt });
}
export function enter(
  el: Element | null | undefined,
  o: { x?: number; y?: number; delay?: number; dur?: number; scale?: number; easing?: string } = {},
) {
  const { x = 0, y = 10, delay = 0, dur = 300, scale } = o;
  return play(
    el,
    [
      { opacity: 0, transform: `translate(${x}px,${y}px)` + (scale ? ` scale(${scale})` : "") },
      { opacity: 1, transform: "none" },
    ],
    { duration: dur, delay },
    o.easing,
  );
}
export function stagger(
  els: Iterable<Element>,
  o: Parameters<typeof enter>[1] & { step?: number; max?: number } = {},
) {
  const step = o.step ?? 34,
    max = o.max ?? 420;
  let i = 0;
  for (const el of els) enter(el, { ...o, delay: (o.delay ?? 0) + Math.min(max, i++ * step) });
}
/** FLIP: measures, runs the change, then plays each moved element from its old box. */
export function flip(
  els: Element[],
  mutate: () => void,
  o: { dur?: number; clip?: number; easing?: string } = {},
) {
  if (reduced()) return mutate();
  const before = new Map(els.map((el) => [el, el.getBoundingClientRect()]));
  mutate();
  for (const [el, a] of before) {
    if (!el.isConnected) continue;
    const b = el.getBoundingClientRect(),
      dx = a.left - b.left,
      dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    if (o.clip && Math.abs(dy) > o.clip) continue;
    el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], {
      duration: o.dur ?? 300,
      easing: o.easing ?? "cubic-bezier(0.22, 1, 0.36, 1)",
    });
  }
}
/**
 * FLIP for React lists: call `capture()` before a change that reorders keyed children
 * (e.g. in a sort handler); after the next render each moved child slides from its old place.
 */
export function useFlip<T extends HTMLElement>(
  container: RefObject<T | null>,
  selector: string,
  keyOf: (el: HTMLElement) => string | undefined,
  o: { dur?: number; clip?: number; maxItems?: number; enterNew?: boolean } = {},
) {
  const snapshot = useRef<Map<string, number> | null>(null);
  useLayoutEffect(() => {
    const before = snapshot.current;
    snapshot.current = null;
    const root = container.current;
    if (!before || !root || reduced()) return;
    const els = [...root.querySelectorAll<HTMLElement>(selector)];
    if (o.maxItems && els.length > o.maxItems) return;
    els.forEach((el, i) => {
      const k = keyOf(el);
      const top = k === undefined ? undefined : before.get(k);
      if (top === undefined) {
        if (o.enterNew)
          el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
            duration: 220,
            delay: Math.min(i * 12, 160),
            easing: "ease-out",
            fill: "backwards",
          });
        return;
      }
      const dy = top - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 1 && (!o.clip || Math.abs(dy) < o.clip))
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
          duration: o.dur ?? 300,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        });
    });
  });
  return () => {
    const root = container.current;
    if (!root) return;
    const m = new Map<string, number>();
    root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      const k = keyOf(el);
      if (k !== undefined) m.set(k, el.getBoundingClientRect().top);
    });
    snapshot.current = m;
  };
}
/** Values last shown per key, so a readout counts on from where it was across page visits. */
const memory = new Map<string, number>();
/**
 * Counts a readout's text from its previous value to `value`. The first appearance counts
 * up from zero (with `delay`), later changes from the last shown value; text values are set as is.
 */
export function useCount<T extends HTMLElement>(
  value: number | string | null | undefined,
  format: (v: number) => string,
  o: { key?: string; dur?: number; firstDur?: number; delay?: number; ease?: Easing } = {},
) {
  const ref = useRef<T>(null),
    shown = useRef<number | null>(o.key !== undefined ? (memory.get(o.key) ?? null) : null),
    tw = useRef<Tween | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    tw.current?.cancel();
    if (typeof value !== "number" || !Number.isFinite(value)) {
      el.textContent = value == null ? "—" : String(value);
      shown.current = null;
      return;
    }
    const first = shown.current === null,
      from = first ? 0 : shown.current!;
    shown.current = value;
    if (o.key !== undefined) memory.set(o.key, value);
    if (from === value) {
      el.textContent = format(value);
      return;
    }
    el.textContent = format(from);
    tw.current = tween(
      first ? (o.firstDur ?? 760) : (o.dur ?? 520),
      (t) => {
        el.textContent = format(from + (value - from) * t);
      },
      { ease: o.ease ?? ease.expo, delay: first ? o.delay : 0 },
    );
    return () => tw.current?.cancel();
    // Only a new value restarts the count; a new format function identity must not.
  }, [value]);
  return ref;
}

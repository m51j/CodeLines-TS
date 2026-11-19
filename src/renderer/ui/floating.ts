/**
 * Floating layers shared by every skin's dropdowns and date pickers: placement next to an
 * anchor, closing on an outside press or Escape, and a stack so a list opened inside a
 * popover (the Classic appearance popover, an Instrument .pop) closes on its own without
 * taking its parent with it.
 */
import { useLayoutEffect, useRef, type RefObject } from "react";
import { clamp, play } from "../motion/core";

/** Positions a floating element next to an anchor, flipping above when there is no room below. */
export function place(el: HTMLElement, anchor: Element, placement = "bottom-start", gap = 8) {
  const a = anchor.getBoundingClientRect();
  const w = el.offsetWidth,
    ht = el.offsetHeight,
    vw = innerWidth,
    vh = innerHeight;
  let [side] = placement.split("-");
  const align = placement.split("-")[1];
  if (side === "bottom" && a.bottom + gap + ht > vh - 8 && a.top - gap - ht > 8) side = "top";
  if (side === "top" && a.top - gap - ht < 8) side = "bottom";
  let x = align === "end" ? a.right - w : align === "center" ? a.left + a.width / 2 - w / 2 : a.left;
  let y = side === "top" ? a.top - gap - ht : a.bottom + gap;
  x = clamp(x, 8, Math.max(8, vw - w - 8));
  y = clamp(y, 8, Math.max(8, vh - ht - 8));
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.transformOrigin = `${clamp(a.left + a.width / 2 - x, 0, w)}px ${side === "top" ? ht : 0}px`;
  el.dataset.side = side;
}

const stack: HTMLElement[] = [];
/** True while one of these layers is open: other popovers leave Escape and outside presses to it. */
export const hasOpenLayer = () => stack.length > 0;
/** True when a press landed in one of these layers (other popovers should not treat it as outside). */
export const inFloatingLayer = (target: EventTarget | null) => target instanceof Element && !!target.closest("[data-floating]");

/**
 * Wires one open layer: places it under `anchor` (and keeps it there while it or the page
 * changes), plays the entrance, and calls `onClose` on an outside press, Escape, a window
 * resize or blur. Only the topmost layer reacts, so nested layers close one at a time.
 * Escape is consumed so a parent popover does not also close.
 */
export function useFloating(
  el: RefObject<HTMLElement | null>,
  anchor: HTMLElement | null,
  onClose: (reason: "outside" | "escape" | "resize") => void,
  { placement = "bottom-start", gap = 6, matchWidth = false } = {},
) {
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const node = el.current;
    if (!node || !anchor) return;
    if (matchWidth) node.style.minWidth = anchor.getBoundingClientRect().width + "px";
    const reposition = () => place(node, anchor, placement, gap);
    reposition();
    play(node, [{ opacity: 0, transform: `scale(.97) translateY(${node.dataset.side === "top" ? 4 : -4}px)` }, { opacity: 1, transform: "none" }], { duration: 160 });
    stack.push(node);
    const top = () => stack.at(-1) === node;
    const down = (e: PointerEvent) => {
      if (!top()) return;
      const t = e.target as Node;
      if (node.contains(t) || anchor.contains(t)) return;
      close.current("outside");
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !top()) return;
      e.preventDefault();
      e.stopPropagation();
      close.current("escape");
    };
    const resize = () => close.current("resize");
    // Scrolling the page moves the anchor; scrolling inside the layer does not.
    const scroll = (e: Event) => {
      if (!(e.target instanceof Node) || !node.contains(e.target)) reposition();
    };
    const ro = new ResizeObserver(reposition);
    ro.observe(node);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    addEventListener("resize", resize);
    addEventListener("blur", resize);
    document.addEventListener("scroll", scroll, true);
    return () => {
      stack.splice(stack.indexOf(node), 1);
      ro.disconnect();
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
      removeEventListener("resize", resize);
      removeEventListener("blur", resize);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [el, anchor, placement, gap, matchWidth]);
}


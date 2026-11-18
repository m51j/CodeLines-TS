import { useLayoutEffect, useRef, type RefObject } from "react";
import { clamp, play } from "./core";

/** A popover placed under its trigger; closes on Escape or a press outside. */
export function usePopover(
  el: RefObject<HTMLElement | null>,
  trigger: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const box = el.current,
      t = trigger.current;
    if (!box) return;
    const r = t?.getBoundingClientRect(),
      mw = box.offsetWidth,
      mh = box.offsetHeight;
    box.style.left = clamp(r ? r.right - mw : 8, 8, innerWidth - mw - 8) + "px";
    box.style.top = clamp(r ? r.bottom + 6 : 8, 8, innerHeight - mh - 8) + "px";
    box.style.transformOrigin = "top right";
    play(box, [{ opacity: 0, transform: "translateY(-6px) scale(0.97)" }, { opacity: 1, transform: "none" }], { duration: 180 });
    box.querySelector<HTMLElement>('[tabindex="0"], button:not(:disabled), input')?.focus();
    const down = (e: PointerEvent) => {
      if (!box.contains(e.target as Node) && !t?.contains(e.target as Node)) close.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close.current();
        t?.focus();
      }
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [el, trigger]);
}

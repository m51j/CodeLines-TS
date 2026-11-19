/** Popovers, menus and toasts (the prototype's CL.popover / CL.menu / CL.toast) as React components. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { play } from "../../../motion/core";
import { place, tip } from "../overlay";
import { hasOpenLayer, inFloatingLayer } from "../../../ui/floating";
import { Icon, type IconName } from "../icons";
/** Open/close state for one anchored popover: `toggle(e.currentTarget)` from its button. */
export function usePopover() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const toggle = useCallback((el: HTMLElement) => setAnchor((a) => (a === el ? null : el)), []);
  const close = useCallback(() => setAnchor(null), []);
  return { anchor, toggle, close, open: !!anchor };
}
/** Scales from its anchor; closes on an outside press, Escape, a resize, or a second click on the anchor. */
export function Popover({
  anchor,
  onClose,
  placement = "bottom-start",
  label,
  className,
  role = "dialog",
  children,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  placement?: string;
  label?: string;
  className?: string;
  role?: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState<HTMLElement | null>(anchor);
  const el = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  if (anchor && anchor !== shown) setShown(anchor);
  // Leaving: play the exit, then unmount.
  useEffect(() => {
    if (anchor || !shown) return;
    const node = el.current;
    const a = play(node, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.97)" }], { duration: 110, fill: "forwards" });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setShown(null);
    };
    if (a) a.onfinish = finish;
    const t = setTimeout(finish, a ? 280 : 0);
    if (node?.contains(document.activeElement)) shown.focus({ preventScroll: true });
    shown.setAttribute("aria-expanded", "false");
    return () => clearTimeout(t);
  }, [anchor, shown]);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node || !anchor) return;
    place(node, anchor, placement);
    play(node, [{ opacity: 0, transform: "scale(.96) translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: 170 });
    anchor.setAttribute("aria-expanded", "true");
    tip.hide();
    const first = node.querySelector<HTMLElement>("[autofocus],button:not(:disabled),input,select,[tabindex='0']");
    (first ?? node).focus({ preventScroll: true });
  }, [anchor, placement]);
  useEffect(() => {
    if (!anchor) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (el.current?.contains(t) || anchor.contains(t) || t.closest?.(".pop") || hasOpenLayer() || inFloatingLayer(t)) return;
      closeRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !hasOpenLayer()) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    const resize = () => closeRef.current();
    const id = setTimeout(() => {
      document.addEventListener("pointerdown", down, true);
      document.addEventListener("keydown", key, true);
      addEventListener("resize", resize);
    });
    return () => {
      clearTimeout(id);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
      removeEventListener("resize", resize);
    };
  }, [anchor]);
  // Keep it next to its anchor when its content changes size.
  useEffect(() => {
    const node = el.current;
    if (!node || !anchor) return;
    const ro = new ResizeObserver(() => place(node, anchor, placement));
    ro.observe(node);
    return () => ro.disconnect();
  }, [anchor, placement]);
  if (!shown) return null;
  return createPortal(
    <div ref={el} className={"pop " + (className ?? "")} role={role} aria-label={label} tabIndex={-1}>
      {children}
    </div>,
    document.body,
  );
}
export interface MenuItem {
  label: string;
  hint?: string;
  icon?: IconName;
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
  kbd?: string;
  onSelect: () => void;
}
export function Menu({ items, label, onClose }: { items: (MenuItem | { heading: string } | { sep: true })[]; label: string; onClose: () => void }) {
  return (
    <div
      className="menu"
      role="menu"
      aria-label={label}
      onKeyDown={(e) => {
        const btns = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(".menu-item:not(:disabled)")],
          i = btns.indexOf(document.activeElement as HTMLButtonElement);
        const to =
          e.key === "ArrowDown" ? (i + 1) % btns.length : e.key === "ArrowUp" ? (i + btns.length - 1) % btns.length : e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : -1;
        if (to >= 0) {
          e.preventDefault();
          btns[to].focus();
        }
      }}
    >
      {items.map((it, i) =>
        "sep" in it ? (
          <div key={i} className="menu-sep" role="separator" />
        ) : "heading" in it ? (
          <div key={i} className="menu-head">
            {it.heading}
          </div>
        ) : (
          <button
            key={i}
            type="button"
            className={"menu-item" + (it.danger ? " is-danger" : "")}
            role={it.checked !== undefined ? "menuitemcheckbox" : "menuitem"}
            aria-checked={it.checked}
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onSelect();
            }}
          >
            <span className="menu-ico">{it.checked !== undefined ? it.checked && <Icon name="check" size={15} /> : it.icon && <Icon name={it.icon} size={15} />}</span>
            <span className="menu-text">
              <span>{it.label}</span>
              {it.hint && <small>{it.hint}</small>}
            </span>
            {it.kbd && <kbd>{it.kbd}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}
/* ================= toasts ================= */
interface ToastItem {
  id: number;
  message: string;
  icon: IconName;
  tone?: "danger";
  ms: number;
  action?: { label: string; run: () => void };
}
let toasts: ToastItem[] = [],
  nextToast = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
/** Shows a short confirmation that rises from the bottom right and leaves sideways. */
export function toast(message: string, opt: { icon?: IconName; ms?: number; tone?: "danger"; action?: { label: string; run: () => void } } = {}) {
  toasts = [...toasts, { id: nextToast++, message, icon: opt.icon ?? "check", ms: opt.ms ?? 4200, tone: opt.tone, action: opt.action }].slice(-4);
  emit();
}
const dismiss = (id: number) => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
function Toast({ t }: { t: ToastItem }) {
  const ref = useRef<HTMLDivElement>(null),
    leaving = useRef(false);
  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    const a = play(ref.current, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(18px)" }], { duration: 180, fill: "forwards" });
    let gone = false;
    const done = () => {
      if (!gone) {
        gone = true;
        dismiss(t.id);
      }
    };
    if (a) a.onfinish = done;
    setTimeout(done, a ? 280 : 0);
  }, [t.id]);
  useLayoutEffect(() => {
    play(ref.current, [{ opacity: 0, transform: "translateY(14px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 260 });
    const timer = setTimeout(close, t.ms);
    return () => clearTimeout(timer);
  }, [close, t.ms]);
  return (
    <div ref={ref} className={"toast" + (t.tone ? " is-" + t.tone : "")} role="status">
      <Icon name={t.icon} size={16} />
      <span>{t.message}</span>
      {t.action && (
        <button
          type="button"
          className="toast-act"
          onClick={() => {
            t.action?.run();
            close();
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}
export function Toasts() {
  const list = useSyncExternalStore(subscribe, () => toasts);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <Toast key={t.id} t={t} />
      ))}
    </div>
  );
}

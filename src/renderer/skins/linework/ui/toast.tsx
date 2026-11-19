/** Toasts: drop in with a spring, show a countdown line, and leave on click or time. */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { play } from "../../../motion/core";
import { Icon } from "../icons";

type Kind = "ok" | "info" | "error";
interface Toast {
  id: number;
  message: string;
  kind: Kind;
  ms: number;
}
let toasts: Toast[] = [],
  serial = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const remove = (id: number) => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};

export function toast(message: string, kind: Kind = "ok", ms = 3200) {
  toasts = [...toasts.slice(-3), { id: ++serial, message, kind, ms }];
  emit();
}

function ToastItem({ t }: { t: Toast }) {
  const el = useRef<HTMLDivElement>(null),
    closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    const a = play(el.current, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(8px) scale(.98)" }], {
      duration: 180,
      fill: "forwards",
    });
    if (a) a.onfinish = () => remove(t.id);
    else remove(t.id);
  };
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    const timer = setTimeout(() => latest.current(), t.ms);
    return () => clearTimeout(timer);
  }, [t.ms]);
  return (
    <div ref={el} className={"toast toast-" + t.kind} role="status" onClick={close}>
      <Icon name={t.kind === "error" ? "alert" : t.kind === "info" ? "info" : "check"} />
      <span>{t.message}</span>
      <i className="toast-timer" style={{ animationDuration: t.ms + "ms" }} />
    </div>
  );
}

export function Toasts() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}

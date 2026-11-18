/**
 * A themed replacement for <select>: a button that opens a listbox in a floating layer.
 * Focus stays on the button (the "select-only combobox" pattern), so screen readers follow
 * the active option through aria-activedescendant. Every skin styles it through --ui-* tokens.
 */
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useFloating } from "./floating";

export interface SelectOption<T extends string = string> {
  value: T;
  label: ReactNode;
  /** Text typeahead matches against when the label is not a plain string. */
  text?: string;
  hint?: ReactNode;
  disabled?: boolean;
}
export interface SelectProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  id?: string;
  disabled?: boolean;
  /** Extra classes on the button. */
  className?: string;
  /** Extra classes on the floating list. */
  listClassName?: string;
  placeholder?: ReactNode;
}
const textOf = (o: SelectOption) => (o.text ?? (typeof o.label === "string" || typeof o.label === "number" ? String(o.label) : o.value)).toLowerCase();

export function Select<T extends string>({
  value,
  options,
  onChange,
  id,
  disabled,
  className,
  listClassName,
  placeholder,
  ...aria
}: SelectProps<T>) {
  const listId = useId(),
    buttonId = id ?? listId + "-button";
  const button = useRef<HTMLButtonElement>(null),
    list = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(-1);
  const typed = useRef({ text: "", at: 0 });
  const open = !!anchor;
  const selected = options.findIndex((o) => o.value === value);
  const enabled = (i: number) => !!options[i] && !options[i].disabled;
  /** The nearest enabled option from `from` moving by `dir`, staying in bounds. */
  const step = (from: number, dir: number) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (enabled(i)) return i;
    return enabled(from) ? from : -1;
  };
  const first = () => step(-1, 1),
    last = () => step(options.length, -1);
  const show = (at?: number) => {
    if (disabled || !button.current) return;
    setActive(at ?? (enabled(selected) ? selected : first()));
    setAnchor(button.current);
  };
  const hide = () => setAnchor(null);
  const choose = (i: number) => {
    if (!enabled(i)) return;
    hide();
    button.current?.focus({ preventScroll: true });
    if (options[i].value !== value) onChange(options[i].value);
  };
  /** Typeahead: repeated presses of one letter cycle through its matches. */
  const seek = (ch: string) => {
    const now = Date.now(),
      t = typed.current;
    t.text = now - t.at > 700 ? ch : t.text + ch;
    t.at = now;
    const cycling = t.text.length > 1 && [...t.text].every((c) => c === t.text[0]);
    const needle = cycling ? t.text[0] : t.text,
      from = open ? active : selected;
    for (let k = 1; k <= options.length; k++) {
      const i = (from + (cycling || t.text.length === 1 ? k : k - 1) + options.length) % options.length;
      if (enabled(i) && textOf(options[i]).startsWith(needle)) return i;
    }
    return -1;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const k = e.key;
    if (!open) {
      if (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " " || k === "F4") {
        e.preventDefault();
        show();
      } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && k !== " ") {
        const i = seek(k.toLowerCase());
        if (i >= 0) show(i);
      }
      return;
    }
    /** The enabled option nearest to index i, looking past it in direction dir first. */
    const near = (i: number, dir: number) => {
      const at = Math.max(0, Math.min(options.length - 1, i));
      if (enabled(at)) return at;
      const fwd = step(at, dir);
      return fwd >= 0 && fwd !== at ? fwd : step(at, -dir);
    };
    if (e.altKey && (k === "ArrowDown" || k === "ArrowUp")) {
      e.preventDefault();
      return choose(active);
    }
    const moves: Record<string, () => number> = {
      ArrowDown: () => step(active, 1),
      ArrowUp: () => step(active, -1),
      Home: first,
      End: last,
      PageDown: () => near(active + 8, -1),
      PageUp: () => near(active - 8, 1),
    };
    if (moves[k]) {
      e.preventDefault();
      const to = moves[k]();
      if (to >= 0) setActive(to);
    } else if (k === "Enter" || (k === " " && Date.now() - typed.current.at > 700)) {
      e.preventDefault();
      choose(active);
    } else if (k === "Tab") {
      hide();
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const i = seek(k.toLowerCase());
      if (i >= 0) setActive(i);
    }
  };
  useFloating(list, anchor, hide, { matchWidth: true, gap: 4 });
  useLayoutEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  const current = options[selected];
  return (
    <>
      <button
        ref={button}
        type="button"
        id={buttonId}
        className={"ui-trigger ui-select" + (className ? " " + className : "")}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? hide() : show())}
        onKeyDown={onKeyDown}
        {...aria}
      >
        <span className={"ui-select-value" + (current ? "" : " is-placeholder")}>{current ? current.label : placeholder}</span>
        <ChevronDown className="ui-ico ui-select-chev" size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={list}
            id={listId}
            className={"ui-pop ui-listbox" + (listClassName ? " " + listClassName : "")}
            role="listbox"
            aria-label={aria["aria-label"]}
            aria-labelledby={aria["aria-label"] ? undefined : (aria["aria-labelledby"] ?? buttonId)}
            data-floating=""
            tabIndex={-1}
            // Keep focus on the button while the list is used with the pointer.
            onPointerDown={(e) => e.preventDefault()}
          >
            {options.map((o, i) => (
              <div
                key={o.value}
                id={`${listId}-${i}`}
                data-i={i}
                role="option"
                aria-selected={i === selected}
                aria-disabled={o.disabled || undefined}
                className={"ui-option" + (i === active ? " is-active" : "") + (i === selected ? " is-selected" : "")}
                onPointerMove={() => i !== active && enabled(i) && setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="ui-option-check" aria-hidden="true">
                  {i === selected && <Check className="ui-ico" size={14} />}
                </span>
                <span className="ui-option-text">
                  <span>{o.label}</span>
                  {o.hint && <small>{o.hint}</small>}
                </span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

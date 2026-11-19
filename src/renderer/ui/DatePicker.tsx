/** A single-day picker: a button with the chosen day that opens one month; only `available` days can be picked. */
import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Calendar, MonthNav, useDayFocus } from "./Calendar";
import { addMonths, formatDay, isDay, monthOf, type Day } from "./dates";
import { useFloating } from "./floating";

export interface DatePickerProps {
  value: Day;
  onChange: (day: Day) => void;
  /** The days that can be picked; any day when omitted. */
  available?: readonly Day[];
  /** The button's accessible name, e.g. "Comparison date A". */
  label: string;
  today?: Day;
  className?: string;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function DatePicker({ value, onChange, available, label, today, className, id, disabled, placeholder = "Pick a day" }: DatePickerProps) {
  const button = useRef<HTMLButtonElement>(null),
    pop = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [view, setView] = useState(() => monthOf(isDay(value) ? value : (today ?? "2000-01-01")));
  const [focus, setFocus] = useState<Day>(value);
  const armFocus = useDayFocus(pop, focus);
  const open = !!anchor;
  const allowed = useMemo(() => (available ? new Set(available) : null), [available]);
  const bounds = useMemo(() => {
    if (!available?.length) return null;
    const sorted = [...available].sort();
    return { first: monthOf(sorted[0]), last: monthOf(sorted.at(-1)!) };
  }, [available]);

  const show = () => {
    if (!button.current) return;
    const d = isDay(value) ? value : (available?.at(-1) ?? today ?? "");
    if (!d) return;
    setView(monthOf(d));
    setFocus(d);
    setAnchor(button.current);
  };
  const hide = () => {
    if (pop.current?.contains(document.activeElement)) button.current?.focus({ preventScroll: true });
    setAnchor(null);
  };
  useFloating(pop, anchor, hide);
  // Focus the chosen day when the month opens.
  useEffect(() => {
    if (open) pop.current?.querySelector<HTMLElement>("[data-day][tabindex='0']")?.focus({ preventScroll: true });
  }, [open]);
  const blur = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && !pop.current?.contains(to) && !button.current?.contains(to)) hide();
  };
  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        className={"ui-trigger ui-date-trigger" + (className ? " " + className : "")}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? hide() : show())}
      >
        <CalendarDays className="ui-ico" size={15} aria-hidden="true" />
        <span className="ui-sr">{label}: </span>
        <span className={"ui-select-value" + (isDay(value) ? "" : " is-placeholder")}>{isDay(value) ? formatDay(value) : placeholder}</span>
        <ChevronDown className="ui-ico ui-select-chev" size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div ref={pop} className="ui-pop ui-dp" role="dialog" aria-label={label} data-floating="" tabIndex={-1} onBlur={blur}>
            <div className="ui-drp-cals">
              <MonthNav
                onPrev={() => setView((v) => addMonths(v, -1))}
                onNext={() => setView((v) => addMonths(v, 1))}
                prevDisabled={!!bounds && view <= bounds.first}
                nextDisabled={!!bounds && view >= bounds.last}
              />
              <Calendar
                month={view}
                focus={focus}
                today={today}
                start={value}
                end={value}
                isDisabled={allowed ? (d) => !allowed.has(d) : undefined}
                onPick={(d) => {
                  hide();
                  if (d !== value) onChange(d);
                }}
                onFocusDay={(d) => {
                  armFocus();
                  setFocus(d);
                  setView(monthOf(d));
                }}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

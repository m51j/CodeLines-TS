/** One month as a keyboard-navigable grid, used by DateRangePicker and DatePicker. */
import { useId, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatLongDay, formatMonth, monthGrid, monthOf, shiftMonths, weekday, WEEKDAY_NAMES, WEEKDAYS, type Day, type Month } from "./dates";

export interface CalendarProps {
  month: Month;
  /** The day that holds the roving tab stop. */
  focus: Day;
  onFocusDay: (day: Day) => void;
  onPick: (day: Day) => void;
  onHover?: (day: Day | null) => void;
  isDisabled?: (day: Day) => boolean;
  /** The highlighted span (already ordered); either end may be empty. */
  start?: Day;
  end?: Day;
  today?: Day;
}
export function Calendar({ month, focus, onFocusDay, onPick, onHover, isDisabled, start = "", end = "", today }: CalendarProps) {
  const titleId = useId();
  const days = monthGrid(month);
  const key = (e: KeyboardEvent) => {
    const step: Record<string, () => Day> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      Home: () => addDays(focus, -weekday(focus)),
      End: () => addDays(focus, 6 - weekday(focus)),
      PageUp: () => shiftMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => shiftMonths(focus, e.shiftKey ? 12 : 1),
    };
    const next = step[e.key]?.();
    if (!next) return;
    e.preventDefault();
    onFocusDay(next);
  };
  return (
    <div className="ui-cal">
      <div className="ui-cal-title" id={titleId}>
        {formatMonth(month)}
      </div>
      <div className="ui-cal-grid" role="grid" aria-labelledby={titleId} onKeyDown={key} onPointerLeave={() => onHover?.(null)}>
        <div className="ui-cal-row ui-cal-head" role="row">
          {WEEKDAYS.map((w, i) => (
            <span key={w} role="columnheader" aria-label={WEEKDAY_NAMES[i]}>
              {w}
            </span>
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div className="ui-cal-row" role="row" key={row}>
            {days.slice(row * 7, row * 7 + 7).map((d) => {
              if (monthOf(d) !== month) return <span key={d} role="gridcell" className="ui-day-blank" />;
              const off = isDisabled?.(d) ?? false,
                a = start || end,
                b = end || start,
                inRange = !!a && d >= a && d <= b,
                edge = d === a || d === b;
              const cls = [
                "ui-day",
                inRange && "is-in-range",
                d === a && "is-start",
                d === b && "is-end",
                edge && "is-edge",
                d === today && "is-today",
                off && "is-disabled",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <span key={d} role="gridcell" aria-selected={inRange} className={inRange ? "ui-cell is-in-range" + (d === a ? " is-start" : "") + (d === b ? " is-end" : "") : "ui-cell"}>
                  <button
                    type="button"
                    className={cls}
                    data-day={d}
                    tabIndex={d === focus ? 0 : -1}
                    aria-label={formatLongDay(d) + (d === today ? ", today" : "")}
                    aria-disabled={off || undefined}
                    aria-current={d === today ? "date" : undefined}
                    onClick={() => {
                      onFocusDay(d);
                      if (!off) onPick(d);
                    }}
                    onPointerEnter={() => !off && onHover?.(d)}
                    onFocus={() => !off && onHover?.(d)}
                  >
                    {Number(d.slice(8))}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Previous / next month buttons, placed over the calendar titles. */
export function MonthNav({ onPrev, onNext, prevDisabled, nextDisabled }: { onPrev: () => void; onNext: () => void; prevDisabled?: boolean; nextDisabled?: boolean }) {
  return (
    <>
      <button type="button" className="ui-cal-nav is-prev" aria-label="Previous month" disabled={prevDisabled} onClick={onPrev}>
        <ChevronLeft className="ui-ico" size={16} aria-hidden="true" />
      </button>
      <button type="button" className="ui-cal-nav is-next" aria-label="Next month" disabled={nextDisabled} onClick={onNext}>
        <ChevronRight className="ui-ico" size={16} aria-hidden="true" />
      </button>
    </>
  );
}

/**
 * Moves DOM focus to the focused day after keyboard navigation re-renders the grid
 * (and after the visible months shift to include it). `request()` arms it once.
 */
export function useDayFocus(root: RefObject<HTMLElement | null>, focus: Day) {
  const armed = useRef(false);
  useLayoutEffect(() => {
    if (!armed.current) return;
    armed.current = false;
    root.current?.querySelector<HTMLElement>(`[data-day="${focus}"]`)?.focus({ preventScroll: true });
  }, [root, focus]);
  return () => {
    armed.current = true;
  };
}

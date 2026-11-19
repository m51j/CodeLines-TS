/**
 * A date range picker: a button showing the current range ("Last 30 days", "Jan 3 – 9, 2026")
 * that opens presets, two months to click a start and an end on, and typed From / To fields.
 * A preset applies at once; a custom range applies on the second click.
 */
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Calendar, MonthNav, useDayFocus } from "./Calendar";
import { addMonths, isDay, monthOf, PRESETS, rangeLabel, resolveRange, type Day, type PresetId, type RangeValue } from "./dates";
import { useFloating } from "./floating";

export interface DateRangePickerProps {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
  /** Today in the data's time zone; presets count back from it and later days cannot be clicked. */
  today: Day;
  /** The button's accessible name, e.g. "Report date range". */
  label?: string;
  startLabel?: string;
  endLabel?: string;
  invalid?: boolean;
  /** The id of an error message to link to. */
  describedBy?: string;
  className?: string;
  presets?: readonly PresetId[];
}

export function DateRangePicker({
  value,
  onChange,
  today,
  label = "Date range",
  startLabel = "Start date",
  endLabel = "End date",
  invalid,
  describedBy,
  className,
  presets,
}: DateRangePickerProps) {
  const button = useRef<HTMLButtonElement>(null),
    pop = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = !!anchor;
  const resolved = resolveRange(value, today);
  const [view, setView] = useState<string>(() => monthOf(today));
  const [focus, setFocus] = useState<Day>(today);
  const [pending, setPending] = useState<Day | null>(null);
  const [hover, setHover] = useState<Day | null>(null);
  const [draft, setDraft] = useState({ since: resolved.since, until: resolved.until });
  const armFocus = useDayFocus(pop, focus);

  // Typed fields follow the applied range whenever it changes elsewhere.
  useEffect(() => setDraft((d) => (d.since === resolved.since ? d : { ...d, since: resolved.since })), [resolved.since]);
  useEffect(() => setDraft((d) => (d.until === resolved.until ? d : { ...d, until: resolved.until })), [resolved.until]);

  const showMonths = (day: Day) => {
    const m = monthOf(day);
    setView((v) => (m === v || m === addMonths(v, 1) ? v : m < v ? m : addMonths(m, -1)));
  };
  const show = () => {
    if (!button.current) return;
    // The range's last month on the right, the month before it on the left.
    const end = resolved.until || resolved.since || today;
    setView(addMonths(monthOf(end), -1));
    setFocus(end);
    setPending(null);
    setHover(null);
    setAnchor(button.current);
  };
  const hide = () => {
    if (pop.current?.contains(document.activeElement)) button.current?.focus({ preventScroll: true });
    setAnchor(null);
    setPending(null);
  };
  const apply = (v: RangeValue, close: boolean) => {
    onChange(v);
    if (close) hide();
  };
  useFloating(pop, anchor, hide, { placement: "bottom-end" });
  // Focus the selected preset (or the first) when the panel opens.
  useEffect(() => {
    if (!open) return;
    const node = pop.current;
    (node?.querySelector<HTMLElement>(".ui-drp-preset[aria-pressed='true']") ?? node?.querySelector<HTMLElement>(".ui-drp-preset"))?.focus({ preventScroll: true });
  }, [open]);

  const pick = (d: Day) => {
    if (!pending) {
      setPending(d);
      setHover(d);
      return;
    }
    const [since, until] = pending <= d ? [pending, d] : [d, pending];
    apply({ preset: "", since, until }, true);
  };
  const typed = (field: "since" | "until", text: string) => {
    setDraft((d) => ({ ...d, [field]: text }));
    const t = text.trim();
    if (t && !isDay(t)) return;
    setPending(null);
    apply({ preset: "", since: resolved.since, until: resolved.until, [field]: t }, false);
    if (t) {
      setFocus(t);
      showMonths(t);
    }
  };
  // Tabbing out of the panel closes it.
  const blur = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && !pop.current?.contains(to) && !button.current?.contains(to)) hide();
  };

  const lo = pending ? (hover && hover < pending ? hover : pending) : resolved.since,
    hi = pending ? (hover && hover > pending ? hover : pending) : resolved.until;
  const text = rangeLabel(value);
  const list = presets ? PRESETS.filter((p) => presets.includes(p.id)) : PRESETS;
  const calendar = (month: string) => (
    <Calendar
      month={month}
      focus={focus}
      today={today}
      start={lo}
      end={hi}
      isDisabled={(d) => d > today}
      onHover={(d) => pending && setHover(d)}
      onPick={pick}
      onFocusDay={(d) => {
        armFocus();
        setFocus(d);
        showMonths(d);
      }}
    />
  );
  return (
    <>
      <button
        ref={button}
        type="button"
        className={"ui-trigger ui-date-trigger" + (className ? " " + className : "")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? hide() : show())}
      >
        <CalendarDays className="ui-ico" size={15} aria-hidden="true" />
        <span className="ui-sr">{label}: </span>
        <span className="ui-select-value">{text}</span>
        <ChevronDown className="ui-ico ui-select-chev" size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div ref={pop} className="ui-pop ui-drp" role="dialog" aria-label={label} data-floating="" tabIndex={-1} onBlur={blur}>
            <div className="ui-drp-presets" role="group" aria-label="Presets">
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="ui-drp-preset"
                  aria-pressed={value.preset === p.id}
                  onClick={() => apply({ preset: p.id, since: "", until: "" }, true)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="ui-drp-main">
              <div className="ui-drp-fields">
                <label className="ui-drp-field">
                  <span>From</span>
                  <input
                    className="ui-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="YYYY-MM-DD"
                    spellCheck={false}
                    aria-label={startLabel}
                    aria-invalid={invalid || (!!draft.since.trim() && !isDay(draft.since.trim())) || undefined}
                    aria-describedby={describedBy}
                    value={draft.since}
                    onChange={(e) => typed("since", e.target.value)}
                  />
                </label>
                <span className="ui-drp-dash" aria-hidden="true">
                  –
                </span>
                <label className="ui-drp-field">
                  <span>To</span>
                  <input
                    className="ui-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="YYYY-MM-DD"
                    spellCheck={false}
                    aria-label={endLabel}
                    aria-invalid={invalid || (!!draft.until.trim() && !isDay(draft.until.trim())) || undefined}
                    aria-describedby={describedBy}
                    value={draft.until}
                    onChange={(e) => typed("until", e.target.value)}
                  />
                </label>
              </div>
              <div className="ui-drp-cals">
                <MonthNav onPrev={() => setView((v) => addMonths(v, -1))} onNext={() => setView((v) => addMonths(v, 1))} nextDisabled={addMonths(view, 1) >= monthOf(today)} />
                {calendar(view)}
                {calendar(addMonths(view, 1))}
              </div>
              <div className="ui-drp-foot">
                <span className="ui-drp-hint" aria-live="polite">
                  {pending ? "Pick the last day" : text}
                </span>
                <button type="button" className="ui-btn is-primary" onClick={hide}>
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

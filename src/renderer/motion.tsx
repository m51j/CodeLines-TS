// Motion adapted from claude-code-stats-widget (MIT): a rise when a value
// changes, a diagonal pop wave across heatmaps and bars that fill on mount.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
/** Restarts a CSS animation class on an element that is already showing it. */
export function replay(element: Element | null, className: string) {
  if (!element) return;
  element.classList.remove(className);
  void (element as HTMLElement).offsetWidth;
  element.classList.add(className);
}
/** Plays a short rise when the shown text changes; the first value and "—" placeholders appear still. */
export function Ticker({
  value,
  className,
}: {
  value: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null),
    previous = useRef<string | null>(null);
  useLayoutEffect(() => {
    const text = ref.current?.textContent ?? "";
    if (
      previous.current !== null &&
      previous.current !== "—" &&
      previous.current !== text
    )
      replay(ref.current, "tick");
    previous.current = text;
  });
  return (
    <span ref={ref} className={className ? "ticker " + className : "ticker"}>
      {value}
    </span>
  );
}
/** Delay of one heatmap cell: a wave from the top-left corner, kept under ~0.7 s for wide grids. */
export function popDelay(column: number, row: number, columns: number) {
  return Math.round(
    column * Math.min(14, 600 / Math.max(1, columns)) + row * 6,
  );
}
export const popStyle = (
  column: number,
  row: number,
  columns: number,
): CSSProperties =>
  ({ "--pop-delay": popDelay(column, row, columns) + "ms" }) as CSSProperties;
/** A bar that grows from zero to its width on mount and eases between later widths. */
export function FillBar({
  percent,
  className,
  style,
}: {
  percent: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setWidth(Math.max(0, Math.min(100, percent))),
    );
    return () => cancelAnimationFrame(frame);
  }, [percent]);
  return (
    <span className={className ? "fill-track " + className : "fill-track"}>
      <i style={{ ...style, width: width + "%" }} />
    </span>
  );
}

/**
 * Heatmaps (ported from the prototype's Heatmap). "calendar": one cell per day, weeks as
 * columns, Sunday–Saturday rows; "hours": 7 × 24 weekday-by-hour cells. Cells reveal in a
 * diagonal wave when the layout changes; a same-shape update only recolours them. Hovered
 * or focused cells lift; arrow keys move between cells.
 */
import { useLayoutEffect, useRef } from "react";
import { clamp } from "../../../motion/core";
import { day as dayFmt } from "../ui/fmt";

export interface HeatCell {
  key: string;
  value: number;
  detail: string;
  out?: boolean;
}
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Quantile levels over non-zero values: 0 = none, 1–6 = intensity (as the original). */
export function heatLevels(values: number[]) {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
  const stops = [0.2, 0.4, 0.6, 0.8, 0.95].map((p) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] ?? 0);
  return (v: number) => {
    if (!v) return 0;
    const i = stops.findIndex((s) => v <= s);
    return i < 0 ? 6 : i + 1;
  };
}
/** Delay of one cell: a diagonal wave from the top-left corner, kept under ~0.7 s. */
export const popDelay = (col: number, row: number, cols: number) => Math.round(col * Math.min(14, 600 / Math.max(1, cols)) + row * 6);

export function Heatmap({ mode, cells, label }: { mode: "calendar" | "hours"; cells: HeatCell[]; label: string }) {
  const cal = mode === "calendar",
    cols = cal ? Math.ceil(cells.length / 7) : 24;
  const host = useRef<HTMLDivElement>(null),
    grid = useRef<HTMLDivElement>(null);
  const lv = heatLevels(cells.map((c) => c.value));
  const title = (c: HeatCell) =>
    cal ? dayFmt(c.key) : `${WEEKDAYS[Number(c.key.split(":")[0])]} ${String(c.key.split(":")[1]).padStart(2, "0")}:00`;
  // A new layout replays the wave (cells remount); the same layout only recolours.
  const layout = `${mode}:${cells.length}:${cells[0]?.key ?? ""}:${cells.at(-1)?.key ?? ""}`;

  // Calendar cells grow to fill the card for short ranges and stay legible for long ones.
  useLayoutEffect(() => {
    if (!cal) return;
    const el = host.current;
    if (!el) return;
    const fit = () => {
      const g = grid.current,
        w = el.clientWidth;
      if (g && w) g.style.setProperty("--cell", clamp(Math.floor((w - 44) / cols) - 3, 11, 30) + "px");
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cal, cols]);
  useLayoutEffect(() => {
    if (!cal) return;
    const s = host.current?.querySelector<HTMLElement>(".hm-scroll");
    if (s) s.scrollLeft = s.scrollWidth;
  }, [cal, layout]);

  let months: { col: number; text: string }[] = [];
  if (cal) {
    // A label per month start; one whose next label is within two weeks is dropped (as the original).
    const labels: string[] = [];
    let lastM = "";
    for (let w = 0; w < cols; w++) {
      const d = cells[w * 7]?.key,
        m = d?.slice(0, 7);
      labels[w] =
        d && m !== lastM
          ? new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) +
            (d.slice(5, 7) === "01" || !lastM ? " ’" + d.slice(2, 4) : "")
          : "";
      if (m) lastM = m;
    }
    months = labels.flatMap((l, w) => (l && !labels.slice(w + 1, w + 3).some(Boolean) ? [{ col: w + 2, text: l }] : []));
  } else months = Array.from({ length: 24 }, (_, h) => ({ col: h + 2, text: h % 3 === 0 ? String(h).padStart(2, "0") : "" }));

  return (
    <div className="heatmap" ref={host}>
      <div className="hm-scroll">
        <div
          ref={grid}
          className={"hm-grid " + (cal ? "cal" : "hours")}
          role="grid"
          aria-label={label + ". Use arrow keys to move between cells."}
          style={{ ["--cols" as string]: cols }}
          onKeyDown={(e) => {
            const list = [...e.currentTarget.querySelectorAll<HTMLElement>(".hm-row .hm-cell")];
            const i = list.indexOf(document.activeElement as HTMLElement);
            if (i < 0) return;
            const step: Record<string, number> = cal
              ? { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }
              : { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -24, ArrowDown: 24 };
            const n = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : step[e.key] !== undefined ? i + step[e.key] : -1;
            if (n < 0 || n >= list.length) return;
            e.preventDefault();
            list[i].tabIndex = -1;
            list[n].tabIndex = 0;
            list[n].focus();
          }}
        >
          <div className="hm-months" role="presentation">
            {months.map((m) => (
              <span key={m.col} style={{ gridColumn: m.col }}>
                {m.text}
              </span>
            ))}
          </div>
          {WEEKDAYS.map((d, r) => (
            <span key={d} className="hm-day" style={{ gridRow: r + 2 }}>
              {cal && r % 2 === 0 ? "" : d}
            </span>
          ))}
          <div role="row" className="hm-row" key={layout}>
            {cells.map((c, i) => {
              const col = cal ? Math.floor(i / 7) : i % 24,
                row = cal ? i % 7 : Math.floor(i / 24),
                t = title(c);
              return (
                <span
                  key={c.key}
                  role="gridcell"
                  tabIndex={i === 0 ? 0 : -1}
                  className={`hm-cell l${c.out ? 0 : lv(c.value)}${c.out ? " out" : ""} pop`}
                  style={{ gridColumn: col + 2, gridRow: row + 2, ["--d" as string]: popDelay(col, row, cols) + "ms" }}
                  data-tip-t={t}
                  data-tip={c.detail}
                  aria-label={t + " · " + c.detail}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div className="hm-scale">
        <span>Less</span>
        {[0, 1, 2, 3, 4, 5, 6].map((l) => (
          <i key={l} className={"hm-cell l" + l} />
        ))}
        <span>More</span>
        <span className="hm-help">Hover or focus a cell for exact values</span>
      </div>
    </div>
  );
}

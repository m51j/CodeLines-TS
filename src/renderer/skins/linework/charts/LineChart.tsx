/** A multi-line chart with bars behind it: lines draw in, bars rise, a crosshair reads each day. */
import { useRef, useState } from "react";
import { clamp } from "../../../motion/core";
import { tip } from "../ui/tip";
import { axis, day, shortDay } from "../ui/fmt";
import { niceMax, useWidth } from "./StackedBars";

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

export function LineChart({
  keys,
  series,
  bars,
  height = 220,
  label,
  tipRows,
}: {
  keys: string[];
  series: LineSeries[];
  bars?: { label: string; color: string; values: number[] };
  height?: number;
  label: string;
  tipRows: (i: number) => [string, string][];
}) {
  const [host, hostW] = useWidth<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null),
    [focus, setFocus] = useState(-1);
  const W = Math.max(300, hostW || 600),
    padL = 54,
    padR = 54,
    padT = 12,
    padB = 26,
    plotW = W - padL - padR,
    plotH = height - padT - padB,
    n = keys.length;
  // Nice axis: round steps that span the data, not anchored at zero.
  const vals = series.flatMap((s) => s.values.filter((v): v is number => v != null)),
    lo = vals.length ? Math.min(...vals) : 0,
    hi = Math.max(1, ...vals);
  const stepY = niceMax(Math.max(1, hi - lo * 0.94) / 4),
    min = Math.max(0, Math.floor((lo * 0.97) / stepY) * stepY);
  let max = min + stepY * 4;
  while (max < hi) max += stepY;
  const bmax = bars ? niceMax(Math.max(1, ...bars.values)) : 1;
  const X = (i: number) => padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2),
    Y = (v: number) => padT + plotH - ((v - min) / (max - min || 1)) * plotH;
  const k = Math.round((max - min) / stepY),
    every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 90)))),
    bw = Math.max(1, (plotW / Math.max(1, n)) * 0.6);
  // The build animation replays when the data set changes, not on resize.
  const build = keys.join() + series.map((s) => s.values.join()).join("|");

  const show = (i: number, pt?: { x: number; y: number }) => {
    if (!n || !svg.current) return;
    i = clamp(i, 0, n - 1);
    setFocus(i);
    const r = svg.current.getBoundingClientRect();
    tip.show(svg.current, { title: day(keys[i]), rows: tipRows(i) }, pt ?? { x: r.left + (X(i) / W) * r.width, y: r.top + 24 });
  };
  const hide = () => {
    setFocus(-1);
    if (tip.owner() === svg.current) tip.hide();
  };
  return (
    <div className="chart linechart" ref={host}>
      <svg
        ref={svg}
        className="chart-svg"
        viewBox={`0 0 ${W} ${height}`}
        height={height}
        role="group"
        aria-roledescription="chart"
        tabIndex={0}
        aria-label={label + ". Use left and right arrow keys to read each day."}
        onPointerMove={(e) => {
          const r = svg.current!.getBoundingClientRect(),
            x = ((e.clientX - r.left) / r.width) * W;
          show(Math.round(((x - padL) / plotW) * (n - 1)), { x: e.clientX, y: e.clientY });
        }}
        onPointerLeave={hide}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            show(focus < 0 ? (e.key === "ArrowLeft" ? n - 1 : 0) : focus + (e.key === "ArrowRight" ? 1 : -1));
          } else if (e.key === "Home") show(0);
          else if (e.key === "End") show(n - 1);
          else if (e.key === "Escape") hide();
        }}
      >
        <g className="c-grid">
          {Array.from({ length: k + 1 }, (_, i) => {
            const y = padT + plotH - (plotH * i) / k;
            return (
              <g key={i}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} className={i ? "" : "base"} />
                <text x={padL - 8} y={y + 4} textAnchor="end">
                  {axis(min + stepY * i)}
                </text>
                {bars && (
                  <text x={W - padR + 8} y={y + 4} className="r">
                    {axis((bmax * i) / k)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
        <g className="c-x">
          {keys.map((key, i) =>
            i % every ? null : (
              <text key={key} x={X(i)} y={height - 8} textAnchor="middle">
                {shortDay(key)}
              </text>
            ),
          )}
        </g>
        <g className="lc-bars grow" key={"b" + build}>
          {bars?.values.map((v, i) => (
            <rect
              key={i}
              className="lc-bar"
              x={(X(i) - bw / 2).toFixed(1)}
              width={bw.toFixed(1)}
              y={(padT + plotH - (v / bmax) * plotH * 0.9).toFixed(1)}
              height={((v / bmax) * plotH * 0.9).toFixed(1)}
              style={{ ["--d" as string]: Math.round((i / Math.max(1, n)) * 300) + "ms", fill: bars.color }}
            />
          ))}
        </g>
        <g key={"l" + build}>
          {series.map((s) => {
            let d = "",
              started = false;
            s.values.forEach((v, i) => {
              if (v == null) return;
              d += (started ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1) + " ";
              started = true;
            });
            // A value with no neighbour draws no line: mark it as a point.
            const lone = s.values.flatMap((v, i) => (v != null && s.values[i - 1] == null && s.values[i + 1] == null ? [i] : []));
            return (
              <g key={s.key}>
                <path className="lc-line draw" pathLength={1} d={d} style={{ stroke: s.color }} />
                {lone.map((i) => (
                  <circle key={i} className="lc-pt" r={3.5} cx={X(i)} cy={Y(s.values[i]!)} style={{ fill: s.color }} />
                ))}
              </g>
            );
          })}
        </g>
        <line className={"lc-cross" + (focus >= 0 ? " on" : "")} x1={X(Math.max(0, focus))} x2={X(Math.max(0, focus))} y1={padT} y2={padT + plotH} />
        {series.map((s) => {
          const v = focus >= 0 ? s.values[focus] : null;
          return (
            <circle
              key={s.key}
              className={"lc-dot" + (v != null ? " on" : "")}
              r={4}
              cx={X(Math.max(0, focus))}
              cy={v == null ? -10 : Y(v)}
              style={{ fill: s.color }}
            />
          );
        })}
      </svg>
      <div className="c-legend static">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        {bars && (
          <span>
            <i className="bar" style={{ background: bars.color }} />
            {bars.label} (right axis)
          </span>
        )}
      </div>
    </div>
  );
}

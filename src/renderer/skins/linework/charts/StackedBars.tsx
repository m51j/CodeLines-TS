/**
 * Stacked bar chart (ported from the prototype's StackedBars). Bars are keyed: on a new
 * range, grouping or legend change each bar reshapes from its old size and position to
 * the new one; the first build grows in left to right. The legend hides a series on click
 * and isolates it on double-click; hovering a legend entry fades the others. Arrow keys
 * read each bar; the tooltip carries the full breakdown. An optional peak label rises in
 * and night bands can be shaded.
 */
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { clamp, ease, reduced, tween, type Tween } from "../../../motion/core";
import { tip } from "../ui/tip";
import { axis, number } from "../ui/fmt";

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}
export interface BarDatum {
  key: string;
  values: Record<string, number>;
  tip?: { title: string; detail: string };
}
interface Geo {
  x: number;
  w: number;
  segs: number[];
}
const SVG = "http://www.w3.org/2000/svg";

export function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))),
    n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null),
    [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function StackedBars({
  series,
  data,
  height = 260,
  label,
  xFmt = (k) => k,
  legend = true,
  peak = false,
  shade,
}: {
  series: BarSeries[];
  data: BarDatum[];
  height?: number;
  label: string;
  xFmt?: (key: string) => string;
  legend?: boolean;
  peak?: boolean;
  shade?: (d: BarDatum) => boolean;
}) {
  const [host, hostW] = useWidth<HTMLDivElement>();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [fade, setFade] = useState("");
  const svg = useRef<SVGSVGElement>(null),
    bars = useRef<SVGGElement>(null),
    hover = useRef<SVGRectElement>(null),
    geo = useRef(new Map<string, Geo>()),
    anim = useRef<{ t: Tween | null }>({ t: null }),
    built = useRef(false),
    lastWidth = useRef(0),
    lastSig = useRef(""),
    focus = useRef(-1);

  const W = Math.max(280, hostW || 600),
    padL = 54,
    padR = 10,
    padT = 14,
    padB = 28,
    plotW = W - padL - padR,
    plotH = height - padT - padB;
  const vis = series.filter((s) => !hidden.has(s.key));
  const totals = useMemo(
    () => data.map((d) => series.reduce((n, s) => n + (hidden.has(s.key) ? 0 : d.values[s.key] || 0), 0)),
    [data, series, hidden],
  );
  const max = niceMax(Math.max(1, ...totals)),
    band = plotW / Math.max(1, data.length),
    bw = Math.max(1, band * (data.length > 120 ? 0.86 : data.length > 40 ? 0.74 : 0.62)),
    every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 90))));
  const peakIndex = peak && totals.length ? totals.indexOf(Math.max(...totals)) : -1;

  // Keyed bar groups, reshaped by one tween (the prototype's draw()).
  useLayoutEffect(() => {
    const g = bars.current;
    if (!g || !hostW) return;
    const target = new Map<string, Geo>();
    data.forEach((d, i) =>
      target.set(d.key, {
        x: padL + i * band + (band - bw) / 2,
        w: bw,
        segs: series.map((s) => ((hidden.has(s.key) ? 0 : d.values[s.key] || 0) / max) * plotH),
      }),
    );
    // Same geometry (a parent re-render): nothing to morph.
    const sig = series.map((s) => s.key + s.color).join() + [...target].map(([k, t]) => k + t.x.toFixed(1) + t.segs.map((v) => v.toFixed(1)).join()).join();
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    const first = !built.current,
      resized = !first && lastWidth.current !== hostW;
    built.current = true;
    lastWidth.current = hostW;
    const existing = new Map([...g.querySelectorAll<SVGGElement>(":scope > g[data-k]")].map((x) => [x.dataset.k!, x]));
    const order: SVGGElement[] = [];
    for (const d of data) {
      let bar = existing.get(d.key);
      if (!bar) {
        bar = document.createElementNS(SVG, "g");
        bar.dataset.k = d.key;
        g.append(bar);
      }
      while (bar.childNodes.length < series.length) {
        const r = document.createElementNS(SVG, "rect");
        r.setAttribute("class", "c-seg");
        bar.append(r);
      }
      while (bar.childNodes.length > series.length) bar.lastChild!.remove();
      series.forEach((s, j) => {
        const r = bar!.childNodes[j] as SVGRectElement;
        r.style.fill = s.color;
        r.dataset.s = s.key;
      });
      bar.style.opacity = "";
      existing.delete(d.key);
      order.push(bar);
    }
    const leaving = [...existing.values()];
    const from = new Map<string, Geo>();
    for (const [k, t] of target) {
      const prev = geo.current.get(k);
      from.set(k, prev && !first ? prev : { x: t.x, w: t.w, segs: t.segs.map(() => 0) });
    }
    const apply = (bar: SVGGElement, gm: Geo) => {
      let y = padT + plotH;
      gm.segs.forEach((hgt, j) => {
        const r = bar.childNodes[j] as SVGRectElement | undefined;
        if (!r) return;
        const hh = Math.max(0, hgt);
        y -= hh;
        r.setAttribute("x", gm.x.toFixed(2));
        r.setAttribute("width", Math.max(0.5, gm.w).toFixed(2));
        r.setAttribute("y", y.toFixed(2));
        r.setAttribute("height", hh.toFixed(2));
      });
    };
    anim.current.t?.cancel();
    const n = data.length,
      stagger = first ? 0.38 : 0.12,
      lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const frame = (p: number) => {
      order.forEach((bar, i) => {
        const k = data[i].key,
          f = from.get(k)!,
          t = target.get(k)!;
        const d = n > 1 ? (i / (n - 1)) * stagger : 0,
          q = resized ? 1 : ease.out(clamp((p - d) / (1 - stagger), 0, 1));
        const gm = { x: lerp(f.x, t.x, q), w: lerp(f.w, t.w, q), segs: t.segs.map((s, j) => lerp(f.segs[j] || 0, s, q)) };
        apply(bar, gm);
        geo.current.set(k, gm);
      });
      leaving.forEach((bar) => (bar.style.opacity = String(1 - p)));
    };
    anim.current.t = tween(resized ? 0 : first ? 620 : 420, (_t, raw) => frame(raw), {
      ease: ease.linear,
      done: () => leaving.forEach((bar) => bar.remove()),
    });
  }, [data, series, hidden, hostW, max, band, bw, plotH, height]);
  useLayoutEffect(() => {
    const h = anim.current;
    return () => h.t?.cancel();
  }, []);

  // Peak label rises in.
  const peakRef = useRef<SVGTextElement>(null);
  useLayoutEffect(() => {
    if (!peakRef.current || reduced()) return;
    peakRef.current.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
      duration: 300,
      delay: 450,
      fill: "backwards",
    });
  }, [peakIndex, data]);

  const show = (i: number, point?: { x: number; y: number }) => {
    const d = data[i],
      el = svg.current;
    if (!d || !el) return;
    const h = hover.current;
    if (h) {
      h.setAttribute("x", String(padL + i * band));
      h.setAttribute("y", String(padT));
      h.setAttribute("width", String(band));
      h.setAttribute("height", String(plotH));
      h.classList.add("on");
    }
    bars.current?.querySelectorAll<SVGGElement>(":scope > g").forEach((g) => g.classList.toggle("dim", g.dataset.k !== d.key));
    const rows: [string, string][] = vis.filter((s) => d.values[s.key]).map((s) => [s.label, number(d.values[s.key])]);
    const detail: [string, string][] = d.tip?.detail
      ? d.tip.detail.split(" · ").map((r) => {
          const j = r.indexOf(": ");
          return [r.slice(0, j), r.slice(j + 2)];
        })
      : [];
    const all = vis.length > 1 ? rows.concat(detail) : detail.length ? detail : rows;
    let p = point;
    if (!p) {
      const r = el.getBoundingClientRect();
      p = { x: r.left + ((padL + (i + 0.5) * band) / W) * r.width, y: r.top + 20 };
    }
    tip.show(el, { title: d.tip?.title ?? d.key, rows: all }, p);
  };
  const clear = () => {
    hover.current?.classList.remove("on");
    bars.current?.querySelectorAll(".dim").forEach((g) => g.classList.remove("dim"));
    if (tip.owner() === svg.current) tip.hide();
  };
  const indexAt = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect(),
      x = ((clientX - r.left) / r.width) * W;
    return clamp(Math.floor((x - padL) / band), 0, data.length - 1);
  };

  return (
    <div className="chart" ref={host}>
      <svg
        ref={svg}
        className="chart-svg"
        viewBox={`0 0 ${W} ${height}`}
        height={height}
        role="group"
        aria-roledescription="chart"
        tabIndex={0}
        aria-label={label + ". Use left and right arrow keys to read each bar."}
        onPointerMove={(e) => {
          if (!data.length) return;
          const i = indexAt(e.clientX);
          focus.current = i;
          show(i, { x: e.clientX, y: e.clientY });
        }}
        onPointerLeave={clear}
        onBlur={clear}
        onKeyDown={(e) => {
          const n = data.length;
          if (!n) return;
          const k = e.key;
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(k)) {
            if (k === "Escape") clear();
            return;
          }
          e.preventDefault();
          const f = focus.current;
          focus.current =
            k === "Home" ? 0 : k === "End" ? n - 1 : clamp((f < 0 ? (k === "ArrowLeft" ? n : -1) : f) + (k === "ArrowRight" ? 1 : -1), 0, n - 1);
          show(focus.current);
        }}
      >
        <g className="c-shade">
          {shade &&
            data.map((d, i) => (shade(d) ? <rect key={d.key} x={padL + i * band} y={padT} width={band} height={plotH} /> : null))}
        </g>
        <g className="c-grid">
          {[0, 1, 2, 3, 4].map((i) => {
            const y = padT + plotH - (plotH * i) / 4;
            return (
              <g key={i}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} className={i ? "" : "base"} />
                <text x={padL - 8} y={y + 4} textAnchor="end">
                  {axis((max * i) / 4)}
                </text>
              </g>
            );
          })}
        </g>
        <rect ref={hover} className="c-hover" rx={4} />
        <g className="c-bars" ref={bars} />
        <g className="c-x">
          {data.map((d, i) =>
            i % every ? null : (
              <text key={d.key} x={padL + i * band + band / 2} y={height - 8} textAnchor="middle">
                {xFmt(d.key)}
              </text>
            ),
          )}
        </g>
        <g className="c-peak">
          {peakIndex >= 0 && totals[peakIndex] > 0 && (
            <text
              key={data[peakIndex].key}
              ref={peakRef}
              x={padL + peakIndex * band + band / 2}
              y={padT + plotH - (totals[peakIndex] / max) * plotH - 8}
              textAnchor="middle"
            >
              peak
            </text>
          )}
        </g>
      </svg>
      {legend && (
        <div
          className="c-legend"
          role="group"
          aria-label="Series — click to show or hide"
          onPointerLeave={() => setFade("")}
        >
          {series.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={!hidden.has(s.key)}
              onPointerOver={() => setFade(s.key)}
              onClick={() =>
                setHidden((h) => {
                  const next = new Set(h);
                  if (next.has(s.key)) next.delete(s.key);
                  else if (next.size < series.length - 1) next.add(s.key);
                  return next;
                })
              }
              onDoubleClick={() => setHidden(new Set(series.map((x) => x.key).filter((k) => k !== s.key)))}
            >
              <i style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
          {series.length > 1 && <span className="c-legend-hint">Click to hide · double-click to isolate</span>}
        </div>
      )}
      <FadeOthers bars={bars} fade={fade} />
    </div>
  );
}

/** Legend hover fades the other series' segments. */
function FadeOthers({ bars, fade }: { bars: RefObject<SVGGElement | null>; fade: string }) {
  useLayoutEffect(() => {
    bars.current?.querySelectorAll<SVGRectElement>(".c-seg").forEach((r) => r.classList.toggle("fade", !!fade && r.dataset.s !== fade));
  }, [bars, fade]);
  return null;
}

/**
 * Stacked bar chart (the prototype's CL.StackChart). Bars keep their identity between updates: on a
 * range change the x-scale zooms (kept days slide and widen, leaving days travel off the edge, new
 * days travel in); a hidden series folds onto its own base. First paint grows in a left-to-right wave.
 */
import { clamp, ease, tween, type Tween } from "../../../motion/core";
import { compact, number, percent } from "../../../format";
import { clear, h, nextId, s } from "../dom";
import { detailList, tip } from "../overlay";
import { vectorRows, type TipRow } from "../format";
import type { Vector } from "../../../../shared/contracts";
export const niceStep = (x: number) => {
  if (x <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x))),
    f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
};
export interface SeriesKey {
  key: string;
  label: string;
  color: string;
}
export interface StackDatum {
  name: string;
  values: Record<string, number>;
  vector?: Vector;
  sub?: string;
}
export interface StackOptions {
  label: string;
  height?: number;
  /** Ordinal position of a datum on a continuous axis (days), for zoom morphs. */
  pos?: (name: string) => number;
  xLabel?: (name: string) => string;
  title?: (d: StackDatum) => string;
  onBrush?: (from: string, to: string) => void;
  tickWidth?: number;
}
interface Box {
  x: number;
  w: number;
  y: number;
  h: number;
}
interface Target extends Box {
  color: string;
  i: number;
}
interface Layout {
  target: Map<string, Target>;
  index: Map<string, number>;
  bandW: number;
  bw: number;
  max: number;
  n: number;
  pw: number;
  ph: number;
  base: number;
  first: number;
  last: number;
}
export function createStackChart(opt: StackOptions) {
  const H = opt.height ?? 280,
    M = { l: 56, r: 14, t: 16, b: 30 };
  let W = 0,
    keys: SeriesKey[] = [],
    data: StackDatum[] = [],
    hidden = new Set<string>(),
    active = -1,
    L: Layout | null = null,
    prev: Layout | null = null,
    pending = false,
    tw: Tween | null = null,
    drag: { from: number; to: number } | null = null;
  const cur = new Map<string, Box & { node: SVGElement }>();
  const clipId = nextId("clip");
  const clipRect = s("rect", { x: M.l, y: 0, height: H });
  const gGrid = s("g.chart-grid"),
    band = s("rect.chart-band", { y: M.t, height: H - M.t - M.b, rx: 4 }),
    gBars = s("g.chart-bars", { "clip-path": `url(#${clipId})` });
  const gAxis = s("g.chart-axis"),
    brush = s("rect.chart-brush", { y: M.t, height: H - M.t - M.b, rx: 3 });
  const svg = s("svg.chart-svg", { height: H, role: "img", "aria-label": opt.label }, s("defs", s("clipPath", { id: clipId }, clipRect)), gGrid, band, gBars, brush, gAxis);
  const live = h("div.sr-only", { "aria-live": "polite" });
  const legend = h("div.legend", { role: "group", "aria-label": "Series of " + opt.label });
  const plot = h(
    "div.chart-plot",
    {
      tabindex: "0",
      role: "group",
      "aria-label": opt.label + ". Left and right arrows read each bar." + (opt.onBrush ? " Drag across the chart to zoom into a date range." : ""),
    },
    svg,
  );
  const el = h("div.chart", plot, legend, live);
  function compute(): Layout {
    const vis = keys.filter((k) => !hidden.has(k.key)),
      n = data.length,
      pw = Math.max(10, W - M.l - M.r),
      ph = H - M.t - M.b;
    const bandW = n ? pw / n : pw,
      bw = Math.max(1, Math.min(38, bandW * (n > 90 ? 0.8 : n > 40 ? 0.72 : 0.62)));
    let max = 0;
    for (const d of data) {
      let t = 0;
      for (const k of vis) t += d.values[k.key] || 0;
      if (t > max) max = t;
    }
    const step = niceStep(max / 4);
    max = Math.max(step * 4, Math.ceil(max / step) * step) || 1;
    const target = new Map<string, Target>(),
      index = new Map<string, number>(),
      base = M.t + ph;
    data.forEach((d, i) => {
      index.set(d.name, i);
      let acc = 0;
      const x = M.l + i * bandW + (bandW - bw) / 2;
      for (const k of vis) {
        const v = d.values[k.key] || 0;
        if (v <= 0) continue;
        target.set(d.name + "|" + k.key, { x, w: bw, y: base - ((acc + v) / max) * ph, h: (v / max) * ph, color: k.color, i });
        acc += v;
      }
    });
    const first = n && opt.pos ? opt.pos(data[0].name) : 0,
      last = n && opt.pos ? opt.pos(data[n - 1].name) : 0;
    return { target, index, bandW, bw, max, n, pw, ph, base, first, last };
  }
  /** Where a datum that is not in layout `lay` would sit on its x scale (slides bars in and out). */
  function xUnder(lay: Layout, name: string): number | null {
    if (!opt.pos || !lay.n) return null;
    const i = lay.index.get(name);
    if (i !== undefined) return M.l + i * lay.bandW + (lay.bandW - lay.bw) / 2;
    const p = opt.pos(name);
    if (p < lay.first) return M.l - (lay.first - p) * lay.bandW;
    if (p > lay.last) return M.l + lay.pw + (p - lay.last) * lay.bandW;
    return M.l + ((p - lay.first) / Math.max(1, lay.last - lay.first)) * lay.pw;
  }
  function paintAxis(lay: Layout) {
    clear(gGrid);
    clear(gAxis);
    for (let i = 0; i <= 4; i++) {
      const y = lay.base - (i / 4) * lay.ph;
      gGrid.appendChild(s("line", { x1: M.l, x2: W - M.r, y1: y, y2: y, class: i ? "" : "is-base" }));
      gAxis.appendChild(s("text.tick-y", { x: M.l - 8, y: y + 3.5, "text-anchor": "end" }, compact((lay.max * i) / 4)));
    }
    const every = Math.max(1, Math.ceil(lay.n / Math.max(2, Math.floor(lay.pw / (opt.tickWidth ?? 74)))));
    data.forEach((d, i) => {
      if (i % every && i !== lay.n - 1) return;
      if (i === lay.n - 1 && (lay.n - 1) % every && (lay.n - 1) % every < every * 0.6) return;
      const x = M.l + (i + 0.5) * lay.bandW;
      gAxis.appendChild(s("line.tick-x", { x1: x, x2: x, y1: lay.base, y2: lay.base + 4 }));
      const edge = x > W - 26;
      gAxis.appendChild(s("text.tick-xl", { x: edge ? W - 2 : x, y: lay.base + 17, "text-anchor": edge ? "end" : "middle" }, opt.xLabel ? opt.xLabel(d.name) : d.name));
    });
  }
  function render(animate: boolean) {
    if (!W) {
      pending = true;
      return;
    }
    const firstPaint = !L;
    prev = L;
    const lay = (L = compute());
    svg.setAttribute("width", String(W));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    clipRect.setAttribute("width", String(Math.max(0, W - M.l - M.r)));
    paintAxis(lay);
    type Item = { k: string; c: Box & { node: SVGElement }; to: Box & { gone?: boolean }; fx: number; fy: number; fw: number; fh: number; d: number };
    const items: Item[] = [],
      scaleY = prev ? prev.max / lay.max : 1;
    for (const k of new Set([...cur.keys(), ...lay.target.keys()])) {
      const name = k.slice(0, k.lastIndexOf("|")),
        t = lay.target.get(k);
      let c = cur.get(k);
      if (!c) {
        if (!t) continue;
        const node = s("rect", { fill: t.color, rx: Math.min(2.5, t.w / 2.2) });
        gBars.appendChild(node);
        c = { x: t.x, w: t.w, y: lay.base, h: 0, node };
        // Range grew: bars that were outside the old domain slide in from where they were.
        const ox = prev && animate ? xUnder(prev, name) : null;
        if (ox !== null && prev && !prev.index.has(name)) {
          c.x = ox;
          c.w = prev.bw;
          c.h = t.h / scaleY;
          c.y = lay.base - (lay.base - t.y) / scaleY;
        }
        cur.set(k, c);
      } else if (t) c.node.setAttribute("fill", t.color);
      let to: Box & { gone?: boolean } | undefined = t;
      if (!to) {
        const nx = xUnder(lay, name);
        // Range shrank: bars leave along the new scale. A hidden series folds onto its own base.
        to =
          nx !== null && !lay.index.has(name)
            ? { x: nx, w: lay.bw, y: lay.base - (lay.base - c.y) * scaleY, h: c.h * scaleY, gone: true }
            : { x: c.x, w: c.w, y: c.y + c.h, h: 0, gone: true };
      }
      items.push({ k, c, to, fx: c.x, fy: c.y, fw: c.w, fh: c.h, d: firstPaint && t ? (t.i / Math.max(1, lay.n)) * 0.5 : 0 });
    }
    const put = (c: Box & { node: SVGElement }) => {
      c.node.setAttribute("x", c.x.toFixed(2));
      c.node.setAttribute("y", c.y.toFixed(2));
      c.node.setAttribute("width", Math.max(0, c.w).toFixed(2));
      c.node.setAttribute("height", Math.max(0, c.h).toFixed(2));
    };
    const finish = () => {
      for (const it of items)
        if (it.to.gone) {
          it.c.node.remove();
          cur.delete(it.k);
        }
    };
    tw?.cancel();
    const frame = (raw: number) => {
      for (const it of items) {
        const u = firstPaint ? ease.expo(clamp((raw - it.d) / 0.5, 0, 1)) : ease.inOut(raw),
          c = it.c,
          to = it.to;
        c.x = it.fx + (to.x - it.fx) * u;
        c.y = it.fy + (to.y - it.fy) * u;
        c.w = it.fw + (to.w - it.fw) * u;
        c.h = it.fh + (to.h - it.fh) * u;
        put(c);
      }
    };
    if (!animate) {
      for (const it of items) {
        Object.assign(it.c, { x: it.to.x, y: it.to.y, w: it.to.w, h: it.to.h });
        put(it.c);
      }
      finish();
    } else tw = tween(firstPaint ? 760 : 440, (_, raw) => frame(raw), { ease: ease.linear, done: finish });
    paintLegend();
    if (active >= data.length) setActive(-1);
  }
  function paintLegend() {
    clear(legend);
    const totals = keys.map((k) => data.reduce((n, d) => n + (d.values[k.key] || 0), 0)),
      all = totals.reduce((a, b) => a + b, 0) || 1;
    keys.forEach((k, i) =>
      legend.appendChild(
        h(
          "button.legend-item",
          {
            type: "button",
            "aria-pressed": String(!hidden.has(k.key)),
            "data-tip": `${number(totals[i])} · ${percent(totals[i] / all)}`,
            onclick: (e: Event) => ((e as MouseEvent).shiftKey ? isolate(k.key) : toggle(k.key)),
            ondblclick: () => isolate(k.key),
          },
          h("i.dot", { style: { background: k.color } }),
          h("span", k.label),
          h("b", compact(totals[i])),
        ),
      ),
    );
    if (keys.length > 1) legend.appendChild(h("span.legend-note", "Click hides a series · double-click isolates it" + (opt.onBrush ? " · drag the chart to zoom" : "")));
  }
  function toggle(key: string) {
    if (hidden.has(key)) hidden.delete(key);
    else hidden.add(key);
    if (hidden.size >= keys.length) hidden.clear();
    render(true);
  }
  function isolate(key: string) {
    const only = keys.every((k) => k.key === key || hidden.has(k.key));
    hidden = only ? new Set() : new Set(keys.filter((k) => k.key !== key).map((k) => k.key));
    render(true);
  }
  function tipFor(d: StackDatum) {
    const vis = keys
      .filter((k) => !hidden.has(k.key))
      .map((k) => [k, d.values[k.key] || 0] as const)
      .filter((x) => x[1] > 0)
      .sort((a, b) => b[1] - a[1]);
    const rows: TipRow[] = vis.slice(0, 9).map(([k, v]) => [k.label, number(v), k.color]);
    if (vis.length > 9) rows.push([`${vis.length - 9} more`, number(vis.slice(9).reduce((n, x) => n + x[1], 0))]);
    if (d.vector) {
      if (rows.length) rows.push("-");
      rows.push(...vectorRows(d.vector));
    }
    return detailList(opt.title ? opt.title(d) : d.name, rows, d.sub);
  }
  function setActive(i: number, px?: number, py?: number) {
    active = i;
    if (i < 0 || !L || !data[i]) {
      band.style.opacity = "0";
      tip.hide();
      return;
    }
    band.setAttribute("x", String(M.l + i * L.bandW));
    band.setAttribute("width", String(Math.max(1, L.bandW)));
    band.style.opacity = "1";
    if (px === undefined || py === undefined) {
      const r = svg.getBoundingClientRect();
      px = r.left + M.l + (i + 0.5) * L.bandW;
      py = r.top + M.t + 8;
    }
    tip.show(tipFor(data[i]), px, py);
  }
  const indexAt = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    return L ? clamp(Math.floor((e.clientX - r.left - M.l) / L.bandW), 0, L.n - 1) : -1;
  };
  svg.addEventListener("pointermove", (e) => {
    if (!L || !L.n) return;
    const i = indexAt(e);
    if (drag) {
      drag.to = i;
      const a = Math.min(drag.from, i),
        b = Math.max(drag.from, i);
      brush.setAttribute("x", String(M.l + a * L.bandW));
      brush.setAttribute("width", String((b - a + 1) * L.bandW));
      brush.style.opacity = b > a ? "1" : "0";
    }
    setActive(i, e.clientX, e.clientY);
  });
  svg.addEventListener("pointerleave", () => {
    if (!drag) setActive(-1);
  });
  if (opt.onBrush) {
    svg.addEventListener("pointerdown", (e) => {
      if (e.button === 0 && L && L.n > 1) {
        drag = { from: indexAt(e), to: indexAt(e) };
        svg.setPointerCapture(e.pointerId);
      }
    });
    const end = () => {
      if (!drag) return;
      const a = Math.min(drag.from, drag.to),
        b = Math.max(drag.from, drag.to);
      drag = null;
      brush.style.opacity = "0";
      if (b > a) {
        setActive(-1);
        opt.onBrush?.(data[a].name, data[b].name);
      }
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
  }
  plot.addEventListener("keydown", (e) => {
    if (!L || !L.n) return;
    const to =
      e.key === "ArrowRight"
        ? Math.min(L.n - 1, active + 1)
        : e.key === "ArrowLeft"
          ? Math.max(0, active < 0 ? L.n - 1 : active - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? L.n - 1
              : e.key === "Escape"
                ? -2
                : -1;
    if (to === -1) return;
    e.preventDefault();
    setActive(to === -2 ? -1 : to);
    if (to >= 0) {
      const d = data[to];
      live.textContent = `${opt.title ? opt.title(d) : d.name}: ${number(Object.values(d.values).reduce((a, b) => a + b, 0))} tokens`;
    }
  });
  plot.addEventListener("blur", () => setActive(-1));
  const ro = new ResizeObserver(() => {
    const w = Math.floor(plot.clientWidth);
    if (!w || w === W) return;
    const was = W;
    W = w;
    if (data.length || pending) render(!was && !!data.length);
    pending = false;
  });
  ro.observe(plot);
  return {
    el,
    update(next: { keys: SeriesKey[]; data: StackDatum[] }) {
      const sameKeys = keys.length === next.keys.length && keys.every((k, i) => k.key === next.keys[i].key);
      keys = next.keys;
      data = next.data;
      if (!sameKeys) hidden = new Set([...hidden].filter((k) => keys.some((x) => x.key === k)));
      render(true);
    },
    destroy() {
      ro.disconnect();
      tw?.cancel();
      tip.hide();
    },
  };
}

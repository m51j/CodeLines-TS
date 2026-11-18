/**
 * Heatmaps, share bars, the treemap and the line chart (ported from the prototype's charts.js).
 * Every chart keeps its marks between updates, so new data morphs instead of redrawing.
 */
import { clamp, ease, play, reduced, tween, type Tween } from "../../../motion/core";
import { compact, percent } from "../../../format";
import { clear, h, s } from "../dom";
import { detailList, tip } from "../overlay";
import { pad2, shortDate, type TipRow } from "../format";
import { niceStep } from "./StackChart";
/* ================= heatmaps (calendar and weekday × hour) ================= */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export interface HeatCell {
  key: string;
  value: number;
  title: string;
  rows: TipRow[];
  sub?: string;
  dim?: boolean;
}
type CellNode = HTMLElement & { _c?: HeatCell; _i?: number };
export function createHeat(opt: { label: string; calendar?: boolean; onPick?: (key: string) => void }) {
  const grid = h("div.heat-grid", { class: opt.calendar ? "is-calendar" : "is-hours" });
  const scroller = h("div.heat-scroll", { role: "region", "aria-label": opt.label, tabindex: "-1" }, grid);
  const scale = h(
    "div.heat-scale",
    h("span", "Less"),
    Array.from({ length: 7 }, (_, i) => h("i.heat-cell.l" + i)),
    h("span", "More"),
    h("span.heat-help", "Hover or focus a cell for exact values" + (opt.onPick ? " · click a day to focus the report on it" : "")),
  );
  const el = h("div.heat", scroller, scale);
  let map = new Map<string, CellNode>(),
    cells: HeatCell[] = [],
    cols = 0,
    focusKey: string | null = null;
  const levelFn = (values: number[]) => {
    const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
    const stops = [0.2, 0.4, 0.6, 0.8, 0.95].map((p) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] ?? 0);
    return (n: number) => {
      if (!n) return 0;
      const i = stops.findIndex((x) => n <= x);
      return i < 0 ? 6 : i + 1;
    };
  };
  const tipOf = (c: HeatCell) => detailList(c.title, c.rows, c.sub);
  function fit() {
    if (!opt.calendar || !cols) return;
    const size = clamp(Math.floor((scroller.clientWidth - 40 - (cols - 1) * 3) / cols), 11, 24);
    grid.style.setProperty("--cell", size + "px");
  }
  function update(next: HeatCell[]) {
    cells = next;
    const level = levelFn(cells.map((c) => c.value)),
      old = map,
      frag: HTMLElement[] = [];
    map = new Map();
    cols = opt.calendar ? Math.ceil(cells.length / 7) : 24;
    grid.style.setProperty("--cols", String(cols));
    if (opt.calendar) {
      // A label where a week starts a new month; dropped when another label follows within two weeks.
      const months = Array.from({ length: cols }, (_, w) =>
        w === 0 || cells[w * 7].key.slice(0, 7) !== cells[(w - 1) * 7].key.slice(0, 7) ? cells[w * 7].key : "",
      );
      months.forEach((d, w) => {
        if (!d || months.slice(w + 1, w + 3).some(Boolean)) return;
        frag.push(
          h(
            "span.heat-month",
            { style: { gridColumn: `${w + 2} / span 3`, gridRow: "1" } },
            new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", year: w === 0 || d.slice(5, 7) === "01" ? "2-digit" : undefined, timeZone: "UTC" }),
          ),
        );
      });
    } else for (let hr = 0; hr < 24; hr++) frag.push(h("span.heat-hour", { style: { gridColumn: String(hr + 2), gridRow: "1" } }, pad2(hr)));
    WEEKDAYS.forEach((d, i) => frag.push(h("span.heat-day", { style: { gridColumn: "1", gridRow: String(i + 2) } }, d)));
    cells.forEach((c, i) => {
      const col = opt.calendar ? Math.floor(i / 7) : i % 24,
        row = opt.calendar ? i % 7 : Math.floor(i / 24);
      let node = old.get(c.key);
      if (!node) {
        node = h("i.heat-cell", { role: "img", tabindex: "-1" }) as CellNode;
        // Diagonal pop wave on first paint; afterwards cells keep their identity and only recolour.
        if (!reduced()) {
          node.classList.add("is-pop");
          node.style.setProperty("--pop-delay", Math.round(col * Math.min(14, 600 / Math.max(1, cols)) + row * 6) + "ms");
        }
      } else node.classList.remove("is-pop");
      node.className = node.className.replace(/\bl\d\b/g, "").replace(/\s+/g, " ").trim() + " l" + level(c.value);
      node.classList.toggle("is-dim", !!c.dim);
      node.classList.toggle("is-pick", !!opt.onPick && c.value > 0);
      node.style.gridColumn = String(col + 2);
      node.style.gridRow = String(row + 2);
      node.setAttribute("aria-label", c.title + " · " + c.rows.filter((x): x is Exclude<TipRow, "-"> => x !== "-").map((x) => x[0] + ": " + x[1]).join(" · "));
      node._c = c;
      node._i = i;
      map.set(c.key, node);
      frag.push(node);
    });
    grid.replaceChildren(...frag);
    const keep = (focusKey && map.get(focusKey)) || (frag[frag.length - 1] as CellNode | undefined);
    for (const n of map.values()) n.tabIndex = -1;
    if (keep && keep._c) keep.tabIndex = 0;
    fit();
  }
  const cellOf = (e: Event) => (e.target instanceof Element ? (e.target.closest(".heat-cell") as CellNode | null) : null);
  grid.addEventListener("pointermove", (e) => {
    const c = cellOf(e);
    if (c && c._c) tip.show(tipOf(c._c), e.clientX, e.clientY);
    else tip.hide();
  });
  grid.addEventListener("pointerleave", () => tip.hide());
  grid.addEventListener("focusin", (e) => {
    const c = cellOf(e);
    if (c && c._c) {
      focusKey = c._c.key;
      tip.at(c, tipOf(c._c));
    }
  });
  grid.addEventListener("focusout", () => tip.hide());
  grid.addEventListener("click", (e) => {
    const c = cellOf(e);
    if (c && c._c && opt.onPick && c._c.value > 0) opt.onPick(c._c.key);
  });
  grid.addEventListener("keydown", (e) => {
    const c = cellOf(e);
    if (!c || !c._c || c._i === undefined) return;
    const i = c._i,
      perCol = opt.calendar ? 7 : 1,
      perRow = opt.calendar ? 1 : 24;
    const to =
      e.key === "ArrowRight" ? i + perCol : e.key === "ArrowLeft" ? i - perCol : e.key === "ArrowDown" ? i + perRow : e.key === "ArrowUp" ? i - perRow : e.key === "Home" ? 0 : e.key === "End" ? cells.length - 1 : -1;
    if ((e.key === "Enter" || e.key === " ") && opt.onPick && c._c.value > 0) {
      e.preventDefault();
      opt.onPick(c._c.key);
      return;
    }
    if (to < 0 || to >= cells.length) return;
    e.preventDefault();
    const node = map.get(cells[to].key);
    if (!node) return;
    c.tabIndex = -1;
    node.tabIndex = 0;
    node.focus();
  });
  const ro = new ResizeObserver(fit);
  ro.observe(scroller);
  return { el, update, destroy: () => ro.disconnect() };
}
/* ================= share bar ================= */
export interface ShareItem {
  key: string;
  label: string;
  value: number;
  color: string;
  rows: TipRow[];
}
type SegNode = HTMLElement & { _it?: ShareItem };
/** Segments keep their identity and re-flex smoothly. */
export function createShareBar(opt: { label: string; className?: string }) {
  const bar = h("div.sharebar", { role: "group", "aria-label": opt.label, class: opt.className ?? "" });
  const map = new Map<string, SegNode>();
  const timers = new Set<number>();
  function update(items: ShareItem[]) {
    const total = items.reduce((n, i) => n + i.value, 0) || 1,
      seen = new Set<string>();
    items.forEach((it, idx) => {
      if (it.value <= 0) return;
      seen.add(it.key);
      let seg = map.get(it.key);
      if (!seg) {
        const node = h("span.share-seg", { tabindex: "0", role: "img" }, h("b"), h("small")) as SegNode;
        node.style.flexGrow = reduced() ? String(it.value / total) : "0";
        node.addEventListener("pointermove", (e) => node._it && tip.show(detailList(node._it.label, node._it.rows), e.clientX, e.clientY));
        node.addEventListener("pointerleave", () => tip.hide());
        node.addEventListener("focus", () => node._it && tip.at(node, detailList(node._it.label, node._it.rows)));
        node.addEventListener("blur", () => tip.hide());
        map.set(it.key, node);
        seg = node;
      }
      seg._it = it;
      seg.style.background = it.color;
      seg.style.order = String(idx);
      (seg.firstChild as HTMLElement).textContent = it.label;
      (seg.lastChild as HTMLElement).textContent = percent(it.value / total);
      seg.setAttribute("aria-label", `${it.label} · ` + it.rows.filter((x): x is Exclude<TipRow, "-"> => x !== "-").map((x) => x[0] + ": " + x[1]).join(" · "));
      if (!seg.isConnected) bar.appendChild(seg);
      const grow = String(it.value / total),
        node = seg;
      if (node.style.flexGrow !== grow) requestAnimationFrame(() => requestAnimationFrame(() => (node.style.flexGrow = grow)));
    });
    for (const [k, seg] of map)
      if (!seen.has(k)) {
        seg.style.flexGrow = "0";
        map.delete(k);
        const t = window.setTimeout(() => seg.remove(), reduced() ? 0 : 420);
        timers.add(t);
      }
  }
  return { el: bar, update, destroy: () => timers.forEach((t) => clearTimeout(t)) };
}
/* ================= treemap ================= */
export interface TreeItem {
  key: string;
  label: string;
  value: number;
  valueText: string;
  sub?: string;
  color: string;
  rows: TipRow[];
}
function squarify(items: TreeItem[], W: number, H: number) {
  const total = items.reduce((n, i) => n + i.value, 0) || 1,
    out: { item: TreeItem; x: number; y: number; w: number; h: number }[] = [];
  let x = 0,
    y = 0,
    w = W,
    ht = H,
    row: { item: TreeItem; area: number }[] = [];
  const rest = items.filter((i) => i.value > 0).map((i) => ({ item: i, area: (i.value / total) * W * H }));
  const worst = (r: typeof row, side: number) => {
    const sum = r.reduce((n, q) => n + q.area, 0),
      mx = Math.max(...r.map((q) => q.area)),
      mn = Math.min(...r.map((q) => q.area));
    return Math.max((side * side * mx) / (sum * sum), (sum * sum) / (side * side * mn));
  };
  const flush = () => {
    const sum = row.reduce((n, q) => n + q.area, 0);
    if (w >= ht) {
      const cw = sum / ht;
      let cy = y;
      for (const q of row) {
        const ch = q.area / cw;
        out.push({ item: q.item, x, y: cy, w: cw, h: ch });
        cy += ch;
      }
      x += cw;
      w -= cw;
    } else {
      const ch = sum / w;
      let cx = x;
      for (const q of row) {
        const cw = q.area / ch;
        out.push({ item: q.item, x: cx, y, w: cw, h: ch });
        cx += cw;
      }
      y += ch;
      ht -= ch;
    }
    row = [];
  };
  while (rest.length) {
    const side = Math.min(w, ht);
    if (!row.length || worst(row.concat(rest[0]), side) <= worst(row, side)) row.push(rest.shift()!);
    else flush();
  }
  if (row.length) flush();
  return out;
}
type TileNode = HTMLButtonElement & { _it?: TreeItem };
/** Tiles scale in, then glide between layouts when the metric changes. */
export function createTreemap(opt: { label: string; onPick: (key: string) => void }) {
  const el = h("div.treemap", { role: "listbox", "aria-label": opt.label, "aria-orientation": "horizontal" });
  const map = new Map<string, TileNode>();
  let items: TreeItem[] = [],
    selected: string | null = null,
    first = true;
  function layout() {
    const W = el.clientWidth || 800,
      H = el.clientHeight || 260;
    const rects = squarify([...items].sort((a, b) => b.value - a.value), W, H),
      seen = new Set<string>();
    rects.forEach((r, i) => {
      const it = r.item;
      seen.add(it.key);
      let t = map.get(it.key);
      if (!t) {
        const node = h("button.tm-tile", { type: "button", role: "option" }, h("span.tm-name"), h("span.tm-value"), h("span.tm-sub")) as TileNode;
        node.addEventListener("click", () => node._it && opt.onPick(node._it.key));
        node.addEventListener("pointermove", (e) => node._it && tip.show(detailList(node._it.label, node._it.rows), e.clientX, e.clientY));
        node.addEventListener("pointerleave", () => tip.hide());
        node.addEventListener("focus", () => node._it && tip.at(node, detailList(node._it.label, node._it.rows)));
        node.addEventListener("blur", () => tip.hide());
        map.set(it.key, node);
        el.appendChild(node);
        if (first) play(node, [{ opacity: 0, transform: "scale(.86)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 60 + i * 28 });
        t = node;
      }
      t._it = it;
      t.style.left = (r.x / W) * 100 + "%";
      t.style.top = (r.y / H) * 100 + "%";
      t.style.width = (r.w / W) * 100 + "%";
      t.style.height = (r.h / H) * 100 + "%";
      t.style.setProperty("--tile", it.color);
      (t.children[0] as HTMLElement).textContent = it.label;
      (t.children[1] as HTMLElement).textContent = it.valueText;
      (t.children[2] as HTMLElement).textContent = it.sub ?? "";
      t.setAttribute("aria-selected", String(it.key === selected));
      t.setAttribute("aria-label", `${it.label}, ${it.valueText}`);
    });
    for (const [k, t] of map)
      if (!seen.has(k)) {
        t.remove();
        map.delete(k);
      }
    first = false;
  }
  const ro = new ResizeObserver(() => {
    if (items.length) layout();
  });
  ro.observe(el);
  el.addEventListener("keydown", (e) => {
    const tiles = [...map.values()],
      i = tiles.indexOf(document.activeElement as TileNode);
    const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : -1;
    if (i >= 0 && tiles[to]) {
      e.preventDefault();
      tiles[to].focus();
    }
  });
  return {
    el,
    update(next: TreeItem[], sel: string | null) {
      items = next;
      selected = sel;
      layout();
    },
    select(sel: string | null) {
      selected = sel;
      for (const [k, t] of map) t.setAttribute("aria-selected", String(k === sel));
    },
    destroy: () => ro.disconnect(),
  };
}
/* ================= line chart (daily-log trend) ================= */
export interface LinePoint {
  name: string;
  value: number | null;
  title?: string;
  rows: TipRow[];
}
/** The line draws on first paint and re-shapes between metrics. */
export function createLineChart(opt: { label: string; height?: number; onPick?: (name: string) => void }) {
  const H = opt.height ?? 200,
    M = { l: 56, r: 16, t: 14, b: 26 };
  let W = 0,
    pts: LinePoint[] = [],
    vals: (number | null)[] = [],
    lay: { min: number; max: number; y: (v: number) => number } | null = null,
    tw: Tween | null = null,
    pending = false,
    fmt: (v: number) => string = compact,
    drawn = false,
    picked: string | null = null,
    active = -1;
  const gGrid = s("g.chart-grid"),
    area = s("path.line-area"),
    line = s("path.line-path"),
    gAxis = s("g.chart-axis"),
    cross = s("line.line-cross", { y1: M.t, y2: H - M.b }),
    dot = s("circle.line-dot", { r: 4.5 }),
    mark = s("circle.line-mark", { r: 5.5 });
  const svg = s("svg.chart-svg", { height: H, role: "img", "aria-label": opt.label }, gGrid, area, line, cross, mark, dot, gAxis);
  const plot = h("div.chart-plot", { tabindex: "0", role: "group", "aria-label": opt.label + ". Left and right arrows read each day; Enter picks it." }, svg);
  const el = h("div.chart", plot);
  const xOf = (i: number) => M.l + (pts.length > 1 ? (i / (pts.length - 1)) * (W - M.l - M.r) : (W - M.l - M.r) / 2);
  function scale(values: (number | null)[]) {
    const real = values.filter((v): v is number => v !== null);
    let min = real.length ? Math.min(...real) : 0,
      max = real.length ? Math.max(...real) : 1;
    const pad = (max - min) * 0.12 || max * 0.05 || 1;
    min = Math.max(0, min - pad);
    max += pad;
    const step = niceStep((max - min) / 4);
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    return { min, max, y: (v: number) => H - M.b - ((v - min) / (max - min || 1)) * (H - M.t - M.b) };
  }
  function paint(values: (number | null)[], sc: { y: (v: number) => number }) {
    let d = "",
      started = false,
      firstX = 0,
      lastX = 0;
    values.forEach((v, i) => {
      if (v === null) return;
      const x = xOf(i);
      if (!started) firstX = x;
      d += (started ? "L" : "M") + x.toFixed(1) + " " + sc.y(v).toFixed(1);
      started = true;
      lastX = x;
    });
    line.setAttribute("d", d);
    area.setAttribute("d", d ? `${d}L${lastX.toFixed(1)} ${H - M.b}L${firstX.toFixed(1)} ${H - M.b}Z` : "");
  }
  function axis(sc: { min: number; max: number; y: (v: number) => number }) {
    clear(gGrid);
    clear(gAxis);
    for (let i = 0; i <= 4; i++) {
      const v = sc.min + ((sc.max - sc.min) * i) / 4,
        y = sc.y(v);
      gGrid.appendChild(s("line", { x1: M.l, x2: W - M.r, y1: y, y2: y, class: i ? "" : "is-base" }));
      gAxis.appendChild(s("text.tick-y", { x: M.l - 8, y: y + 3.5, "text-anchor": "end" }, fmt(v)));
    }
    const every = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor((W - M.l - M.r) / 84))));
    pts.forEach((p, i) => {
      if (i % every === 0) gAxis.appendChild(s("text.tick-xl", { x: xOf(i), y: H - M.b + 17, "text-anchor": "middle" }, shortDate(p.name)));
    });
  }
  function render(animate: boolean) {
    if (!W) {
      pending = true;
      return;
    }
    svg.setAttribute("width", String(W));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const next = pts.map((p) => p.value),
      from = vals.length === next.length ? [...vals] : null,
      sc = scale(next);
    lay = sc;
    axis(sc);
    tw?.cancel();
    if (animate && from && drawn) {
      const s0 = scale(from);
      tw = tween(
        460,
        (t) => {
          const mid = next.map((v, i) => (v === null || from[i] === null ? v : from[i]! + (v - from[i]!) * t));
          const mn = s0.min + (sc.min - s0.min) * t,
            mx = s0.max + (sc.max - s0.max) * t;
          paint(mid, { y: (v) => H - M.b - ((v - mn) / (mx - mn || 1)) * (H - M.t - M.b) });
        },
        { ease: ease.inOut },
      );
    } else {
      paint(next, sc);
      if (animate && !reduced()) {
        line.classList.remove("draw");
        void line.getBoundingClientRect();
        line.classList.add("draw");
        area.classList.remove("fade");
        void area.getBoundingClientRect();
        area.classList.add("fade");
      }
    }
    drawn = true;
    vals = next;
    placeMark();
  }
  function placeMark() {
    const i = pts.findIndex((p) => p.name === picked);
    const v = i < 0 ? null : pts[i].value;
    if (i < 0 || v === null || !lay) {
      mark.style.opacity = "0";
      return;
    }
    mark.setAttribute("cx", String(xOf(i)));
    mark.setAttribute("cy", String(lay.y(v)));
    mark.style.opacity = "1";
  }
  function setActive(i: number, px?: number, py?: number) {
    active = i;
    if (i < 0 || !pts[i] || !lay) {
      cross.style.opacity = "0";
      dot.style.opacity = "0";
      tip.hide();
      return;
    }
    const x = xOf(i),
      p = pts[i];
    cross.setAttribute("x1", String(x));
    cross.setAttribute("x2", String(x));
    cross.style.opacity = "1";
    if (p.value !== null) {
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", String(lay.y(p.value)));
      dot.style.opacity = "1";
    } else dot.style.opacity = "0";
    if (px === undefined || py === undefined) {
      const r = svg.getBoundingClientRect();
      px = r.left + x;
      py = r.top + M.t;
    }
    tip.show(detailList(p.title ?? p.name, p.rows), px, py);
  }
  const at = (e: MouseEvent) => {
    const r = svg.getBoundingClientRect();
    return clamp(Math.round(((e.clientX - r.left - M.l) / Math.max(1, W - M.l - M.r)) * (pts.length - 1)), 0, pts.length - 1);
  };
  svg.addEventListener("pointermove", (e) => {
    if (pts.length) setActive(at(e), e.clientX, e.clientY);
  });
  svg.addEventListener("pointerleave", () => setActive(-1));
  svg.addEventListener("click", (e) => {
    if (pts.length && opt.onPick) opt.onPick(pts[at(e)].name);
  });
  plot.addEventListener("keydown", (e) => {
    if (!pts.length) return;
    if (e.key === "Enter" && active >= 0 && opt.onPick) {
      opt.onPick(pts[active].name);
      return;
    }
    const to =
      e.key === "ArrowRight" ? Math.min(pts.length - 1, active + 1) : e.key === "ArrowLeft" ? Math.max(0, active < 0 ? pts.length - 1 : active - 1) : e.key === "Home" ? 0 : e.key === "End" ? pts.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setActive(to);
  });
  plot.addEventListener("blur", () => setActive(-1));
  const ro = new ResizeObserver(() => {
    const w = Math.floor(plot.clientWidth);
    if (!w || w === W) return;
    const was = W;
    W = w;
    if (pts.length || pending) render(!was);
    pending = false;
  });
  ro.observe(plot);
  return {
    el,
    update(next: { points: LinePoint[]; color: string; format?: (v: number) => string }) {
      pts = next.points;
      fmt = next.format ?? compact;
      el.style.setProperty("--lc", next.color);
      render(true);
    },
    pick(name: string | null) {
      picked = name;
      placeMark();
    },
    destroy() {
      ro.disconnect();
      tw?.cancel();
      tip.hide();
    },
  };
}

/**
 * Overlays shared by every Instrument page: the rich tooltip that follows the pointer (charts,
 * heatmaps, share bars), plain [data-tip] tooltips, and the layer they live in.
 */
import { clamp } from "../../motion/core";
import { clear, h } from "./dom";
import type { TipRow } from "./format";
let layerEl: HTMLElement | null = null;
/** The fixed overlay layer on <body>. */
export function layer(): HTMLElement {
  if (!layerEl || !layerEl.isConnected) {
    layerEl = h("div.layer", { "data-instrument": "" });
    document.body.appendChild(layerEl);
  }
  return layerEl;
}
let tipEl: HTMLElement | null = null;
export const tip = {
  show(content: Node | string, x: number, y: number) {
    if (!tipEl || !tipEl.isConnected) tipEl = layer().appendChild(h("div.tip", { role: "tooltip", id: "il-tip" }));
    clear(tipEl).appendChild(typeof content === "string" ? document.createTextNode(content) : content);
    tipEl.dataset.show = "1";
    const w = tipEl.offsetWidth,
      ht = tipEl.offsetHeight;
    let left = x + 16,
      top = y + 16;
    if (left + w > innerWidth - 8) left = x - w - 16;
    if (top + ht > innerHeight - 8) top = y - ht - 12;
    tipEl.style.left = clamp(left, 8, Math.max(8, innerWidth - w - 8)) + "px";
    tipEl.style.top = clamp(top, 8, Math.max(8, innerHeight - ht - 8)) + "px";
  },
  at(el: Element, content: Node | string) {
    const r = el.getBoundingClientRect();
    tip.show(content, r.left + r.width / 2 - 8, r.bottom - 8);
  },
  hide() {
    if (tipEl) delete tipEl.dataset.show;
  },
};
/** The definition list every rich tooltip uses. */
export function detailList(title: string, rows: TipRow[], sub?: string): HTMLElement {
  return h(
    "div.tip-body",
    h("strong.tip-title", title),
    sub ? h("span.tip-sub", sub) : null,
    h(
      "dl",
      rows.map((r) =>
        r === "-"
          ? h("div.tip-rule")
          : h("div", { class: r[3] ?? "" }, h("dt", r[2] ? h("i.dot", { style: { background: r[2] } }) : null, r[0]), h("dd", r[1])),
      ),
    ),
  );
}
/** Plain text tooltips for any element with data-tip. Returns the cleanup. */
export function initSimpleTips(): () => void {
  let timer = 0;
  const target = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLElement>("[data-tip]") : null);
  const show = (e: Event) => {
    const t = target(e);
    if (!t || !t.dataset.tip) return;
    clearTimeout(timer);
    timer = window.setTimeout(
      () => {
        if (!t.isConnected || !t.dataset.tip) return;
        const r = t.getBoundingClientRect();
        tip.show(h("span.tip-plain", t.dataset.tip), r.left + r.width / 2 - 16, r.bottom - 6);
      },
      e.type === "focusin" ? 0 : 320,
    );
  };
  const hide = (e: Event) => {
    if (target(e)) {
      clearTimeout(timer);
      tip.hide();
    }
  };
  const down = () => clearTimeout(timer);
  document.addEventListener("mouseover", show);
  document.addEventListener("focusin", show);
  document.addEventListener("mouseout", hide);
  document.addEventListener("focusout", hide);
  document.addEventListener("pointerdown", down, true);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("mouseover", show);
    document.removeEventListener("focusin", show);
    document.removeEventListener("mouseout", hide);
    document.removeEventListener("focusout", hide);
    document.removeEventListener("pointerdown", down, true);
    layerEl?.remove();
    layerEl = tipEl = null;
  };
}
/** Positions a floating element next to an anchor (shared with the dropdowns and date pickers). */
export { place } from "../../ui/floating";

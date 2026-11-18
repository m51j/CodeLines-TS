/** Tiny DOM builders for the imperative parts of the skin (charts and tooltip bodies). */
export type Kid = Node | string | number | null | undefined | false | Kid[];
type Handler = (e: Event) => void;
export type Attrs = Record<string, string | number | boolean | null | undefined | Handler | Record<string, string | number | null | undefined>>;
const SVG = "http://www.w3.org/2000/svg";
function build<E extends Element>(el: E, sel: string, attrs: Attrs | null | undefined, kids: Kid[]): E {
  const cls = sel.match(/\.[\w-]+/g);
  if (cls) el.setAttribute("class", cls.map((c) => c.slice(1)).join(" "));
  if (attrs)
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.setAttribute("class", ((el.getAttribute("class") ?? "") + " " + String(v)).trim());
      else if (k === "style" && typeof v === "object") {
        const style = (el as unknown as HTMLElement).style;
        for (const [p, val] of Object.entries(v))
          if (val !== null && val !== undefined) style.setProperty(p.startsWith("--") ? p : p.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()), String(val));
      } else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "text") el.textContent = String(v);
      else el.setAttribute(k, v === true ? "" : String(v));
    }
  append(el, kids);
  return el;
}
export function append(el: Element, kids: Kid[]): Element {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}
const isAttrs = (a: unknown): a is Attrs =>
  !!a && typeof a === "object" && !(a instanceof Node) && !Array.isArray(a);
/** h("div.panel", {attrs}, ...children) */
export function h(sel: string, attrs?: Attrs | Kid, ...kids: Kid[]): HTMLElement {
  const tag = sel.match(/^[a-z][\w-]*/i)?.[0] ?? "div";
  if (!isAttrs(attrs)) return build(document.createElement(tag), sel, null, [attrs as Kid, ...kids]);
  return build(document.createElement(tag), sel, attrs, kids);
}
/** SVG element builder. */
export function s(sel: string, attrs?: Attrs | Kid, ...kids: Kid[]): SVGElement {
  const tag = sel.match(/^[a-z][\w-]*/i)?.[0] ?? "g";
  const el = document.createElementNS(SVG, tag) as SVGElement;
  if (!isAttrs(attrs)) return build(el, sel, null, [attrs as Kid, ...kids]);
  return build(el, sel, attrs, kids);
}
export const clear = <E extends Element>(el: E): E => {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
};
let uid = 0;
export const nextId = (p = "il") => p + "-" + ++uid;

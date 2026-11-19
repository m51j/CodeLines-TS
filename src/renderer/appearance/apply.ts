/**
 * Applies an appearance to a document: the skin's stylesheet, the scheme, density,
 * motion and the derived accent. Only the active skin's stylesheet is in the page,
 * so skins never see each other's rules.
 */
import {
  accentOf,
  type AppearanceBoot,
  type Scheme,
  type Skin,
} from "../../shared/appearance";
import { accentProperties, deriveAccent, type DerivedAccent } from "./accent";
export type SkinStyles = Record<Skin, string>;
const darkQuery = () => matchMedia("(prefers-color-scheme: dark)");
const motionQuery = () => matchMedia("(prefers-reduced-motion: reduce)");
export const schemeOf = (theme: AppearanceBoot["theme"]): Scheme =>
  theme === "Dark" || (theme === "System" && darkQuery().matches) ? "dark" : "light";
export const reducedOf = (motion: AppearanceBoot["appearance"]["motion"]) =>
  motion === "Reduce" || (motion === "System" && motionQuery().matches);
/** True while the page should not animate (the in-app setting merged with the system's). */
export const reducedMotion = () =>
  typeof document !== "undefined" &&
  document.documentElement.dataset.motion === "reduce";
let current: DerivedAccent | null = null;
export const currentAccent = () => current;
function setStyle(css: string) {
  let el = document.getElementById("skin-style") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "skin-style";
    document.head.appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
}
export function applyAppearance(boot: AppearanceBoot, styles: SkinStyles) {
  const { appearance } = boot,
    root = document.documentElement,
    scheme = schemeOf(boot.theme),
    skin = appearance.skin;
  setStyle(styles[skin]);
  root.dataset.skin = skin.toLowerCase();
  root.dataset.theme = scheme;
  root.dataset.density = appearance.density.toLowerCase();
  root.dataset.motion = reducedOf(appearance.motion) ? "reduce" : "full";
  for (const p of accentProperties) root.style.removeProperty(p);
  const hex = accentOf(appearance);
  current = hex ? deriveAccent(skin, hex, scheme) : null;
  if (current)
    for (const [k, v] of Object.entries(current.vars)) root.style.setProperty(k, v);
}
/**
 * Runs a change with the skins' circular reveal: the new look opens as a circle from
 * the pressed control (View Transitions). The update must render and apply the new
 * appearance synchronously; without an origin or with reduced motion it just runs.
 */
export function reveal(
  origin: Element | null | undefined,
  update: () => void,
): Promise<void> {
  const root = document.documentElement;
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { finished: Promise<void> };
  };
  if (
    !origin ||
    !doc.startViewTransition ||
    reducedMotion() ||
    document.visibilityState !== "visible"
  ) {
    update();
    return Promise.resolve();
  }
  return new Promise((done) => {
    // A window that is not painting never runs the transition's callback: apply anyway.
    let ran = false;
    const once = () => {
      if (ran) return;
      ran = true;
      update();
      done();
    };
    const r = origin.getBoundingClientRect();
    root.style.setProperty("--vt-x", r.left + r.width / 2 + "px");
    root.style.setProperty("--vt-y", r.top + r.height / 2 + "px");
    root.classList.add("vt-reveal");
    doc
      .startViewTransition!(once)
      .finished.catch(() => {})
      .finally(() => root.classList.remove("vt-reveal"));
    setTimeout(once, 300);
  });
}
/** Calls back when a system setting the appearance follows changes. */
export function watchSystem(callback: () => void) {
  const a = darkQuery(),
    b = motionQuery();
  a.addEventListener("change", callback);
  b.addEventListener("change", callback);
  return () => {
    a.removeEventListener("change", callback);
    b.removeEventListener("change", callback);
  };
}

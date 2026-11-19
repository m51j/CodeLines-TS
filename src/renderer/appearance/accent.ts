/**
 * Accent maths shared by every skin: sRGB ⇄ OKLCH, WCAG contrast, and one
 * derivation per skin that turns any picked colour into the custom properties
 * the skin's stylesheet reads, with the contrast its design promises.
 * Ported from the Instrument (CL.color.derive) and Linework (theme.js) prototypes.
 */
import type { Scheme, Skin } from "../../shared/appearance";
export type Rgb = [number, number, number];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const toLin = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const toGam = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
export function hexToRgb(hex: string): Rgb | null {
  let x = String(hex).replace("#", "").trim();
  if (x.length === 3)
    x = x
      .split("")
      .map((c) => c + c)
      .join("");
  if (!/^[0-9a-f]{6}$/i.test(x)) return null;
  const n = parseInt(x, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export const rgbToHex = (rgb: Rgb) =>
  "#" +
  rgb
    .map((c) =>
      Math.round(clamp(c, 0, 1) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
export function rgbToOklch([r0, g0, b0]: Rgb): [number, number, number] {
  const r = toLin(r0),
    g = toLin(g0),
    b = toLin(b0);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b),
    m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * q,
    A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * q,
    B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * q;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
function oklchToLinear(L: number, C: number, H: number): Rgb {
  const a = C * Math.cos((H * Math.PI) / 180),
    b = C * Math.sin((H * Math.PI) / 180);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3),
    m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3),
    q = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * q,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * q,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * q,
  ];
}
const inGamut = (rgb: Rgb) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);
/** OKLCH → sRGB, keeping lightness and hue and reducing chroma until the colour fits. */
export function oklchToRgb(L: number, C: number, H: number): Rgb {
  let lo = 0,
    hi = C,
    rgb = oklchToLinear(L, C, H);
  if (!inGamut(rgb)) {
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, mid, H))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinear(L, lo, H);
  }
  return rgb.map((c) => clamp(toGam(clamp(c, 0, 1)), 0, 1)) as Rgb;
}
export const luminance = ([r, g, b]: Rgb) =>
  0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
export function contrast(a: Rgb, b: Rgb) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const mix = (a: Rgb, b: Rgb, t: number) =>
  a.map((c, i) => toGam(toLin(c) * (1 - t) + toLin(b[i]) * t)) as Rgb;
const ok = (L: number, C: number, H: number) => oklchToRgb(L, C, H);
/** The neutral surfaces each skin's accent must stand out from (kept in sync with its tokens). */
export const neutrals: Record<Skin, Record<Scheme, Rgb[]>> = {
  Classic: {
    light: ["#ffffff", "#f4f7fb", "#f7f9fd"].map((h) => hexToRgb(h)!),
    dark: ["#111b2c", "#0b1120", "#152136"].map((h) => hexToRgb(h)!),
  },
  Instrument: {
    // surface, surface-2, bg, chrome
    light: [ok(0.995, 0.003, 85), ok(0.962, 0.007, 85), ok(0.968, 0.006, 85), ok(0.944, 0.008, 85)],
    dark: [ok(0.208, 0.01, 270), ok(0.244, 0.012, 270), ok(0.168, 0.008, 270), ok(0.136, 0.008, 270)],
  },
  Linework: {
    light: ["#fffdf8", "#f4f1ea", "#f7f4ed"].map((h) => hexToRgb(h)!),
    dark: ["#161a22", "#0e1117", "#1d222c"].map((h) => hexToRgb(h)!),
  },
};
export interface DerivedAccent {
  /** Custom properties to set on the root element. */
  vars: Record<string, string>;
  /** Contrast ratios the derivation reached, for the appearance readout. */
  ratios: { text: number; ui: number; onAccent: number };
}
/** Instrument: fill ≥ 3:1 against the surface, label on it ≥ 4.6:1, a text accent ≥ 4.6:1 everywhere. */
function deriveInstrument(hex: string, dark: boolean): DerivedAccent {
  const backgrounds = neutrals.Instrument[dark ? "dark" : "light"];
  const [L0, C0, H] = rgbToOklch(hexToRgb(hex) ?? [0.94, 0.38, 0.17]);
  const C = Math.min(C0, 0.2);
  let L = dark ? clamp(L0, 0.66, 0.82) : clamp(L0, 0.48, 0.67);
  const INK: Rgb = [0.07, 0.065, 0.06],
    WHITE: Rgb = [1, 1, 1];
  let fill = oklchToRgb(L, C, H),
    on = INK;
  for (let i = 0; i < 60; i++) {
    fill = oklchToRgb(L, C, H);
    const ci = contrast(fill, INK),
      cw = contrast(fill, WHITE);
    on = ci >= cw ? INK : WHITE;
    const okFill = contrast(fill, backgrounds[0]) >= 3.05;
    if (okFill && Math.max(ci, cw) >= 4.6) break;
    if (!okFill) L += dark ? 0.01 : -0.01;
    else L += on === INK ? 0.01 : -0.01;
  }
  const all = backgrounds.concat(backgrounds.map((bg) => mix(bg, fill, 0.16)));
  const worst = (l: number) =>
    Math.min(...all.map((bg) => contrast(oklchToRgb(l, C, H), bg)));
  let Lt = L;
  for (let i = 0; i < 80 && worst(Lt) < 4.6; i++) Lt += dark ? 0.008 : -0.008;
  Lt = clamp(Lt, 0.12, 0.97);
  return {
    vars: {
      "--accent": rgbToHex(fill),
      "--on-accent": rgbToHex(on),
      "--accent-text": rgbToHex(oklchToRgb(Lt, C, H)),
    },
    ratios: {
      text: worst(Lt),
      ui: contrast(fill, backgrounds[0]),
      onAccent: contrast(fill, on),
    },
  };
}
/** Walks lightness away from the references until every one passes the target. */
function reach(base: [number, number, number], refs: Rgb[], target: number, darker: boolean) {
  const passes = (rgb: Rgb) => refs.every((r) => contrast(rgb, r) >= target);
  for (let l = base[0]; darker ? l >= 0 : l <= 1; l += darker ? -0.01 : 0.01) {
    const rgb = oklchToRgb(clamp(l, 0, 1), base[1], base[2]);
    if (passes(rgb)) return rgb;
  }
  // Even the extreme of this hue misses the target: fall back to plain ink.
  return oklchToRgb(darker ? 0 : 1, 0, base[2]);
}
/** Linework: the colour as picked, an ink for text (4.6:1), a UI tone (3.1:1) and a button fill (4.5:1 with its label). */
function deriveLinework(hex: string, dark: boolean): DerivedAccent {
  const refs = neutrals.Linework[dark ? "dark" : "light"];
  const rgb = hexToRgb(hex) ?? hexToRgb("#f2683c")!;
  const base = rgbToOklch(rgb);
  const ink = reach(base, refs, 4.6, !dark),
    ui = reach(base, refs, 3.1, !dark);
  const white: Rgb = [1, 1, 1],
    black = hexToRgb("#101218")!;
  let fill = rgb;
  const on = contrast(fill, white) >= contrast(fill, black) ? white : black;
  if (contrast(fill, on) < 4.5) fill = reach(base, [on], 4.6, on === white);
  return {
    vars: {
      "--accent": rgbToHex(rgb),
      "--accent-ink": rgbToHex(ink),
      "--accent-ui": rgbToHex(ui),
      "--accent-fill": rgbToHex(fill),
      "--on-accent": rgbToHex(on),
    },
    ratios: {
      text: Math.min(...refs.map((r) => contrast(ink, r))),
      ui: Math.min(...refs.map((r) => contrast(ui, r))),
      onAccent: contrast(fill, on),
    },
  };
}
/** Classic: one accent used for text, borders and button fills, readable on every surface. */
function deriveClassic(hex: string, dark: boolean): DerivedAccent {
  const refs = neutrals.Classic[dark ? "dark" : "light"];
  const base = rgbToOklch(hexToRgb(hex) ?? hexToRgb("#405bdc")!);
  const accent = reach(base, refs, 4.5, !dark);
  const label = hexToRgb(dark ? "#0b1120" : "#ffffff")!;
  const a = rgbToHex(accent);
  return {
    vars: {
      "--accent": a,
      "--accent-soft": `color-mix(in oklab, ${a} ${dark ? 24 : 12}%, var(--surface))`,
      "--rail-active": "var(--accent-soft)",
      "--rail-active-text": a,
      "--rail-card-icon": a,
    },
    ratios: {
      text: Math.min(...refs.map((r) => contrast(accent, r))),
      ui: Math.min(...refs.map((r) => contrast(accent, r))),
      onAccent: contrast(accent, label),
    },
  };
}
export function deriveAccent(skin: Skin, hex: string, scheme: Scheme): DerivedAccent {
  const dark = scheme === "dark";
  return skin === "Instrument"
    ? deriveInstrument(hex, dark)
    : skin === "Linework"
      ? deriveLinework(hex, dark)
      : deriveClassic(hex, dark);
}
/** Every property any derivation may set, so a switch can clear the previous skin's values. */
export const accentProperties = [
  "--accent",
  "--accent-soft",
  "--accent-text",
  "--accent-ink",
  "--accent-ui",
  "--accent-fill",
  "--on-accent",
  "--rail-active",
  "--rail-active-text",
  "--rail-card-icon",
];

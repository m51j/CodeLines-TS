import { describe, it, expect } from "vitest";
import { parseSettings } from "../src/services/persistence";
import { defaults } from "../src/domain/defaults";
import { skinInfo, skins, accentOf, defaultAppearance } from "../src/shared/appearance";
import {
  contrast,
  deriveAccent,
  hexToRgb,
  neutrals,
  type Rgb,
} from "../src/renderer/appearance/accent";
const rgb = (hex: string) => hexToRgb(hex) as Rgb;
// A fixed pseudo-random sequence so the sample is the same on every run.
function* colours(n: number) {
  let x = 0x2f6b9d;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) & 0xffffff;
    yield "#" + x.toString(16).padStart(6, "0");
  }
}
describe("appearance settings", () => {
  it("defaults to the Linework skin and loads files saved before skins existed", () => {
    const old = defaults() as unknown as Record<string, unknown>;
    delete old.appearance;
    const s = parseSettings(old);
    expect(s.appearance).toEqual(defaultAppearance());
    expect(s.appearance.skin).toBe("Linework");
    expect(s.theme).toBe("System");
  });
  it("keeps a valid appearance and repairs invalid fields one by one", () => {
    const s = parseSettings({
      ...defaults(),
      appearance: {
        skin: "Linework",
        accents: { Linework: "#14b8a6", Instrument: "red", Classic: 7 },
        motion: "Sometimes",
        density: "Compact",
      },
    });
    expect(s.appearance.skin).toBe("Linework");
    expect(s.appearance.accents).toEqual({ Linework: "#14b8a6" });
    expect(s.appearance.motion).toBe("System");
    expect(s.appearance.density).toBe("Compact");
    expect(parseSettings({ ...defaults(), appearance: { skin: "Neon" } }).appearance.skin).toBe(
      "Linework",
    );
    expect(parseSettings({ ...defaults(), appearance: "dark" }).appearance).toEqual(
      defaultAppearance(),
    );
  });
  it("uses each skin's default accent until one is picked", () => {
    const a = defaultAppearance();
    expect(accentOf(a, "Classic")).toBeNull();
    expect(accentOf(a, "Instrument")).toBe("#f0602b");
    a.accents.Instrument = "#2e86f0";
    expect(accentOf(a, "Instrument")).toBe("#2e86f0");
  });
});
describe("accent derivation", () => {
  const samples = [...colours(60), "#ffffff", "#000000", "#ffff00", "#00ff00", "#0000ff"];
  for (const skin of skins)
    for (const scheme of ["light", "dark"] as const)
      it(`${skin} ${scheme}: every preset and random colour stays readable`, () => {
        const refs = neutrals[skin][scheme];
        for (const hex of [...skinInfo[skin].presets.map((p) => p.hex), ...samples]) {
          const d = deriveAccent(skin, hex, scheme);
          for (const v of Object.values(d.vars))
            if (v.startsWith("#")) expect(v).toMatch(/^#[0-9a-f]{6}$/);
          if (skin === "Instrument") {
            const text = rgb(d.vars["--accent-text"]);
            for (const r of refs) expect(contrast(text, r)).toBeGreaterThanOrEqual(4.5);
            expect(contrast(rgb(d.vars["--accent"]), rgb(d.vars["--on-accent"]))).toBeGreaterThanOrEqual(4.5);
            expect(contrast(rgb(d.vars["--accent"]), refs[0])).toBeGreaterThanOrEqual(3);
          } else if (skin === "Linework") {
            for (const r of refs) {
              expect(contrast(rgb(d.vars["--accent-ink"]), r)).toBeGreaterThanOrEqual(4.5);
              expect(contrast(rgb(d.vars["--accent-ui"]), r)).toBeGreaterThanOrEqual(3);
            }
            expect(contrast(rgb(d.vars["--accent-fill"]), rgb(d.vars["--on-accent"]))).toBeGreaterThanOrEqual(4.5);
          } else {
            for (const r of refs)
              expect(contrast(rgb(d.vars["--accent"]), r)).toBeGreaterThanOrEqual(4.4);
          }
        }
      });
});

/** Skin, theme, accent, motion and density controls: the title-bar popover and Settings ▸ Appearance. */
import { useState, type CSSProperties } from "react";
import type { Skin } from "../../../shared/appearance";
import type { Settings } from "../../../shared/contracts";
import { useAppearanceControls } from "../../appearance/controls";
import { Icon } from "./icons";
import { Seg } from "./ui/controls";
/** Small pictures of each skin, drawn from its own palette. */
const preview: Record<Skin, { bg: string; surface: string; line: string; ink: string; accent: string }> = {
  Classic: { bg: "#f4f7fb", surface: "#ffffff", line: "#dce3ed", ink: "#172033", accent: "#405bdc" },
  Instrument: { bg: "#16171c", surface: "#1f2127", line: "#33353d", ink: "#f2f0ec", accent: "#f0602b" },
  Linework: { bg: "#0e1117", surface: "#161a22", line: "#2a303c", ink: "#eceef3", accent: "#f2683c" },
};
const ratio = (n: number) => n.toFixed(1) + ":1";
export function LookControls({ className }: { className?: string }) {
  const c = useAppearanceControls();
  const accent = (c.accent ?? "#f0602b").toLowerCase();
  const [hex, setHex] = useState<string | null>(null);
  const presets = c.info.presets;
  const custom = !presets.some((p) => p.hex.toLowerCase() === accent);
  return (
    <div className={"look" + (className ? " " + className : "")}>
      <div className="look-row">
        <span className="look-label">Skin</span>
        <div className="skins" role="radiogroup" aria-label="Skin">
          {c.skins.map((s) => {
            const p = preview[s.id],
              on = c.appearance.skin === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={s.name + " skin"}
                data-tip={s.tagline}
                disabled={c.busy}
                className="skin-opt"
                onClick={(e) => c.setSkin(s.id, e.currentTarget)}
              >
                <span
                  className="skin-thumb"
                  aria-hidden="true"
                  style={{ "--p-bg": p.bg, "--p-surface": p.surface, "--p-line": p.line, "--p-ink": p.ink, "--p-accent": p.accent } as CSSProperties}
                >
                  <i />
                  <i />
                  <i />
                </span>
                <span className="skin-name">
                  {s.name}
                  {on && <Icon name="check" size={13} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="look-row">
        <span className="look-label">Theme</span>
        <Seg<Settings["theme"]>
          label="Appearance"
          role="radiogroup"
          value={c.theme}
          disabled={c.busy}
          options={[
            { value: "System", icon: "monitor", label: "System", aria: "System theme" },
            { value: "Light", icon: "sun", label: "Light", aria: "Light theme" },
            { value: "Dark", icon: "moon", label: "Dark", aria: "Dark theme" },
          ]}
          onChange={(v, el) => c.setTheme(v, el)}
        />
      </div>
      <div className="look-row">
        <span className="look-label">Accent</span>
        <div className="look-accent">
          <div className="swatches" role="radiogroup" aria-label="Accent colour">
            {presets.map((p) => (
              <button
                key={p.hex}
                type="button"
                className="swatch"
                role="radio"
                aria-checked={p.hex.toLowerCase() === accent}
                aria-label={p.name + " accent"}
                data-tip={p.name}
                disabled={c.busy}
                style={{ "--sw": p.hex } as CSSProperties}
                onClick={() => c.pickAccent(p.hex)}
              >
                <Icon name="check" size={13} />
              </button>
            ))}
          </div>
          <div className={"swatch-custom" + (custom ? " is-on" : "")}>
            <label className="swatch-well" data-tip="Pick any colour">
              <input
                className="swatch-picker"
                type="color"
                aria-label="Custom accent colour"
                value={accent.length === 7 ? accent : "#000000"}
                disabled={c.busy}
                onChange={(e) => c.pickAccent(e.target.value)}
              />
              <Icon name="plus" size={13} />
            </label>
            <input
              className="swatch-hex mono"
              type="text"
              aria-label="Custom accent as hex"
              maxLength={7}
              spellCheck={false}
              disabled={c.busy}
              value={hex ?? accent}
              onFocus={() => setHex(accent)}
              onChange={(e) => {
                setHex(e.target.value);
                const m = e.target.value.trim().match(/^#?([0-9a-f]{6})$/i);
                if (m) c.pickAccent("#" + m[1].toLowerCase());
              }}
              onBlur={() => setHex(null)}
            />
            <span className="look-custom-label">Custom</span>
            {c.custom && (
              <button type="button" className="btn btn-sm btn-ghost look-reset" disabled={c.busy} onClick={() => c.resetAccent()} data-tip="Back to the skin's own accent">
                <Icon name="undo" size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="look-readout" aria-live="polite">
        {c.ratios
          ? `Derived for this theme · text on accent ${ratio(c.ratios.onAccent)} · accent text ${ratio(c.ratios.text)} · fill ${ratio(c.ratios.ui)} · WCAG AA`
          : ""}
      </p>
      <div className="look-row">
        <span className="look-label">Motion</span>
        <Seg
          label="Motion"
          role="radiogroup"
          value={c.appearance.motion}
          disabled={c.busy}
          options={[
            { value: "System", label: "System", tip: "Follows your system setting" },
            { value: "Full", label: "Full" },
            { value: "Reduce", label: "Reduce" },
          ]}
          onChange={(v) => c.setMotion(v)}
        />
      </div>
      <div className="look-row">
        <span className="look-label">Density</span>
        <Seg
          label="Density"
          role="radiogroup"
          value={c.appearance.density}
          disabled={c.busy}
          options={[
            { value: "Comfortable", label: "Comfortable" },
            { value: "Compact", label: "Compact" },
          ]}
          onChange={(v) => c.setDensity(v)}
        />
      </div>
    </div>
  );
}

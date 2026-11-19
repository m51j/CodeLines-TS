import { Check, Monitor, Moon, Sun } from "lucide-react";
import type { CSSProperties } from "react";
import { Card, Field } from "../../components";
import { Select } from "../../ui/Select";
import { useAppearanceControls, type AppearanceControls } from "../../appearance/controls";
import type { Skin } from "../../../shared/appearance";
/** Small pictures of each skin, drawn from its own palette. */
export const skinPreview: Record<Skin, { bg: string; surface: string; line: string; ink: string; accent: string }> = {
  Classic: { bg: "#f4f7fb", surface: "#ffffff", line: "#dce3ed", ink: "#172033", accent: "#405bdc" },
  Instrument: { bg: "#0e0f13", surface: "#16181d", line: "#292b31", ink: "#f2f0ec", accent: "#f0602b" },
  Linework: { bg: "#0e1117", surface: "#161a22", line: "#2a303c", ink: "#eceef3", accent: "#f2683c" },
};
const themes = [
  { value: "System", icon: Monitor },
  { value: "Light", icon: Sun },
  { value: "Dark", icon: Moon },
] as const;
const ratio = (n: number) => n.toFixed(1) + ":1";
type Part = { c: AppearanceControls };
/** One button per skin; `compact` drops the thumbnail and tagline. */
export function SkinChoices({ c, compact }: Part & { compact?: boolean }) {
  return (
    <div className={compact ? "skin-picker compact" : "skin-picker"} role="radiogroup" aria-label="Skin">
      {c.skins.map((s) => {
        const p = skinPreview[s.id],
          on = c.appearance.skin === s.id;
        return (
          <button
            key={s.id}
            role="radio"
            aria-checked={on}
            aria-label={s.name + " skin"}
            disabled={c.busy}
            className={on ? "skin-option active" : "skin-option"}
            onClick={(e) => c.setSkin(s.id, e.currentTarget)}
          >
            {!compact && (
              <span
                className="skin-thumb"
                aria-hidden="true"
                style={
                  {
                    "--p-bg": p.bg,
                    "--p-surface": p.surface,
                    "--p-line": p.line,
                    "--p-ink": p.ink,
                    "--p-accent": p.accent,
                  } as CSSProperties
                }
              >
                <i />
                <i />
                <i />
              </span>
            )}
            <strong>
              {s.name}
              {on && <Check size={14} aria-hidden="true" />}
            </strong>
            {!compact && <small>{s.tagline}</small>}
          </button>
        );
      })}
    </div>
  );
}
export function ThemeChoices({ c }: Part) {
  return (
    <div className="theme-switch inline" role="radiogroup" aria-label="Theme">
      {themes.map(({ value, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={c.theme === value}
          aria-label={value}
          title={value}
          disabled={c.busy}
          onClick={(e) => c.setTheme(value, e.currentTarget)}
        >
          <Icon size={15} aria-hidden="true" />
          <span>{value}</span>
        </button>
      ))}
    </div>
  );
}
export function MotionSelect({ c }: Part) {
  return (
    <Select
      aria-label="Motion"
      value={c.appearance.motion}
      disabled={c.busy}
      onChange={c.setMotion}
      options={[
        { value: "System", label: "Follow Windows" },
        { value: "Full", label: "Full" },
        { value: "Reduce", label: "Reduced" },
      ]}
    />
  );
}
export function DensitySelect({ c }: Part) {
  return (
    <Select
      aria-label="Density"
      value={c.appearance.density}
      disabled={c.busy}
      onChange={c.setDensity}
      options={[
        { value: "Comfortable", label: "Comfortable" },
        { value: "Compact", label: "Compact" },
      ]}
    />
  );
}
/** Accent swatches, a custom color, the hex field and, unless `compact`, the contrast readout. */
export function AccentChoices({ c, compact }: Part & { compact?: boolean }) {
  return (
    <>
      <div className="accent-swatches" role="radiogroup" aria-label="Accent color">
        {!c.info.defaultAccent && (
          <button
            role="radio"
            aria-checked={!c.custom}
            aria-label="Default accent"
            title="Default"
            className="swatch swatch-default"
            disabled={c.busy}
            onClick={c.resetAccent}
          />
        )}
        {c.info.presets.map((p) => (
          <button
            key={p.hex}
            role="radio"
            aria-checked={c.accent === p.hex}
            aria-label={p.name + " accent"}
            title={p.name}
            className="swatch"
            style={{ background: p.hex }}
            disabled={c.busy}
            onClick={(e) => c.pickAccent(p.hex, e.currentTarget)}
          />
        ))}
        <label className="swatch swatch-custom" title="Custom color">
          <input
            type="color"
            aria-label="Custom accent color"
            disabled={c.busy}
            value={c.accent ?? "#405bdc"}
            onChange={(e) => c.pickAccent(e.target.value)}
          />
        </label>
      </div>
      {!compact && (
        <input
          className="accent-hex"
          aria-label="Accent hex"
          spellCheck={false}
          disabled={c.busy}
          defaultValue={c.accent ?? ""}
          key={c.accent ?? "default"}
          placeholder="#405bdc"
          onBlur={(e) => c.pickAccent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") c.pickAccent(e.currentTarget.value);
          }}
        />
      )}
      {c.custom && c.info.defaultAccent && (
        <button className="link-button" disabled={c.busy} onClick={c.resetAccent}>
          Reset
        </button>
      )}
      {!compact && <ContrastRatios c={c} />}
    </>
  );
}
export function ContrastRatios({ c }: Part) {
  return c.ratios ? (
    <span className="muted accent-ratios" title="WCAG contrast reached on this theme">
      Text {ratio(c.ratios.text)} · Buttons {ratio(c.ratios.onAccent)}
    </span>
  ) : null;
}
export function AppearanceCard() {
  const c = useAppearanceControls();
  return (
    <Card title="Appearance" subtitle="Skin, colors, motion and density apply at once">
      <SkinChoices c={c} />
      <div className="settings-grid">
        <Field label="Theme">
          <ThemeChoices c={c} />
        </Field>
        <Field label="Motion">
          <MotionSelect c={c} />
        </Field>
        <Field label="Density">
          <DensitySelect c={c} />
        </Field>
      </div>
      <div className="accent-row">
        <span className="accent-label">Accent</span>
        <AccentChoices c={c} />
      </div>
    </Card>
  );
}

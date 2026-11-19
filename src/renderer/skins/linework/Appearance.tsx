/** Appearance controls shared by the title-bar popover and Settings: skin, theme, accent, motion, density. */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { AppearanceControls } from "../../appearance/controls";
import type { Skin } from "../../../shared/appearance";
import type { Settings } from "../../../shared/contracts";
import { Icon } from "./icons";
import { Seg, press } from "./ui/Choice";

/** Small pictures of each skin, drawn from its own palette. */
const skinThumb: Record<Skin, { bg: string; surface: string; line: string; ink: string; accent: string }> = {
  Classic: { bg: "#f4f7fb", surface: "#ffffff", line: "#dce3ed", ink: "#172033", accent: "#405bdc" },
  Instrument: { bg: "#0e0f13", surface: "#16181d", line: "#292b31", ink: "#f2f0ec", accent: "#f0602b" },
  Linework: { bg: "#0e1117", surface: "#161a22", line: "#2a303c", ink: "#eceef3", accent: "#f2683c" },
};

export function SkinPicker({ c, compact }: { c: AppearanceControls; compact?: boolean }) {
  return (
    <div className={"skin-picker" + (compact ? " compact" : "")} role="radiogroup" aria-label="Skin">
      {c.skins.map((s) => {
        const p = skinThumb[s.id],
          on = c.appearance.skin === s.id;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={s.name + " skin"}
            title={s.tagline}
            disabled={c.busy}
            className="skin-option"
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
            <strong>
              {s.name}
              {on && <Icon name="check" />}
            </strong>
            {!compact && <small>{s.tagline}</small>}
          </button>
        );
      })}
    </div>
  );
}

const themeOptions = (labels: boolean) =>
  (
    [
      ["System", "monitor"],
      ["Light", "sun"],
      ["Dark", "moon"],
    ] as const
  ).map(([v, icon]) => ({
    v,
    aria: labels ? undefined : v + " theme",
    title: v + " theme",
    l: (
      <>
        <Icon name={icon} />
        {labels && <span>{v}</span>}
      </>
    ),
  }));

export function ThemeSeg({ c, labels = true, label = "Theme", className = "" }: { c: AppearanceControls; labels?: boolean; label?: string; className?: string }) {
  return (
    <Seg<Settings["theme"]>
      label={label}
      kind="radio"
      className={className}
      value={c.theme}
      disabled={c.busy}
      options={themeOptions(labels)}
      onChange={(v, el) => c.setTheme(v, el)}
    />
  );
}

export function MotionSeg({ c, system = "System" }: { c: AppearanceControls; system?: string }) {
  return (
    <Seg
      label="Motion"
      kind="radio"
      value={c.appearance.motion}
      disabled={c.busy}
      options={[
        { v: "System", l: system },
        { v: "Reduce", l: "Reduce" },
        { v: "Full", l: "Full" },
      ]}
      onChange={(v) => c.setMotion(v)}
    />
  );
}

export function DensitySeg({ c }: { c: AppearanceControls }) {
  return (
    <Seg
      label="Density"
      kind="radio"
      value={c.appearance.density}
      disabled={c.busy}
      options={[
        { v: "Comfortable", l: "Comfortable" },
        { v: "Compact", l: "Compact" },
      ]}
      onChange={(v) => c.setDensity(v)}
    />
  );
}

export function AccentPicker({ c }: { c: AppearanceControls }) {
  const presets = c.info.presets,
    isPreset = presets.some((p) => p.hex === c.accent),
    custom = c.accent ?? "#f2683c";
  return (
    <div
      className="accent-picker"
      role="radiogroup"
      aria-label="Accent colour"
      onKeyDown={(e) => {
        const list = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-accent]")],
          i = list.indexOf(document.activeElement as HTMLElement);
        if (i < 0 || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
        e.preventDefault();
        const n = (i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
        list[n].focus();
        const hex = list[n].dataset.accent;
        if (hex && hex !== "custom") c.pickAccent(hex);
      }}
    >
      {presets.map((p) => {
        const on = c.accent === p.hex;
        return (
          <button
            key={p.hex}
            type="button"
            role="radio"
            className="swatch"
            data-accent={p.hex}
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            title={p.name}
            disabled={c.busy}
            style={{ "--sw": p.hex } as CSSProperties}
            onClick={(e) => {
              press(e.currentTarget);
              // No reveal: accent colours are registered with @property, so every use of them glides.
              c.pickAccent(p.hex);
            }}
          >
            <span className="sr-only">{p.name}</span>
            <Icon name="check" />
          </button>
        );
      })}
      <label
        className="swatch custom"
        title="Custom colour"
        data-accent="custom"
        role="radio"
        aria-checked={!isPreset}
        tabIndex={isPreset ? -1 : 0}
        style={{ "--sw": custom } as CSSProperties}
      >
        <input type="color" value={custom} aria-label="Custom accent colour" disabled={c.busy} onChange={(e) => c.pickAccent(e.target.value)} />
        <Icon name="palette" />
      </label>
      <HexInput value={custom} disabled={c.busy} onPick={(hex) => c.pickAccent(hex)} />
      {c.custom && (
        <button type="button" className="btn sm ghost" disabled={c.busy} onClick={c.resetAccent} title={"Back to " + c.info.presets[0].name}>
          Reset
        </button>
      )}
    </div>
  );
}

export function ContrastReadout({ c }: { c: AppearanceControls }) {
  if (!c.ratios) return null;
  const ok = (r: number, t: number) => (
    <b className={r >= t ? "pass" : "fail"}>
      {r.toFixed(1)}:1 {r >= t ? "AA ✓" : "✗"}
    </b>
  );
  return (
    <p className="contrast-readout" title="WCAG contrast reached on this theme">
      <Icon name="check" />
      Accent text on surface {ok(c.ratios.text, 4.5)} · Text on accent buttons {ok(c.ratios.onAccent, 4.5)} · Accent UI parts{" "}
      {ok(c.ratios.ui, 3)}
    </p>
  );
}

/** The hex field follows the accent unless it is being typed in. */
function HexInput({ value, disabled, onPick }: { value: string; disabled: boolean; onPick: (hex: string) => void }) {
  const [text, setText] = useState(value),
    ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (document.activeElement !== ref.current) setText(value);
  }, [value]);
  return (
    <input
      ref={ref}
      className="input hex-input mono"
      aria-label="Accent hex value"
      maxLength={7}
      spellCheck={false}
      disabled={disabled}
      value={text}
      onBlur={() => setText(value)}
      onChange={(e) => {
        setText(e.target.value);
        const v = e.target.value.trim();
        if (/^#?[0-9a-f]{6}$/i.test(v)) onPick(v.startsWith("#") ? v : "#" + v);
      }}
    />
  );
}

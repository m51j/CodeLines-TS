import { useCallback, useEffect, useRef, useState } from "react";
import {
  accentOf,
  skinInfo,
  skins,
  type Appearance,
  type Skin,
} from "../../shared/appearance";
import type { Settings } from "../../shared/contracts";
import { useWorkspace } from "../workspace";
import { deriveAccent, hexToRgb, rgbToHex } from "./accent";
import { schemeOf } from "./apply";
/** Everything an appearance picker needs, shared by every skin's own controls. */
export function useAppearanceControls() {
  const { draft, busy, change, setTheme, setAppearance } = useWorkspace();
  const a = draft.appearance,
    info = skinInfo[a.skin],
    accent = accentOf(a),
    scheme = schemeOf(draft.theme);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  /** Free picking previews at once and saves when the pointer settles. */
  const pickAccent = useCallback(
    (hex: string, origin?: Element | null) => {
      const rgb = hexToRgb(hex);
      if (!rgb) return;
      const value = rgbToHex(rgb);
      change((s) => {
        s.appearance.accents = { ...s.appearance.accents, [s.appearance.skin]: value };
      });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void setAppearance({ accents: { ...a.accents, [a.skin]: value } }, origin);
      }, 280);
    },
    [a.accents, a.skin, change, setAppearance],
  );
  const resetAccent = useCallback(() => {
    const accents = { ...a.accents };
    delete accents[a.skin];
    void setAppearance({ accents });
  }, [a.accents, a.skin, setAppearance]);
  const [ratios, setRatios] = useState(() =>
    accent ? deriveAccent(a.skin, accent, scheme).ratios : null,
  );
  useEffect(() => {
    setRatios(accent ? deriveAccent(a.skin, accent, scheme).ratios : null);
  }, [a.skin, accent, scheme]);
  return {
    busy: !!busy,
    appearance: a,
    theme: draft.theme,
    scheme,
    skins: skins.map((s) => skinInfo[s]),
    info,
    accent,
    custom: !!a.accents[a.skin],
    ratios,
    setSkin: (skin: Skin, origin?: Element | null) => void setAppearance({ skin }, origin),
    setTheme: (theme: Settings["theme"], origin?: Element | null) =>
      void setTheme(theme, origin),
    setMotion: (motion: Appearance["motion"]) => void setAppearance({ motion }),
    setDensity: (density: Appearance["density"]) => void setAppearance({ density }),
    pickAccent,
    resetAccent,
  };
}
export type AppearanceControls = ReturnType<typeof useAppearanceControls>;

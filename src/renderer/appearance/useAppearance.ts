import { useEffect, useLayoutEffect, useRef } from "react";
import type { AppearanceBoot } from "../../shared/appearance";
import { applyAppearance, watchSystem, type SkinStyles } from "./apply";
/** Keeps the document's skin, scheme, accent, density and motion in step with the settings. */
export function useAppearance(boot: AppearanceBoot | null, styles: SkinStyles) {
  const latest = useRef(boot);
  latest.current = boot;
  const key = boot ? JSON.stringify(boot) : "";
  useLayoutEffect(() => {
    if (latest.current) applyAppearance(latest.current, styles);
  }, [key, styles]);
  useEffect(
    () =>
      watchSystem(() => {
        if (latest.current) applyAppearance(latest.current, styles);
      }),
    [styles],
  );
}

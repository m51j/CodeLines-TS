/** Proportional share bars: segments grow in one after another, then resize to new shares by key. */
import { useEffect, useState } from "react";
import { reduced } from "../../../motion/core";
import { afterPaint } from "../ui/paint";
import { percent } from "../ui/fmt";

export interface Segment {
  key: string;
  label: string;
  share: number;
  color: string;
  detail: string;
}

export function Ribbon({ segments, className = "" }: { segments: Segment[]; className?: string }) {
  // 0: drawn empty, 1: growing (staggered), 2: settled (later changes resize together).
  const [phase, setPhase] = useState(() => (reduced() ? 2 : 0));
  useEffect(() => {
    if (phase === 0) return afterPaint(() => setPhase(1));
    if (phase === 1) {
      const t = setTimeout(() => setPhase(2), 700 + segments.length * 45);
      return () => clearTimeout(t);
    }
  }, [phase, segments.length]);
  return (
    <div
      className={"ribbon " + className + (phase ? " grown" : "")}
      role="img"
      aria-label={segments.map((s) => `${s.label} ${percent(s.share)}`).join(", ")}
    >
      {segments.map((s, i) => (
        <span
          key={s.key}
          className="rb-seg"
          tabIndex={0}
          data-tip-t={s.label}
          data-tip={s.detail}
          style={{
            ["--p" as string]: (s.share * 100).toFixed(3),
            ["--c" as string]: s.color,
            ["--i" as string]: phase < 2 ? i : 0,
          }}
        />
      ))}
    </div>
  );
}

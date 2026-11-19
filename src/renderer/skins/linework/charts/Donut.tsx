/**
 * A ring of shares (adapted from the Codex gpt-6 dashboard). Segments are keyed, so a new
 * selection slides them to their new shares; new segments grow from nothing.
 */
import { useEffect, useState } from "react";
import { reduced } from "../../../motion/core";
import { afterPaint } from "../ui/paint";
import { percent } from "../ui/fmt";

export interface DonutItem {
  key: string;
  label: string;
  value: number;
  color: string;
  detail: string;
}

function Ring({ item, len, pos, total }: { item: DonutItem; len: number; pos: number; total: number }) {
  const [on, setOn] = useState(() => reduced());
  useEffect(() => {
    if (on) return;
    return afterPaint(() => setOn(true));
  }, [on]);
  return (
    <circle
      className="ring"
      cx={74}
      cy={74}
      r={59}
      pathLength={100}
      tabIndex={0}
      role="img"
      transform="rotate(-90 74 74)"
      aria-label={`${item.label} ${percent(item.value / total)}`}
      data-tip-t={item.label}
      data-tip={item.detail}
      style={{
        stroke: item.color,
        strokeDasharray: on ? `${len.toFixed(3)} ${(100 - len).toFixed(3)}` : "0 100",
        strokeDashoffset: String(-pos),
      }}
    />
  );
}

export function Donut({ items, center, caption }: { items: DonutItem[]; center: string; caption: string }) {
  const total = items.reduce((n, x) => n + x.value, 0) || 1;
  let off = 0;
  return (
    <svg className="donut" viewBox="0 0 148 148" role="group" aria-label={caption + " share"}>
      <circle className="dn-track" cx="74" cy="74" r="59" />
      <g className="dn-segs">
        {items.map((it) => {
          const n = (it.value / total) * 100,
            len = Math.max(0.15, n - 1.1),
            pos = off;
          off += n;
          return <Ring key={it.key} item={it} len={len} pos={pos} total={total} />;
        })}
      </g>
      <circle className="dn-inner" cx="74" cy="74" r="44" />
      <text x="74" y="78" className="donut-big" textAnchor="middle">
        {center}
      </text>
      <text x="74" y="96" className="donut-small" textAnchor="middle">
        {caption}
      </text>
    </svg>
  );
}

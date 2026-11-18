/** Sparklines: the line draws in, then the area and the last point fade in. */
export function Spark({
  values,
  w = 120,
  h = 32,
  area = true,
  draw = true,
  zero = true,
}: {
  values: number[];
  w?: number;
  h?: number;
  area?: boolean;
  draw?: boolean;
  zero?: boolean;
}) {
  if (!values.length) return null;
  const hi = Math.max(...values),
    lo = Math.min(...values),
    max = Math.max(1, hi),
    min = zero ? Math.min(0, lo) : lo - (hi - lo) * 0.15,
    n = values.length;
  const pts = values.map((v, i) => [(i / Math.max(1, n - 1)) * (w - 2) + 1, h - 2 - ((v - min) / (max - min || 1)) * (h - 6)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return (
    // Keyed by its data, so new data draws in again.
    <svg key={d} className={"spark" + (draw ? " draw" : "")} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {area && <path className="sp-area" d={`${d} L${w - 1} ${h} L1 ${h} Z`} />}
      <path className="sp-line" pathLength={1} d={d} />
      <circle className="sp-dot" cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r={2.4} />
    </svg>
  );
}

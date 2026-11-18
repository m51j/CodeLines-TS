/** Sparkline: the stroke draws, the area fades in (CSS); `stretch` fills its box and wipes in. */
export function Spark({ values, w = 96, h = 30, stretch = false }: { values: (number | null | undefined)[]; w?: number; h?: number; stretch?: boolean }) {
  const pts = values.filter((v): v is number => v !== null && v !== undefined);
  if (pts.length < 2) return <span className="spark-none" />;
  const min = Math.min(...pts),
    max = Math.max(...pts),
    span = max - min || 1;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * (w - 4) + 2, h - 3 - ((v - min) / span) * (h - 7)]);
  const line = xy.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
  const end = xy[xy.length - 1];
  return (
    <svg
      className={"spark" + (stretch ? " is-stretch" : "")}
      width={stretch ? undefined : w}
      height={stretch ? undefined : h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={stretch ? "none" : undefined}
      aria-hidden="true"
    >
      <path className="spark-area" d={`${line}L${w - 2} ${h}L2 ${h}Z`} />
      <path className="spark-line" d={line} pathLength={1} />
      {!stretch && <circle className="spark-dot" cx={end[0]} cy={end[1]} r={2.2} />}
    </svg>
  );
}

/**
 * Project terrain (adapted from the Codex gpt-6 dashboard): an isometric wire-mesh landscape
 * with one summit per project, height scaled by physical lines. The mesh rises in; summits
 * fade in after it and are buttons (click, Enter or Space) that pick the project.
 */
import { memo, useMemo } from "react";
import type { ProjectMetric } from "../../../../shared/contracts";
import { number } from "../ui/fmt";

const seeded = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
interface Peak {
  x: number;
  y: number;
  weight: number;
  p: ProjectMetric;
}
const W = 64,
  H = 34;
const proj = (x: number, y: number, z: number): [number, number] => [38 + x * 402 + y * 94, 112 - x * 34 + y * 84 - z];
/** Highest screen y the mesh may reach: the view box starts at -19 and a summit label needs ~22 above its dot. */
const TOP = 4;
const xy = (p: [number, number]) => p.map((n) => n.toFixed(1)).join(",");

function landscape(projects: ProjectMetric[]) {
  const peaks: Peak[] = projects.map((p, i) => ({
    x: 0.11 + (0.8 * (i + 0.25)) / (projects.length + 0.1),
    y: 0.23 + seeded(i + 15) * 0.5,
    weight: p.physicalLines,
    p,
  }));
  const max = Math.max(1, ...peaks.map((p) => p.weight));
  const raw = (x: number, y: number) => {
    const wave = Math.sin(x * 24 + y * 8) * 0.02 + Math.sin(x * 45 - y * 14) * 0.01;
    return (
      peaks.reduce(
        (v, p) =>
          v +
          Math.pow(p.weight / max, 0.54) *
            Math.exp(-(((x - p.x + wave) / 0.107) ** 2 + ((y - p.y + Math.sin(x * 16) * 0.073) / 0.245) ** 2)),
        0,
      ) * 108
    );
  };
  // Neighbouring summits add up, so with many projects the mesh can rise past the top of the
  // view box (and the card clips it). Scale the heights so every point, and the label above
  // the highest summit, stays inside the frame.
  let fit = 1;
  for (let j = 0; j <= H; j++)
    for (let i = 0; i <= W; i++) {
      const z = raw(i / W, j / H);
      if (z > 0) fit = Math.min(fit, (proj(i / W, j / H, 0)[1] - TOP) / z);
    }
  const height = (x: number, y: number) => raw(x, y) * fit;
  const point = (i: number, j: number) => proj(i / W, j / H, height(i / W, j / H));
  let guides = "";
  for (let k = -4; k <= 13; k++)
    guides += `M${xy(proj(k / 10, -0.3, 0))}L${xy(proj(k / 10, 1.25, 0))}M${xy(proj(-0.16, k / 10, 0))}L${xy(proj(1.15, k / 10, 0))}`;
  const rows: { land: string; ridge: string; opacity: string; width: number; ribs: string }[] = [];
  for (let j = 0; j <= H; j++) {
    const row = Array.from({ length: W + 1 }, (_, i) => point(i, j));
    const back = Array.from({ length: W + 1 }, (_, i) => point(i, Math.max(j - 1, 0))).reverse();
    const ridge = row.map(xy).join(" ");
    let ribs = "";
    if (j) for (let i = 0; i <= W; i += 2) ribs += `M${xy(point(i, j - 1))}L${xy(point(i, j))}`;
    rows.push({
      land: ridge + " " + back.map(xy).join(" "),
      ridge,
      opacity: (0.75 + 0.21 * (1 - j / H)).toFixed(2),
      width: j % 4 === 0 ? 1.14 : 0.77,
      ribs,
    });
  }
  const summits = peaks.map((pk) => {
    const [x, y] = proj(pk.x, pk.y, height(pk.x, pk.y));
    return { p: pk.p, x, y };
  });
  return { guides, rows, summits };
}

const Mesh = memo(function Mesh({ guides, rows }: Pick<ReturnType<typeof landscape>, "guides" | "rows">) {
  return (
    <>
      <g className="tr-guides">
        <path d={guides} />
      </g>
      <g className="mesh">
        {rows.map((r, j) => (
          <g key={j}>
            <polygon className="tr-land" points={r.land} />
            <polyline className="tr-ridge" points={r.ridge} strokeOpacity={r.opacity} strokeWidth={r.width} />
            {r.ribs && <path className="tr-rib" d={r.ribs} />}
          </g>
        ))}
      </g>
    </>
  );
});

export function Terrain({
  projects,
  selectedId,
  onPick,
}: {
  projects: ProjectMetric[];
  selectedId: string | undefined;
  onPick: (id: string) => void;
}) {
  const shape = useMemo(() => landscape(projects), [projects]);
  if (!projects.length) return null;
  // The picked summit's label is drawn again on top, so it is never hidden behind a neighbour.
  const picked = shape.summits.find((s) => s.p.projectId === selectedId);
  return (
    <svg
      className="terrain"
      viewBox="0 -19 540 236"
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label="Project terrain. Each summit is a project; its height follows the project's physical lines."
    >
      <Mesh guides={shape.guides} rows={shape.rows} />
      <g className="summits">
        {shape.summits.map(({ p, x, y }) => {
          const on = p.projectId === selectedId,
            cx = x.toFixed(1),
            cy = y.toFixed(1);
          return (
            <g
              key={p.projectId}
              className={"summit" + (on ? " on" : "")}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={"Inspect " + p.projectName}
              data-tip-t={p.projectName}
              data-tip={`Physical lines: ${number(p.physicalLines)} · Code lines: ${number(p.codeLines)} · Files: ${number(p.fileCount)}`}
              onClick={() => onPick(p.projectId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(p.projectId);
                }
              }}
            >
              <circle cx={cx} cy={cy} r={11} fill="transparent" />
              <circle className="sm-halo" cx={cx} cy={cy} r={7} />
              <circle className="sm-dot" cx={cx} cy={cy} r={2.9} />
              <g className="sm-label">
                <path d={`M${cx} ${(y - 4).toFixed(1)}v-14h16`} />
                <text x={(x + 19).toFixed(1)} y={(y - 16).toFixed(1)}>
                  {p.projectName.toUpperCase()}
                </text>
              </g>
            </g>
          );
        })}
        {picked && (
          <g className="summit on" aria-hidden="true" pointerEvents="none">
            <g className="sm-label">
              <path d={`M${picked.x.toFixed(1)} ${(picked.y - 4).toFixed(1)}v-14h16`} />
              <text x={(picked.x + 19).toFixed(1)} y={(picked.y - 16).toFixed(1)}>
                {picked.p.projectName.toUpperCase()}
              </text>
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}

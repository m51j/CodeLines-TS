/** A 10 × 10 waffle split by share (largest remainder); cells pop in one by one. */
import { percent } from "../ui/fmt";

export function Waffle({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  const raw = parts.map((p) => (p.value / total) * 100),
    base = raw.map(Math.floor);
  let left = 100 - base.reduce((n, x) => n + x, 0);
  raw
    .map((r, i) => [r - Math.floor(r), i] as const)
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => {
      if (left > 0 && parts[i].value > 0) {
        base[i]++;
        left--;
      }
    });
  const cells = parts.flatMap((p, i) => Array.from({ length: base[i] }, () => p));
  return (
    <div className="waffle" role="img" aria-label={parts.map((p) => `${p.label} ${percent(p.value / total)}`).join(", ")}>
      {cells.map((p, i) => (
        <i
          key={i + p.label}
          title={p.label}
          style={{ ["--c" as string]: p.color, ["--d" as string]: (i % 10) * 18 + Math.floor(i / 10) * 22 + "ms" }}
        />
      ))}
    </div>
  );
}

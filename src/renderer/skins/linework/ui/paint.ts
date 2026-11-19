/**
 * Runs once the current state has been painted (two frames), so a CSS transition can start
 * from it. A window that is not painting falls back to a short timer, so nothing stays empty.
 */
export function afterPaint(cb: () => void) {
  let done = false,
    b = 0;
  const run = () => {
    if (done) return;
    done = true;
    cb();
  };
  const a = requestAnimationFrame(() => (b = requestAnimationFrame(run)));
  const t = setTimeout(run, 80);
  return () => {
    done = true;
    cancelAnimationFrame(a);
    cancelAnimationFrame(b);
    clearTimeout(t);
  };
}

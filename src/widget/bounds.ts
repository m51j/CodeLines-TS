export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const widgetSize = { width: 340, height: 210 },
  widgetMinimum = { width: 300, height: 140 };
/**
 * Keeps a saved position only while enough of the widget lands on a display,
 * e.g. not after a monitor is unplugged; otherwise uses the primary display's
 * bottom-right corner.
 */
export function fitBounds(
  saved: Partial<Rect>,
  workAreas: Rect[],
  primary: Rect,
): Rect {
  const width = Math.max(widgetMinimum.width, saved.width ?? widgetSize.width),
    height = Math.max(widgetMinimum.height, saved.height ?? widgetSize.height),
    { x, y } = saved;
  if (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    workAreas.some(
      (a) =>
        x! < a.x + a.width - 40 &&
        x! + width > a.x + 40 &&
        y! > a.y - 20 &&
        y! < a.y + a.height - 40,
    )
  )
    return { x: x!, y: y!, width, height };
  return {
    x: primary.x + primary.width - width - 24,
    y: primary.y + primary.height - height - 24,
    width,
    height,
  };
}

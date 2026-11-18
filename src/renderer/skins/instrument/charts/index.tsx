/**
 * React wrappers around the hand-written SVG chart engines. Each engine is created once per mount
 * and fed new data afterwards, so marks keep their identity and morph between states.
 */
import { useLayoutEffect, useRef } from "react";
import { createStackChart, type SeriesKey, type StackDatum, type StackOptions } from "./StackChart";
import {
  createHeat,
  createLineChart,
  createShareBar,
  createTreemap,
  type HeatCell,
  type LinePoint,
  type ShareItem,
  type TreeItem,
} from "./engines";
export type { SeriesKey, StackDatum, HeatCell, LinePoint, ShareItem, TreeItem };
interface Engine {
  el: HTMLElement;
  destroy(): void;
}
function useEngine<E extends Engine>(create: () => E) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<E | null>(null),
    factory = useRef(create);
  // Created in the first layout effect; the data effects of the same commit run after it.
  useLayoutEffect(() => {
    const e = (engine.current = factory.current());
    host.current?.appendChild(e.el);
    return () => {
      e.destroy();
      e.el.remove();
      engine.current = null;
    };
  }, []);
  return { host, engine };
}
const hostStyle = { display: "contents" } as const;
export function StackChart(props: Omit<StackOptions, "onBrush"> & { keys: SeriesKey[]; data: StackDatum[]; onBrush?: (from: string, to: string) => void }) {
  const latest = useRef(props);
  latest.current = props;
  const { host, engine } = useEngine(() =>
    createStackChart({
      label: props.label,
      height: props.height,
      tickWidth: props.tickWidth,
      pos: props.pos,
      xLabel: (n) => latest.current.xLabel?.(n) ?? n,
      title: (d) => latest.current.title?.(d) ?? d.name,
      onBrush: props.onBrush ? (a, b) => latest.current.onBrush?.(a, b) : undefined,
    }),
  );
  useLayoutEffect(() => {
    engine.current?.update({ keys: props.keys, data: props.data });
  }, [engine, props.keys, props.data]);
  return <div ref={host} style={hostStyle} />;
}
export function Heatmap({ label, calendar, onPick, cells }: { label: string; calendar?: boolean; onPick?: (key: string) => void; cells: HeatCell[] }) {
  const pick = useRef(onPick);
  pick.current = onPick;
  const { host, engine } = useEngine(() => createHeat({ label, calendar, onPick: onPick ? (k) => pick.current?.(k) : undefined }));
  useLayoutEffect(() => {
    engine.current?.update(cells);
  }, [engine, cells]);
  return <div ref={host} style={hostStyle} />;
}
export function ShareBar({ label, className, items }: { label: string; className?: string; items: ShareItem[] }) {
  const { host, engine } = useEngine(() => createShareBar({ label, className }));
  useLayoutEffect(() => {
    engine.current?.update(items);
  }, [engine, items]);
  return <div ref={host} style={hostStyle} />;
}
export function Treemap({ label, items, selected, onPick }: { label: string; items: TreeItem[]; selected: string | null; onPick: (key: string) => void }) {
  const pick = useRef(onPick);
  pick.current = onPick;
  const { host, engine } = useEngine(() => createTreemap({ label, onPick: (k) => pick.current(k) }));
  useLayoutEffect(() => {
    engine.current?.update(items, selected);
    // A new selection alone only restyles the tiles (below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, items]);
  useLayoutEffect(() => {
    engine.current?.select(selected);
  }, [engine, selected]);
  return <div ref={host} style={hostStyle} />;
}
export function LineChart({
  label,
  height,
  points,
  color,
  format,
  picked,
  onPick,
}: {
  label: string;
  height?: number;
  points: LinePoint[];
  color: string;
  format?: (v: number) => string;
  picked: string | null;
  onPick?: (name: string) => void;
}) {
  const pick = useRef(onPick);
  pick.current = onPick;
  const { host, engine } = useEngine(() => createLineChart({ label, height, onPick: (n) => pick.current?.(n) }));
  useLayoutEffect(() => {
    engine.current?.update({ points, color, format });
    // The number format is a presentation detail; new points or a new colour redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, points, color]);
  useLayoutEffect(() => {
    engine.current?.pick(picked);
  }, [engine, picked, points]);
  return <div ref={host} style={hostStyle} />;
}

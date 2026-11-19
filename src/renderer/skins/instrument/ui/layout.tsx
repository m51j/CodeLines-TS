/** Page building blocks ported from the prototype's ui.js: panels, readout tiles, empty states, notices, split views. */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { clamp, enter, play, stagger, useCount } from "../../../motion/core";
import { number } from "../../../format";
import { Art, Icon, type ArtName, type IconName } from "../icons";
import { Seg } from "./controls";
import { Spark } from "../charts/Spark";
const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
/** A numbered plate: title, subtitle, tools on the right, body. */
export function Panel({
  title,
  subtitle,
  tools,
  className,
  label,
  children,
  id,
  role,
  labelledBy,
  bodyClass,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  tools?: ReactNode;
  className?: string;
  label?: string;
  children?: ReactNode;
  id?: string;
  role?: string;
  labelledBy?: string;
  bodyClass?: string;
}) {
  return (
    <section
      className={cx("panel", className)}
      aria-label={labelledBy ? undefined : (label ?? (typeof title === "string" ? title : undefined))}
      aria-labelledby={labelledBy}
      id={id}
      role={role}
    >
      {(title || tools) && (
        <header className="panel-head">
          <div className="panel-titles">
            <h2>{title}</h2>
            {subtitle && <p className="panel-sub">{subtitle}</p>}
          </div>
          {tools && <div className="panel-tools">{tools}</div>}
        </header>
      )}
      <div className={cx("panel-body", bodyClass)}>{children}</div>
    </section>
  );
}
export type Tone = "accent" | "success" | "danger";
export interface TileItem {
  label: string;
  /** Numeric readouts count from what they showed before; `text` readouts cross-rise. */
  value?: number | null;
  fmt?: (v: number) => string;
  text?: string;
  detail?: ReactNode;
  tone?: Tone;
  title?: string;
  icon?: IconName;
  spark?: number[];
  meter?: [number, number];
  onClick?: () => void;
  tip?: string | null;
  hero?: boolean;
}
function NumberValue({ value, fmt, memo, delay, title }: { value: number | null | undefined; fmt: (v: number) => string; memo: string; delay: number; title?: string }) {
  const ref = useCount<HTMLElement>(value, fmt, { key: memo, delay, firstDur: 760, dur: 520 });
  return <strong className="tile-value" ref={ref} title={title} />;
}
function TextValue({ text, title }: { text: string; title?: string }) {
  const ref = useRef<HTMLElement>(null),
    last = useRef(text);
  useLayoutEffect(() => {
    if (last.current === text) return;
    last.current = text;
    play(ref.current, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 260 });
  }, [text]);
  return (
    <strong ref={ref} className={cx("tile-value", text.length > 9 && "is-text")} title={title}>
      {text}
    </strong>
  );
}
export function Tile({ it, memo, index }: { it: TileItem; memo: string; index: number }) {
  const content = (
    <>
      <span className="tile-label">
        <i className="lamp" aria-hidden="true" />
        <span className="tile-label-text">{it.label}</span>
      </span>
      {it.text !== undefined ? (
        <TextValue text={it.text} title={it.title} />
      ) : (
        <NumberValue value={it.value} fmt={it.fmt ?? number} memo={memo} delay={80 + index * 45} title={it.title} />
      )}
      {it.detail !== undefined && it.detail !== "" && <small className="tile-detail">{it.detail}</small>}
      <span className="tile-aside">
        {it.spark && it.spark.length > 1 ? (
          <Spark values={it.spark} w={62} h={30} />
        ) : it.meter ? (
          <span className="tile-meter">
            {Array.from({ length: Math.min(28, it.meter[1]) }, (_, k) => (
              <i key={k} className={k < it.meter![0] ? "on" : ""} />
            ))}
          </span>
        ) : it.icon ? (
          <Icon name={it.icon} size={18} />
        ) : null}
      </span>
      {it.onClick && (
        <span className="tile-go" aria-hidden="true">
          <Icon name="arrow" size={14} />
        </span>
      )}
    </>
  );
  const cls = cx("tile", it.tone && "tone-" + it.tone, it.hero && "tile-hero", it.onClick && "is-link");
  return it.onClick ? (
    <button type="button" className={cls} data-tip={it.tip ?? undefined} onClick={it.onClick}>
      {content}
    </button>
  ) : (
    <div className={cls} data-tip={it.tip ?? undefined}>
      {content}
    </div>
  );
}
/** Readout tiles. Values count from what the same tile showed last time, even across page visits. */
export function Tiles({ items, id, className, quiet }: { items: TileItem[]; id: string; className?: string; quiet?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!quiet && ref.current) stagger(ref.current.children, { y: 12, step: 42, dur: 380 });
    // Only the first appearance staggers in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className={cx("tiles", className)}>
      {items.map((it, i) => (
        <Tile key={i + ":" + (it.text !== undefined ? "t" : "n")} it={it} memo={id + ":" + i} index={i} />
      ))}
    </div>
  );
}
export function Empty({
  art = "codebase",
  title,
  text,
  action,
  className,
}: {
  art?: ArtName;
  title: string;
  text: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("empty", className)}>
      <div className="empty-art" aria-hidden="true">
        <Art name={art} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Notice({ kind = "warn", children, extra }: { kind?: "warn" | "info"; children: ReactNode; extra?: ReactNode }) {
  return (
    <p className={"notice is-" + kind}>
      <Icon name={kind === "info" ? "info" : "alert"} size={15} />
      <span>{children}</span>
      {extra}
    </p>
  );
}
/** Split positions are remembered for the session (per split). */
const splits = new Map<string, number>();
/** Two panes with a draggable, keyboard-operable divider. Stacks when the container is narrow. */
export function Split({
  left,
  right,
  id,
  initial = 0.6,
  label = "Resize panels",
}: {
  left: ReactNode;
  right: ReactNode;
  id: string;
  initial?: number;
  label?: string;
}) {
  const [ratio, setRatioState] = useState(() => splits.get(id) ?? initial),
    [dragging, setDragging] = useState(false),
    root = useRef<HTMLDivElement>(null);
  const setRatio = (r: number) => {
    const v = clamp(r, 0.28, 0.78);
    splits.set(id, v);
    setRatioState(v);
  };
  return (
    <div ref={root} className={cx("split", dragging && "is-dragging")} style={{ "--split": ratio } as CSSProperties}>
      <div className="split-a">{left}</div>
      <div
        className="split-handle"
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={28}
        aria-valuemax={78}
        data-tip="Drag to resize · double-click to reset"
        onPointerDown={(e) => {
          e.preventDefault();
          const handle = e.currentTarget,
            r = root.current?.getBoundingClientRect();
          if (!r) return;
          handle.setPointerCapture(e.pointerId);
          setDragging(true);
          const move = (ev: PointerEvent) => setRatio((ev.clientX - r.left) / r.width);
          const up = () => {
            setDragging(false);
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", up);
            handle.removeEventListener("pointercancel", up);
          };
          handle.addEventListener("pointermove", move);
          handle.addEventListener("pointerup", up);
          handle.addEventListener("pointercancel", up);
        }}
        onKeyDown={(e) => {
          const d = e.key === "ArrowLeft" ? -0.03 : e.key === "ArrowRight" ? 0.03 : 0;
          if (!d) return;
          e.preventDefault();
          setRatio(ratio + d);
        }}
        onDoubleClick={() => setRatio(initial)}
      >
        <i />
      </div>
      <div className="split-b">{right}</div>
    </div>
  );
}
/** Chart ⇄ table switch used in panel tools. */
export function ViewSwitch({ value, onChange, label }: { value: "chart" | "table"; onChange: (v: "chart" | "table") => void; label: string }) {
  return (
    <Seg
      label={label}
      role="radiogroup"
      className="seg-sm"
      value={value}
      onChange={onChange}
      options={[
        { value: "chart", icon: "chart", aria: "Chart", tip: "Chart" },
        { value: "table", icon: "table", aria: "Table", tip: "Data table" },
      ]}
    />
  );
}
/**
 * Content that arrives from the side it was moved toward. Remount it (a new `key`) to play
 * the entrance again; the first mount is still when `skipFirst`.
 */
export function SwapIn({
  dir = 1,
  distance = 14,
  dur = 260,
  y = 0,
  className,
  children,
  skip,
  ...rest
}: {
  dir?: number;
  distance?: number;
  dur?: number;
  y?: number;
  className?: string;
  children: ReactNode;
  skip?: boolean;
  id?: string;
  role?: string;
  "aria-labelledby"?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!skip) enter(ref.current, { x: dir * distance, y, dur });
    // Plays once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>
  );
}
/** Runs a callback after two frames, so a freshly mounted element can transition from its start state. */
export function useAfterPaint(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => (b = requestAnimationFrame(() => setReady(true))));
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);
  return ready;
}

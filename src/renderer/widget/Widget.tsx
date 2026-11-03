import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import type {
  WidgetData,
  WidgetRange,
  WidgetTab,
  WidgetView,
} from "../../shared/contracts";
import { compact, number } from "../format";
import { FillBar, Ticker, popStyle, replay } from "../motion";
const tabs: { id: WidgetTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "projects", label: "Projects" },
  { id: "total", label: "Total" },
];
const ranges: { id: WidgetRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "d30", label: "30d" },
  { id: "all", label: "All" },
];
const rangeWords: Record<WidgetRange, string> = {
  today: "today",
  d30: "30 days",
  all: "all time",
};
const emptyProjects: Record<WidgetRange, string> = {
  today: "No AI activity today yet.",
  d30: "No AI activity in the last 30 days.",
  all: "No AI activity recorded yet.",
};
export const minutesText = (m: number) => {
  const total = Math.round(m),
    h = Math.floor(total / 60);
  return h ? `${h}h ${String(total % 60).padStart(2, "0")}m` : `${total}m`;
};
const days = (n: number) => `${number(n)} ${n === 1 ? "day" : "days"}`;
const shortDate = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      date.slice(0, 4) === String(new Date().getFullYear())
        ? undefined
        : "numeric",
    timeZone: "UTC",
  });
/**
 * The height sets the cell size and the width how many weeks fit (about 16 at
 * the default size), as in claude-code-stats-widget.
 */
export function fitGrid(width: number, height: number) {
  const w = width - 4,
    h = height - 4,
    gap = Math.max(2, Math.round(Math.max(6, h / 8.5) / 4));
  let cell = Math.max(4, (h - 6 * gap) / 7);
  const weeks = Math.max(4, Math.min(53, Math.floor((w + gap) / (cell + gap))));
  cell = Math.max(4, Math.min(cell, (w - (weeks - 1) * gap) / weeks));
  return { weeks, cell, gap };
}
const addDays = (date: string, n: number) =>
  new Date(Date.parse(date + "T00:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
/** Quartile levels over the visible non-zero values, like the original panel. */
function levels(values: number[]) {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!nz.length) return () => 0;
  const q = (p: number) =>
      nz[Math.min(nz.length - 1, Math.floor(p * nz.length))],
    t1 = q(0.25),
    t2 = q(0.5),
    t3 = q(0.8);
  return (v: number) =>
    v <= 0 ? 0 : v <= t1 ? 1 : v <= t2 ? 2 : v <= t3 ? 3 : 4;
}
function Heat({ data, range }: { data: WidgetData; range: WidgetRange }) {
  const box = useRef<HTMLDivElement>(null),
    [fit, setFit] = useState({ weeks: 16, cell: 10, gap: 3 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () =>
      setFit(
        el.clientWidth && el.clientHeight
          ? fitGrid(el.clientWidth, el.clientHeight)
          : { weeks: 16, cell: 10, gap: 3 },
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const byDate = new Map(data.days.map((d) => [d.date, d])),
    end = addDays(
      data.today,
      6 - new Date(data.today + "T00:00:00Z").getUTCDay(),
    ),
    start = addDays(end, -(fit.weeks * 7 - 1)),
    cut = addDays(data.today, -30),
    cells = Array.from({ length: fit.weeks * 7 }, (_, i) => addDays(start, i)),
    level = levels(cells.map((d) => byDate.get(d)?.tokens ?? 0));
  return (
    <div className="w-heatbox" ref={box}>
      <div
        className="w-heat"
        role="img"
        aria-label={`AI activity for the last ${fit.weeks} weeks`}
        style={{
          gridTemplateRows: `repeat(7, ${fit.cell}px)`,
          gridAutoColumns: `${fit.cell}px`,
          gap: fit.gap,
        }}
      >
        {cells.map((date, i) => {
          const d = byDate.get(date),
            future = date > data.today,
            out = range === "d30" && date <= cut;
          return (
            // Keyed by date: a new range or refresh recolors cells instead of replaying the wave.
            <span
              key={date}
              className={
                "w-cell heat-pop l" +
                (future ? 0 : level(d?.tokens ?? 0)) +
                (future ? " future" : "") +
                (out ? " out" : "") +
                (date === data.today ? " today" : "")
              }
              style={popStyle(Math.floor(i / 7), i % 7, fit.weeks)}
              title={
                future
                  ? undefined
                  : `${shortDate(date)} · ${d ? `${compact(d.tokens)} tokens · ${minutesText(d.minutes)} active` : "No activity"}`
              }
            />
          );
        })}
      </div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-stat">
      <span>{label}</span>
      <Ticker value={value} />
    </div>
  );
}
export function WidgetPanel({
  data,
  view,
  onView,
}: {
  data: WidgetData;
  view: WidgetView;
  onView: (view: WidgetView) => void;
}) {
  const pane = useRef<HTMLDivElement>(null),
    r = data.ranges[view.range],
    all = data.ranges.all;
  useLayoutEffect(() => replay(pane.current, "pane-in"), [view.tab]);
  const projects = data.projects[view.range],
    share = projects.reduce((n, p) => n + p.minutes, 0),
    shareTokens = projects.reduce((n, p) => n + p.tokens, 0);
  return (
    <>
      <div className="w-bar">
        <div className="w-seg" role="tablist" aria-label="Widget views">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={view.tab === t.id}
              onClick={() => onView({ ...view, tab: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
        {view.tab !== "total" && (
          <div className="w-seg" role="group" aria-label="Widget period">
            {ranges.map((x) => (
              <button
                key={x.id}
                aria-pressed={view.range === x.id}
                onClick={() => onView({ ...view, range: x.id })}
              >
                {x.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="w-pane" ref={pane}>
        {!data.aiEnabled && view.tab !== "total" ? (
          <p className="w-empty">
            AI usage is off. Turn it on in CodeLines settings.
          </p>
        ) : view.tab === "overview" ? (
          <>
            <div className="w-stats">
              <Stat
                label={`Tokens ${rangeWords[view.range]}`}
                value={compact(r.tokens)}
              />
              <Stat label="Streak" value={days(data.streak.current)} />
              <Stat
                label={`Active ${rangeWords[view.range]}`}
                value={minutesText(r.minutes)}
              />
            </div>
            <Heat data={data} range={view.range} />
          </>
        ) : view.tab === "projects" ? (
          <div className="w-list">
            {projects.length ? (
              projects.map((p) => (
                <div className="w-project" key={p.name}>
                  <div>
                    <b title={p.name}>{p.name}</b>
                    <span>
                      {minutesText(p.minutes)} · {compact(p.tokens)} tokens
                    </span>
                  </div>
                  <FillBar
                    percent={
                      share
                        ? (p.minutes / share) * 100
                        : (p.tokens / (shareTokens || 1)) * 100
                    }
                  />
                </div>
              ))
            ) : (
              <p className="w-empty">{emptyProjects[view.range]}</p>
            )}
          </div>
        ) : (
          <>
            <div className="w-big">
              <span>
                {data.total.firstDay
                  ? `Tokens since ${shortDate(data.total.firstDay)}`
                  : "Total tokens"}
              </span>
              <Ticker className="w-big-value" value={compact(all.tokens)} />
              <span>
                {data.total.record
                  ? `${days(data.total.activeDays)} active · record ${compact(data.total.record.tokens)} on ${shortDate(data.total.record.date)}`
                  : `${number(all.tokens)} tokens`}
              </span>
            </div>
            <div className="w-stats">
              <Stat label="Active time" value={minutesText(all.minutes)} />
              <Stat label="Best streak" value={days(data.streak.best)} />
              <Stat
                label="Code lines"
                value={data.code ? compact(data.code.codeLines) : "—"}
              />
            </div>
            <p className="w-foot">
              {data.code
                ? `${number(data.code.files)} files in ${number(data.code.projects)} projects` +
                  (data.code.codeLinesDelta
                    ? ` · ${data.code.codeLinesDelta > 0 ? "+" : ""}${number(data.code.codeLinesDelta)} lines since the last scan day`
                    : "")
                : "Scan your projects in CodeLines to add code totals."}
            </p>
          </>
        )}
      </div>
    </>
  );
}
export function WidgetApp() {
  const api = window.codelinesWidget,
    box = useRef<HTMLDivElement>(null),
    [data, setData] = useState<WidgetData | null>(null),
    [view, setView] = useState<WidgetView>({ tab: "overview", range: "today" });
  useEffect(() => {
    if (!api) return;
    void api.load().then(({ data, view }) => {
      setData(data);
      setView(view);
    });
    return api.onData(setData);
  }, [api]);
  useEffect(() => {
    if (data)
      document.documentElement.dataset.theme = data.dark ? "dark" : "light";
  }, [data]);
  const changeView = useCallback(
    (next: WidgetView) => {
      setView(next);
      void api?.setView(next);
    },
    [api],
  );
  // Dragging moves the window, the corner resizes it and a press without movement opens CodeLines.
  const press = async (e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!api || e.button !== 0 || target.closest("button")) return;
    const list = target.closest(".w-list");
    if (list && e.nativeEvent.offsetX >= list.clientWidth) return; // scrollbar
    const resize = !!target.closest(".w-grip"),
      el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    void api.move(resize ? "resize" : "drag");
    await new Promise((done) =>
      el.addEventListener("lostpointercapture", done, { once: true }),
    );
    const moved = await api.move("stop");
    if (!moved && !resize) void api.openApp();
  };
  return (
    <div
      className="w-box"
      ref={box}
      onPointerDown={(e) => void press(e)}
      onContextMenu={(e) => {
        e.preventDefault();
        void api?.menu();
      }}
    >
      {data ? (
        <WidgetPanel data={data} view={view} onView={changeView} />
      ) : (
        <p className="w-empty">Loading…</p>
      )}
      <svg className="w-grip" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M13 6 6 13M13 10l-3 3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

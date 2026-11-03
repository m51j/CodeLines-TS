import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  AiResult,
  DailyLog,
  Project,
  WidgetData,
} from "../src/shared/contracts";
import {
  activeMinutes,
  aggregateAgents,
  type AgentSource,
} from "../src/ai/aggregate";
import { record } from "../src/ai/model";
import { recordAi } from "../src/domain/daily";
import { defaults } from "../src/domain/defaults";
import { parseSettings } from "../src/services/persistence";
import { widgetSummary, shiftDay } from "../src/widget/summary";
import { fitBounds } from "../src/widget/bounds";
import {
  WidgetPanel,
  fitGrid,
  minutesText,
} from "../src/renderer/widget/Widget";
const minute = 60000,
  now = Date.parse("2026-11-03T12:00:00Z"),
  today = "2026-11-03",
  alpha: Project = {
    id: randomUUID(),
    name: "Alpha",
    rootPath: "D:\\Work\\alpha",
    isEnabled: true,
    excludePatterns: [],
  };
const at = (iso: string, extra: Partial<Parameters<typeof record>[0]> = {}) =>
  record({
    ts: Date.parse(iso),
    model: "m",
    input: 100,
    output: 50,
    session: "s1",
    cwd: "D:\\Work\\alpha\\src",
    ...extra,
  });
const amount = (tokens: number) => ({
  input: tokens,
  cacheWrite: 0,
  cacheRead: 0,
  output: 0,
  requests: 1,
  cost: 0,
  costPartial: false,
  tokens,
});
function result(sources: AgentSource[]): AiResult {
  return {
    generatedAt: new Date(now).toISOString(),
    combined: aggregateAgents(sources, "All agents", true),
    claude: null,
    agents: [],
    activity: activeMinutes(sources, true),
  };
}
describe("active minutes", () => {
  it("sums session gaps up to five minutes, in any record order, once per request", () => {
    const a = activeMinutes(
      [
        {
          id: "claude",
          label: "Claude Code",
          records: [
            at("2026-11-03T10:11:00Z"),
            at("2026-11-03T10:00:00Z"),
            at("2026-11-03T10:02:00Z", { request: "r1" }),
            at("2026-11-03T10:04:00Z", { request: "r1" }),
            // An eight-minute break does not count.
            at("2026-11-03T10:10:00Z"),
          ],
        },
      ],
      true,
    );
    expect(a.byDay).toEqual({ [today]: 3 });
    expect(a.bySession).toEqual({ "claude::s1": 3 });
  });
  it("gives a gap to the day of its later record", () => {
    const a = activeMinutes(
      [
        {
          id: "codex",
          label: "Codex",
          records: [
            at("2026-11-02T23:58:00Z", { session: "" }),
            at("2026-11-03T00:01:00Z", { session: "" }),
          ],
        },
      ],
      true,
    );
    expect(a.byDay).toEqual({ [today]: 3 });
    expect(a.bySession).toEqual({ "codex::unknown": 3 });
  });
  it("keeps recorded active minutes when agents delete their logs", () => {
    const log: DailyLog = { version: 1, days: [] },
      day = "2026-10-01",
      payload = (n: number) =>
        aggregateAgents(
          [
            {
              id: "claude",
              label: "Claude Code",
              records: Array.from({ length: n }, (_, i) =>
                at(
                  new Date(
                    Date.parse(day + "T09:00:00Z") + i * minute,
                  ).toISOString(),
                ),
              ),
            },
          ],
          "All agents",
          true,
        );
    recordAi(log, payload(11), [], undefined, {
      byDay: { [day]: 10 },
      bySession: {},
    });
    expect(log.days[0].ai?.minutes).toBe(10);
    recordAi(log, payload(11), [], undefined, {
      byDay: { [day]: 4 },
      bySession: {},
    });
    expect(log.days[0].ai?.minutes).toBe(10);
  });
});
describe("widget settings", () => {
  it("loads settings saved before the widget existed", () => {
    const s = parseSettings({ ...defaults(), widget: undefined });
    expect(s.widget).toEqual(defaults().widget);
    expect(parseSettings({ widget: { enabled: true } }).widget).toMatchObject({
      enabled: true,
      refreshMinutes: 5,
    });
    expect(() => parseSettings({ widget: { refreshMinutes: 0 } })).toThrow();
  });
});
describe("widget summary", () => {
  const settings = { ...defaults(), projects: [alpha] },
    ai = result([
      {
        id: "claude",
        label: "Claude Code",
        records: [
          at("2026-11-03T10:00:00Z"),
          at("2026-11-03T10:04:00Z"),
          at("2026-11-02T10:00:00Z", { session: "s2" }),
          at("2026-11-02T10:02:00Z", { session: "s2" }),
          at("2026-10-20T10:00:00Z", {
            session: "s3",
            cwd: "C:\\Other\\beta",
          }),
        ],
      },
    ]),
    // A day the agents have since deleted, kept only by the daily log.
    daily: DailyLog = {
      version: 1,
      days: [
        {
          date: "2026-08-01",
          lines: [],
          ai: {
            updatedAt: "2026-08-01T20:00:00Z",
            tz: "utc",
            total: amount(9000),
            byAgent: {},
            projects: [],
            minutes: 20,
          },
        },
      ],
    };
  const data = widgetSummary({ ai, daily, settings }, now, true);
  it("totals each period from the report and the daily log", () => {
    expect(data.today).toBe(today);
    expect(data.ranges.today).toMatchObject({
      tokens: 300,
      minutes: 4,
      sessions: 1,
    });
    expect(data.ranges.d30).toMatchObject({
      tokens: 750,
      minutes: 6,
      sessions: 3,
    });
    expect(data.ranges.all).toMatchObject({ tokens: 9750, minutes: 26 });
    expect(data.total).toEqual({
      firstDay: "2026-08-01",
      activeDays: 4,
      record: { date: "2026-08-01", tokens: 9000 },
    });
    expect(data.days.map((d) => d.date)).toEqual([
      "2026-08-01",
      "2026-10-20",
      "2026-11-02",
      today,
    ]);
    expect(data.dark).toBe(true);
    expect(data.code).toBeNull();
  });
  it("counts streaks that end today or yesterday", () => {
    expect(data.streak).toEqual({ current: 2, best: 2 });
    const later = widgetSummary({ ai, daily, settings }, now + 86400000).streak;
    expect(later.current).toBe(2);
    expect(
      widgetSummary({ ai, daily, settings }, now + 2 * 86400000).streak.current,
    ).toBe(0);
  });
  it("names sessions after registered projects, then their folders", () => {
    expect(data.projects.d30).toEqual([
      { name: "Alpha", minutes: 6, tokens: 600, sessions: 2 },
      { name: "beta", minutes: 0, tokens: 150, sessions: 1 },
    ]);
    expect(data.projects.today.map((p) => p.name)).toEqual(["Alpha"]);
  });
  it("works before any AI report or scan", () => {
    const empty = widgetSummary(
      { ai: null, daily: { version: 1, days: [] }, settings: defaults() },
      now,
    );
    expect(empty.ranges.all).toEqual({
      tokens: 0,
      minutes: 0,
      requests: 0,
      sessions: 0,
    });
    expect(empty.streak).toEqual({ current: 0, best: 0 });
    expect(empty.total.firstDay).toBeNull();
  });
  it("renders every tab", () => {
    const html = (tab: "overview" | "projects" | "total") =>
      renderToStaticMarkup(
        createElement(WidgetPanel, {
          data,
          view: { tab, range: "d30" },
          onView: () => {},
        }),
      );
    const overview = html("overview");
    expect(overview).toContain("Tokens 30 days");
    expect(overview).toContain("2 days");
    expect(overview.match(/class="w-cell/g)).toHaveLength(16 * 7);
    expect(html("projects")).toContain("Alpha");
    const total = html("total");
    expect(total).toContain("Tokens since Aug 1");
    expect(total).toContain("Scan your projects");
    const off: WidgetData = { ...data, aiEnabled: false };
    expect(
      renderToStaticMarkup(
        createElement(WidgetPanel, {
          data: off,
          view: { tab: "overview", range: "today" },
          onView: () => {},
        }),
      ),
    ).toContain("AI usage is off");
  });
});
describe("widget layout", () => {
  const primary = { x: 0, y: 0, width: 1920, height: 1040 };
  it("keeps a saved position only while it is on a display", () => {
    expect(
      fitBounds(
        { x: 100, y: 100, width: 400, height: 250 },
        [primary],
        primary,
      ),
    ).toEqual({
      x: 100,
      y: 100,
      width: 400,
      height: 250,
    });
    // Saved on a monitor that is no longer connected.
    expect(fitBounds({ x: 2500, y: 100 }, [primary], primary)).toEqual({
      x: 1920 - 340 - 24,
      y: 1040 - 210 - 24,
      width: 340,
      height: 210,
    });
    expect(
      fitBounds({ width: 10, height: 10 }, [primary], primary),
    ).toMatchObject({
      width: 300,
      height: 140,
    });
  });
  it("fits whole weeks of square cells into the heatmap area", () => {
    for (const [w, h] of [
      [312, 110],
      [600, 300],
      [280, 40],
    ]) {
      const g = fitGrid(w, h);
      expect(g.weeks).toBeGreaterThanOrEqual(4);
      expect(g.weeks).toBeLessThanOrEqual(53);
      expect(g.weeks * g.cell + (g.weeks - 1) * g.gap).toBeLessThanOrEqual(
        w - 4 + 1e-9,
      );
    }
    expect(fitGrid(312, 110).weeks).toBeGreaterThan(10);
  });
  it("formats durations and dates", () => {
    expect(minutesText(4)).toBe("4m");
    expect(minutesText(125.4)).toBe("2h 05m");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
});

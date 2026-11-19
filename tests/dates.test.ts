import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  formatRange,
  isDay,
  monthGrid,
  PRESETS,
  rangeLabel,
  resolvePreset,
  resolveRange,
  shiftMonths,
  todayIn,
  weekday,
} from "../src/renderer/ui/dates";

describe("calendar days", () => {
  it("accepts only real YYYY-MM-DD days", () => {
    expect(isDay("2026-02-28")).toBe(true);
    expect(isDay("2024-02-29")).toBe(true);
    expect(isDay("2026-02-29")).toBe(false);
    expect(isDay("2026-13-01")).toBe(false);
    expect(isDay("2026-1-01")).toBe(false);
    expect(isDay("")).toBe(false);
  });
  it("adds days and months across boundaries", () => {
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(shiftMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftMonths("2024-03-31", -1)).toBe("2024-02-29");
  });
  it("lays a month out as six weeks starting on Sunday", () => {
    const grid = monthGrid("2026-11");
    expect(grid).toHaveLength(42);
    expect(weekday(grid[0])).toBe(0);
    expect(grid[0]).toBe("2026-11-01"); // 1 Nov 2026 is a Sunday
    expect(monthGrid("2026-10")[0]).toBe("2026-09-27");
    expect(grid).toContain("2026-11-30");
  });
  it("reads today in UTC or local time", () => {
    const now = Date.UTC(2026, 10, 19, 12);
    expect(todayIn(true, now)).toBe("2026-11-19");
    const local = new Date(now);
    expect(todayIn(false, now)).toBe(
      `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`,
    );
  });
});

describe("presets", () => {
  const today = "2026-03-15";
  it("resolves every preset against today", () => {
    expect(resolvePreset("today", today)).toEqual({ since: today, until: today });
    expect(resolvePreset("yesterday", today)).toEqual({ since: "2026-03-14", until: "2026-03-14" });
    expect(resolvePreset("last7", today)).toEqual({ since: "2026-03-09", until: today });
    expect(resolvePreset("last30", today)).toEqual({ since: "2026-02-14", until: today });
    expect(resolvePreset("last90", today)).toEqual({ since: "2025-12-16", until: today });
    expect(resolvePreset("thisMonth", today)).toEqual({ since: "2026-03-01", until: today });
    expect(resolvePreset("lastMonth", today)).toEqual({ since: "2026-02-01", until: "2026-02-28" });
    expect(resolvePreset("thisYear", today)).toEqual({ since: "2026-01-01", until: today });
    expect(resolvePreset("all", today)).toEqual({ since: "", until: "" });
  });
  it("handles month and year edges", () => {
    expect(resolvePreset("lastMonth", "2026-01-10")).toEqual({ since: "2025-12-01", until: "2025-12-31" });
    expect(resolvePreset("lastMonth", "2024-03-31")).toEqual({ since: "2024-02-01", until: "2024-02-29" });
    expect(resolvePreset("yesterday", "2026-01-01")).toEqual({ since: "2025-12-31", until: "2025-12-31" });
    expect(resolvePreset("thisMonth", "2026-05-01")).toEqual({ since: "2026-05-01", until: "2026-05-01" });
  });
  it("covers each preset in the list exactly once", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) expect(() => resolvePreset(p.id, today)).not.toThrow();
  });
  it("uses custom days only when no preset is set", () => {
    expect(resolveRange({ preset: "last7", since: "2020-01-01", until: "2020-01-02" }, today)).toEqual({ since: "2026-03-09", until: today });
    expect(resolveRange({ preset: "", since: "2020-01-01", until: "2020-01-02" }, today)).toEqual({ since: "2020-01-01", until: "2020-01-02" });
  });
});

describe("labels", () => {
  it("formats ranges compactly", () => {
    expect(formatRange("", "")).toBe("All time");
    expect(formatRange("2026-01-03", "2026-01-09")).toBe("Jan 3 – 9, 2026");
    expect(formatRange("2026-01-03", "2026-02-09")).toBe("Jan 3 – Feb 9, 2026");
    expect(formatRange("2025-12-28", "2026-01-03")).toBe("Dec 28, 2025 – Jan 3, 2026");
    expect(formatRange("2026-01-03", "2026-01-03")).toBe("Jan 3, 2026");
    expect(formatRange("2026-01-03", "")).toBe("From Jan 3, 2026");
    expect(formatRange("", "2026-01-03")).toBe("Until Jan 3, 2026");
  });
  it("names a preset or shows the custom days", () => {
    expect(rangeLabel({ preset: "last30", since: "", until: "" })).toBe("Last 30 days");
    expect(rangeLabel({ preset: "", since: "2026-01-03", until: "2026-01-09" })).toBe("Jan 3 – 9, 2026");
  });
});

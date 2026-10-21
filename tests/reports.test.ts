import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type {
  AiResult,
  AgentPayload,
  ClaudePayload,
} from "../src/shared/contracts";
import {
  reportModel,
  selectReport,
  calendarDays,
  claudeComparison,
  claudeCostRows,
} from "../src/reports/selectors";
import { payloadTotals, costText } from "../src/ai/aggregate";
import { tokens, vec } from "../src/ai/model";
import {
  reportHtml,
  safeJson,
  csvCell,
  analysisCsv,
  historyCsv,
  dailyCsv,
} from "../src/services/exports";
import { defaults } from "../src/domain/defaults";
import { projectMetrics, snapshot } from "../src/domain/metrics";
import { recordLines } from "../src/domain/daily";
import { gitTotals } from "../src/domain/history";
import { parseSettings, parseDaily } from "../src/services/persistence";
const combined = JSON.parse(
    await fs.readFile("tests/fixtures/agents-payload.golden.json", "utf8"),
  ) as AgentPayload,
  claude = JSON.parse(
    await fs.readFile("tests/fixtures/claude-payload.golden.json", "utf8"),
  ) as ClaudePayload;
const result: AiResult = {
  generatedAt: new Date().toISOString(),
  combined,
  claude,
  agents: [],
};
describe("shared report calculations and exports", () => {
  it("uses the golden totals for every range, grouping, model and time view", () => {
    const model = reportModel(result),
      all = selectReport(model, {
        range: 0,
        since: "",
        until: "",
        group: "agent",
      });
    expect(all.total).toEqual(payloadTotals(combined));
    expect(all.agents.reduce((n, a) => n + tokens(a.v), 0)).toBe(
      tokens(all.total),
    );
    expect(all.byHour.reduce((n, v) => n + tokens(v), 0)).toBe(
      tokens(all.total),
    );
    expect(all.weekday.flat().reduce((n, v) => n + tokens(v), 0)).toBe(
      tokens(all.total),
    );
    const filtered = selectReport(model, {
      range: 7,
      since: "",
      until: "",
      group: "model",
    });
    expect(
      filtered.selectedDays.every(
        (d) =>
          d >=
          new Date(
            Date.parse(all.selectedDays.at(-1)! + "T00:00:00Z") - 6 * 86400000,
          )
            .toISOString()
            .slice(0, 10),
      ),
    ).toBe(true);
    const empty = selectReport(model, {
      range: 0,
      since: "2099-01-01",
      until: "",
      group: "model",
    });
    expect(tokens(empty.total)).toBe(0);
    expect(empty.sessions).toEqual([]);
  });
  it("preserves Claude TTL costs and all-time card shares", () => {
    const model = reportModel(result, "claude"),
      view = selectReport(model, {
        range: 0,
        since: "",
        until: "",
        group: "model",
      }),
      costs = claudeCostRows(claude, view.groups);
    expect(costs.reduce((n, r) => n + r.total, 0)).toBeCloseTo(
      view.total[6],
      8,
    );
    for (const r of costs)
      expect(r.total).toBeCloseTo(
        r.input + r.cacheWrite + r.cacheRead + r.output,
        8,
      );
    const compare = claudeComparison(claude);
    expect(compare.reduce((n, r) => n + r.cardShare, 0)).toBeCloseTo(1, 12);
    expect(compare.reduce((n, r) => n + r.realShare, 0)).toBeCloseTo(1, 12);
    expect(view.cw5 + view.cw1).toBe(view.total[1]);
    expect(claudeCostRows(claude, view.groups, true).at(-1)?.total).toBeCloseTo(
      view.total[6],
      8,
    );
    expect(calendarDays(view.days).length % 7).toBe(0);
  });
  it("distinguishes unknown, partial and known-zero costs", () => {
    expect(costText(vec())).toBe("—");
    expect(costText([0, 0, 0, 100, 1, 0, 0, 100])).toBe("$0.000");
    expect(costText([100, 0, 0, 100, 1, 0, 0.5, 100])).toBe("$0.500*");
  });
  it("exports safely without remote resources or independent calculations", () => {
    const hostile = {
      ...result,
      agents: [
        {
          id: "x",
          label: "</script><img src=x onerror=alert(1)>",
          state: "Failed" as const,
          records: 0,
          elapsed: 0,
        },
      ],
    };
    expect(safeJson(hostile)).not.toContain("<");
    const html = reportHtml(hostile, "window.ready=true;", "body{color:black}");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("connect-src 'none'");
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
  it("round-trips legacy snapshots with TimeSpan durations, history and daily data; validates malformed numeric fields", () => {
    const p = {
      id: randomUUID(),
      name: "Example",
      rootPath: "C:\\Example",
      isEnabled: true,
      excludePatterns: [],
    };
    const metrics = projectMetrics(p, [
        {
          projectName: p.name,
          relativePath: "a.cs",
          extension: ".cs",
          language: "C#",
          category: "SourceCode",
          bytes: 24,
          tokens: 7,
          lines: {
            physicalLines: 2,
            codeLines: 1,
            commentLines: 1,
            blankLines: 0,
            mixedLines: 0,
            contentLines: 0,
          },
        },
      ]),
      s = defaults();
    s.projects = [p];
    s.lastSnapshot = snapshot([metrics], "AllText", "cl100k_base");
    const legacy = JSON.parse(JSON.stringify(s));
    legacy.lastSnapshot.projects[0].duration = "00:00:00.0050000";
    expect(parseSettings(legacy).lastSnapshot?.projects[0].duration).toBe(5);
    expect(analysisCsv(s.lastSnapshot)).toContain(
      "PhysicalLines,BlankLines,CodeLines",
    );
    const daily = { version: 1 as const, days: [] };
    recordLines(
      daily,
      [metrics],
      "AllText",
      "cl100k_base",
      "2026-09-21T10:00:00+03:00",
    );
    expect(parseDaily(daily).days[0].lines[0].tokens).toBe(7);
    expect(dailyCsv(daily)).toContain("2026-09-21");
    legacy.lastSnapshot.projects[0].files[0].tokens = "broken";
    expect(() => parseSettings(legacy)).toThrow();
    const history = {
      end: "2026-09-21T10:00:00Z",
      start: "2026-09-14T10:00:00Z",
      mode: "Activity" as const,
      scope: "SourceOnly" as const,
      projects: [],
      totals: gitTotals([], "Activity"),
    };
    expect(historyCsv(history)).toContain('"Totals"');
    expect(historyCsv(history)).toContain("RecordType");
  });
});

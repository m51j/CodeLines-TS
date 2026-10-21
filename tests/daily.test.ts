import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { DailyLog, Project } from "../src/shared/contracts";
import { projectMetrics } from "../src/domain/metrics";
import {
  recordLines,
  timeline,
  effectiveLines,
  compareDays,
  recordAi,
  matchProjects,
} from "../src/domain/daily";
import { aggregateAgents } from "../src/ai/aggregate";
import { record, dayParts } from "../src/ai/model";
const alpha: Project = {
    id: randomUUID(),
    name: "Alpha",
    rootPath: "D:\\Work\\alpha",
    isEnabled: true,
    excludePatterns: [],
  },
  beta: Project = {
    ...alpha,
    id: randomUUID(),
    name: "Beta",
    rootPath: "D:\\Work\\beta",
  };
function metrics(p: Project, n: number) {
  return projectMetrics(p, [
    {
      projectName: p.name,
      relativePath: "a.cs",
      extension: ".cs",
      language: "C#",
      category: "SourceCode",
      bytes: n * 10,
      tokens: n * 3,
      lines: {
        physicalLines: n,
        blankLines: 0,
        codeLines: n,
        commentLines: 0,
        mixedLines: 0,
        contentLines: 0,
      },
    },
  ]);
}
const log = (): DailyLog => ({ version: 1, days: [] });
const day1 = "2026-09-21T10:00:00+03:00",
  day2 = "2026-09-22T10:00:00+03:00";
describe("daily recording parity", () => {
  it("replaces only the scanned project, retains other projects and carries earlier scans", () => {
    const l = log();
    recordLines(
      l,
      [metrics(alpha, 100), metrics(beta, 50)],
      "SourceOnly",
      "o200k_base",
      day1,
    );
    recordLines(l, [metrics(alpha, 110)], "SourceOnly", "o200k_base", day1);
    recordLines(l, [metrics(alpha, 130)], "SourceOnly", "o200k_base", day2);
    expect(
      l.days[0].lines.map((e) => e.physicalLines).sort((a, b) => a - b),
    ).toEqual([50, 110]);
    expect(l.days[1].lines).toHaveLength(1);
    const rows = timeline(l);
    expect(rows[1]).toMatchObject({
      carriedProjects: 1,
      deltaLines: 20,
      deltaCode: 20,
      deltaTokens: 60,
    });
    expect(rows[0].deltaLines).toBeNull();
    expect(rows[1].lines?.physicalLines).toBe(180);
    expect(rows[1].notes).toContain("1 of 2");
    expect(
      effectiveLines(l, "2026-09-22").find((e) => e.entry.projectId === beta.id)
        ?.isCarried,
    ).toBe(true);
    expect(timeline(l, [alpha.id]).map((r) => r.carriedProjects)).toEqual([
      0, 0,
    ]);
  });
  it("compares totals and languages, warns about carried values and changing contracts", () => {
    const l = log();
    recordLines(
      l,
      [metrics(alpha, 100), metrics(beta, 50)],
      "SourceOnly",
      "o200k_base",
      day1,
    );
    recordLines(l, [metrics(alpha, 150)], "AllText", "cl100k_base", day2);
    const diff = compareDays(l, "2026-09-21", "2026-09-22");
    expect(
      diff.metrics.find((m) => m.metric === "physicalLines"),
    ).toMatchObject({ delta: 50, deltaPercent: 1 / 3 });
    expect(diff.languages[0].deltaLines).toBe(50);
    expect(diff.warning).toContain("not directly comparable");
    expect(diff.warning).toContain("latest earlier scan");
    expect(timeline(l)[1].scopeChanged).toBe(true);
  });
  it("attributes only to the longest root, including WSL/Git Bash paths", () => {
    const nested = {
      ...alpha,
      id: randomUUID(),
      rootPath: alpha.rootPath + "\\sub",
    };
    const payload = aggregateAgents(
      [
        {
          id: "codex",
          label: "Codex",
          records: [
            record({
              ts: 1,
              model: "unknown",
              input: 100,
              cacheRead: 50,
              session: "a",
              cwd: "/mnt/d/Work/alpha/sub/src",
            }),
          ],
        },
      ],
      "All agents",
      true,
    );
    const usage = matchProjects(payload.sessions, [alpha, nested]);
    expect(usage[0].tokens).toBe(0);
    expect(usage[1]).toMatchObject({
      tokens: 150,
      costPartial: true,
      sessions: 1,
    });
  });
  it("stores each AI day/agent/project and keeps historical totals while replacing today", () => {
    const l = log();
    const payload = (n: number) =>
      aggregateAgents(
        [
          {
            id: "codex",
            label: "Codex",
            records: [
              record({
                ts: Date.parse(day1),
                model: "gpt-5.5",
                input: n,
                output: n / 2,
                session: "a",
                request: "r1",
                cwd: alpha.rootPath,
              }),
              record({
                ts: Date.parse(day2),
                model: "unknown",
                input: n,
                session: "b",
                request: "r2",
                cwd: "D:\\other",
              }),
            ],
          },
        ],
        "All agents",
        true,
      );
    recordAi(l, payload(1000), [alpha, beta], day2);
    recordAi(l, payload(10), [alpha, beta], day2);
    expect(l.days[0].ai?.total.tokens).toBe(1500);
    expect(l.days[0].ai?.byAgent.codex.tokens).toBe(1500);
    expect(l.days[0].ai?.projects[0].projectId).toBe(alpha.id);
    expect(l.days[1].ai?.total.tokens).toBe(10);
    expect(l.days[1].ai?.total.costPartial).toBe(true);
    expect(timeline(l, [alpha.id], false)).toHaveLength(1);
  });
  it("buckets UTC timestamps deterministically across day boundaries", () => {
    expect(dayParts(Date.parse("2026-09-21T23:30:00Z"), true)).toEqual({
      day: "2026-09-21",
      hour: 23,
    });
  });
});

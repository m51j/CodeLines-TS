import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { walk, jsonLines } from "../src/ai/io";
import { parseClaudeLine } from "../src/ai/claude";
import {
  aggregateClaude,
  aggregateAgents,
  fromClaude,
} from "../src/ai/aggregate";
import { claudeRate, listRate, claudeCost } from "../src/ai/pricing";
const fixture = path.resolve("tests/fixtures");
const records = (
  await Promise.all(
    (await walk(path.join(fixture, "claude"), (n) => n.endsWith(".jsonl"))).map(
      (f) => jsonLines(f, parseClaudeLine),
    ),
  )
).flat();
function stripGenerated(value: unknown): unknown {
  const copy = structuredClone(value) as { meta: { generatedAt?: number } };
  delete copy.meta.generatedAt;
  return copy;
}
describe("original ccstats golden payload parity", () => {
  it("reads exactly the legacy 685 fixture records, including nested subagents", () => {
    expect(records).toHaveLength(685);
    expect(records.some((r) => r.model.startsWith("<"))).toBe(false);
  });
  for (const dedupe of [true, false])
    it(`matches the complete ${dedupe ? "deduplicated" : "raw"} Claude payload`, async () => {
      const golden = JSON.parse(
        await fs.readFile(
          path.join(
            fixture,
            dedupe
              ? "claude-payload.golden.json"
              : "claude-payload-raw.golden.json",
          ),
          "utf8",
        ),
      );
      expect(stripGenerated(aggregateClaude(records, true, dedupe))).toEqual(
        stripGenerated(golden),
      );
    });
  it("matches the combined agents payload", async () => {
    const golden = JSON.parse(
      await fs.readFile(
        path.join(fixture, "agents-payload.golden.json"),
        "utf8",
      ),
    );
    const actual = aggregateAgents(
      [{ id: "claude", label: "Claude Code", records: fromClaude(records) }],
      "All agents",
      true,
    );
    const clean = stripGenerated(actual) as typeof actual,
      expected = stripGenerated(golden) as typeof actual;
    expect({ ...clean, sessions: [] }).toEqual({ ...expected, sessions: [] });
    expect(clean.sessions.map((s) => s.slice(0, 12))).toEqual(
      expected.sessions.map((s) => s.slice(0, 12)),
    );
    clean.sessions.forEach((s, i) => {
      expect(s[12]).toBeCloseTo(Number(expected.sessions[i][12]), 8);
      expect(s[13]).toEqual(expected.sessions[i][13]);
    });
  });
  it("keeps legacy pricing frozen, including TTL distinctions and unknown Claude fallback", () => {
    expect(claudeRate("claude-opus-5-5")).toMatchObject({
      input: 4,
      output: 20,
      cacheRead: 0.2,
      write5m: 5,
      write1h: 8,
      known: true,
    });
    expect(claudeRate("claude-experimental-9").known).toBe(false);
    expect(listRate("omniroute/kr/claude-sonnet-4.5-high")).toEqual({
      input: 3,
      cacheRead: 3 * 0.1,
      cacheWrite: 3.75,
      output: 15,
    });
    expect(listRate("unknown")).toBeNull();
    for (const model of ["__proto__", "constructor", "toString"]) {
      expect(listRate(model)).toBeNull();
      expect(claudeRate(model)).toMatchObject({
        known: false,
        input: 5,
        output: 25,
      });
    }
    expect(
      claudeCost({
        model: "claude-opus-5-5",
        input: 1e6,
        cacheWrite5m: 1e6,
        cacheWrite1h: 1e6,
        cacheRead: 1e6,
        output: 1e6,
      }),
    ).toBe(37.2);
  });
});

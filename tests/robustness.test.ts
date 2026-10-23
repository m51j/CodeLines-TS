import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import type { DailyLog } from "../src/shared/contracts";
import { aggregateAgents, aggregateClaude } from "../src/ai/aggregate";
import { record, type ClaudeRecord } from "../src/ai/model";
import { claudeCost } from "../src/ai/pricing";
import { protobuf, pbInt } from "../src/ai/protobuf";
import { rows } from "../src/ai/io";
import { recordAi } from "../src/domain/daily";
import { reportModel } from "../src/reports/selectors";
import { compareCells } from "../src/renderer/components";
const at = Date.UTC(2026, 4, 3, 10);
const claude = (model: string, request: string, output: number): ClaudeRecord => ({
  ts: at,
  model,
  input: 1000,
  cacheWrite5m: 2000,
  cacheWrite1h: 0,
  cacheRead: 30000,
  output,
  thinking: 0,
  session: "mixed",
  request,
  cwd: "/work/app",
  branch: "main",
});
describe("AI robustness", () => {
  it("prices each Claude request in a mixed-model session at its own model's rate", () => {
    const records = [
      claude("claude-opus-4-1", "a", 5000),
      claude("claude-haiku-4-5", "b", 9000),
    ];
    const payload = aggregateClaude(records, true),
      [session] = payload.sessions,
      expected = claudeCost(records[0]) + claudeCost(records[1]);
    expect(session[11]).toBe("claude-haiku-4-5");
    expect(session[12]).toBeCloseTo(expected, 10);
    const model = reportModel(
      {
        generatedAt: new Date(at).toISOString(),
        combined: null,
        claude: payload,
        agents: [],
      },
      "claude",
    );
    expect(model.sessions[0].v[6]).toBeCloseTo(expected, 10);
  });
  it("drops implausible timestamps instead of failing the whole report", () => {
    const good = record({ ts: at, input: 10, session: "s", request: "1" });
    for (const utc of [true, false]) {
      const payload = aggregateAgents(
        [
          {
            id: "codex",
            label: "Codex",
            records: [
              good,
              record({ ts: Number.NaN, input: 5, request: "2" }),
              record({ ts: 9e15, input: 5, request: "3" }),
              record({ ts: 0, input: 5, request: "4" }),
            ],
          },
        ],
        "All agents",
        utc,
      );
      expect(payload.meta.countedRecords).toBe(1);
      expect(Object.keys(payload.hours)).toEqual(["2026-05-03"]);
    }
    const claudePayload = aggregateClaude(
      [claude("claude-opus-4-1", "x", 1), { ...claude("claude-opus-4-1", "y", 1), ts: -1 }],
      true,
    );
    expect(claudePayload.meta.countedRecords).toBe(1);
  });
  it("decodes protobuf varints exactly and rejects values beyond 2^53", () => {
    // field 1 = 1700000000123 (ms timestamp), field 2 = -1 as int64 (10 bytes)
    const encode = (n: bigint) => {
      const out: number[] = [];
      do {
        let b = Number(n & 127n);
        n >>= 7n;
        if (n) b |= 128;
        out.push(b);
      } while (n);
      return out;
    };
    const bytes = new Uint8Array([
      0x08,
      ...encode(1700000000123n),
      0x10,
      ...encode((1n << 64n) - 1n),
    ]);
    const message = protobuf(bytes);
    expect(pbInt(message, 1)).toBe(1700000000123);
    expect(pbInt(message, 2)).toBe(0);
  });
  it("keeps 64-bit SQLite integers exact", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(
        "create table t(id integer, n integer); insert into t values (9007199254740993, 5), (9007199254740995, 6)",
      );
      const result = rows(db, "select id, n from t");
      expect(result.map((r) => r.id)).toEqual([
        "9007199254740993",
        "9007199254740995",
      ]);
      expect(result.map((r) => r.n)).toEqual([5, 6]);
    } finally {
      db.close();
    }
  });
  it("replaces a historical AI day recorded under the other clock", () => {
    const log: DailyLog = { version: 1, days: [] };
    const payload = (input: number, utc: boolean) =>
      aggregateAgents(
        [
          {
            id: "codex",
            label: "Codex",
            records: [record({ ts: at, input, session: "s" })],
          },
        ],
        "All agents",
        utc,
      );
    const later = new Date(at + 5 * 86400000).toISOString();
    recordAi(log, payload(1000, false), [], later);
    recordAi(log, payload(10, false), [], later);
    expect(log.days[0].ai?.total.tokens).toBe(1000);
    recordAi(log, payload(10, true), [], later);
    expect(log.days[0].ai).toMatchObject({ tz: "utc", total: { tokens: 10 } });
  });
});
describe("table sorting", () => {
  it("keeps missing values last in both directions and sorts text naturally", () => {
    const values = [3, null, 10, undefined, 1];
    expect([...values].sort((a, b) => compareCells(a, b))).toEqual([
      1, 3, 10, null, undefined,
    ]);
    expect([...values].sort((a, b) => compareCells(a, b, true))).toEqual([
      10, 3, 1, null, undefined,
    ]);
    expect(["file10", "file2"].sort((a, b) => compareCells(a, b))).toEqual([
      "file2",
      "file10",
    ]);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import {
  adapters,
  parseCodex,
  parseCline,
  parseLmStudio,
  parseCopilot,
  type AgentEnvironment,
} from "../src/ai/adapters";
import { buildAi } from "../src/ai/builder";
import { defaults } from "../src/domain/defaults";
import { withDb, rows } from "../src/ai/io";
let env: AgentEnvironment, root: string;
const write = async (p: string, text: string) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, text);
};
const dbfile = (id: string) =>
  id === "hermes"
    ? path.join(env.localAppData, "hermes", "state.db")
    : id === "zcode"
      ? path.join(env.home, ".zcode", "cli", "db", "db.sqlite")
      : path.join(env.home, ".local", "share", id, id + ".db");
const database = async (file: string, sql: string) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    db.exec(sql);
  } finally {
    db.close();
  }
};
const adapter = (id: string) => adapters(env).find((a) => a.id === id)!;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "codelines-ts-adapter-"));
  env = {
    home: path.join(root, "home"),
    appData: path.join(root, "roaming"),
    localAppData: path.join(root, "local"),
    cache: path.join(root, "cache"),
    temp: path.join(root, "temp"),
  };
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 3 });
});
describe("every registered agent adapter", () => {
  it("reads committed WAL data during a writer transaction and copies exclusively locked stores", async () => {
    const file = path.join(root, "concurrent.db");
    const writer = new DatabaseSync(file);
    writer.exec(
      "PRAGMA journal_mode=WAL;create table values_log(value integer);insert into values_log values(1);BEGIN IMMEDIATE;insert into values_log values(2)",
    );
    expect(
      await withDb(file, env.temp, (db) =>
        rows(db, "select value from values_log"),
      ),
    ).toEqual([{ value: 1 }]);
    writer.exec("ROLLBACK");
    writer.close();
    const locked = path.join(root, "locked.db");
    const owner = new DatabaseSync(locked);
    owner.exec(
      "create table values_log(value integer);insert into values_log values(3);PRAGMA locking_mode=EXCLUSIVE;BEGIN EXCLUSIVE",
    );
    try {
      expect(
        await withDb(locked, env.temp, (db) =>
          rows(db, "select value from values_log"),
        ),
      ).toEqual([{ value: 3 }]);
    } finally {
      owner.exec("ROLLBACK");
      owner.close();
    }
  });
  it("keeps all 11 adapter variants in legacy tab order and detects an empty machine", async () => {
    expect(adapters(env).map((a) => a.id)).toEqual([
      "codex",
      "antigravity-ide",
      "antigravity",
      "agy",
      "zcode",
      "opencode",
      "kilo",
      "cline",
      "copilot",
      "hermes",
      "lmstudio",
    ]);
    for (const a of adapters(env)) {
      expect(await a.detect()).toBe(false);
      expect(await a.load(false)).toEqual([]);
    }
  });
  it("reads archived Codex rollouts, subtracts cached input, drops re-emits and reuses cache", async () => {
    const f = path.join(
      env.home,
      ".codex",
      "archived_sessions",
      "rollout-a.jsonl",
    );
    const header = [
      { type: "session_meta", payload: { id: "s", cwd: "C:\\first" } },
      { type: "turn_context", payload: { model: "gpt-5", cwd: "C:\\proj" } },
    ];
    const event = {
      timestamp: "2025-01-01T00:00:02Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 100,
            cached_input_tokens: 40,
            output_tokens: 20,
            reasoning_output_tokens: 5,
          },
          total_token_usage: { total_tokens: 120 },
        },
      },
    };
    await write(
      f,
      [...header, event, event].map((r) => JSON.stringify(r)).join("\n"),
    );
    const a = adapter("codex"),
      records = await a.load(false);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      input: 60,
      cacheRead: 40,
      output: 20,
      thinking: 5,
      model: "gpt-5",
      session: "s",
      cwd: "C:\\proj",
    });
    const cache = path.join(env.cache, "codex.json");
    await fs.writeFile(
      cache,
      (await fs.readFile(cache, "utf8")).replaceAll("gpt-5", "cached-model"),
    );
    expect((await a.load(false))[0].model).toBe("cached-model");
    expect((await a.load(true))[0].model).toBe("gpt-5");
    expect(await parseCodex(f)).toEqual(records);
  });
  it("uses Cline message metrics and invalidates cache when the companion header changes", async () => {
    const dir = path.join(env.home, ".cline", "data", "sessions", "abc"),
      head = path.join(dir, "abc.json"),
      file = path.join(dir, "abc.messages.json");
    await write(
      head,
      JSON.stringify({
        session_id: "s",
        model: "head-model",
        workspace_root: "C:\\repo",
        started_at: "2025-02-01T00:00:00Z",
      }),
    );
    await write(
      file,
      JSON.stringify({
        messages: [
          { role: "user", metrics: { inputTokens: 5 } },
          {
            id: "m1",
            role: "assistant",
            ts: 1700000000000,
            modelInfo: { id: "claude-sonnet-4" },
            metrics: {
              inputTokens: 1000,
              outputTokens: 50,
              cacheReadTokens: 600,
              cacheWriteTokens: 100,
              cost: 0.02,
            },
          },
          { role: "assistant", metrics: { inputTokens: 3, outputTokens: 1 } },
        ],
      }),
    );
    const records = await parseCline(file);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      input: 300,
      cacheRead: 600,
      cacheWrite: 100,
      output: 50,
      cost: 0.02,
      request: "cline:m1",
    });
    expect(records[1].request).toBe("cline:undefined");
    const a = adapter("cline");
    await a.load(false);
    await fs.writeFile(head, JSON.stringify({ model: "new-header" }));
    expect((await a.load(false))[1].model).toBe("new-header");
  });
  it("replays Copilot patches including largest completion, splice, fallback and sparse request arrays", async () => {
    const ws = path.join(env.appData, "Code", "User", "workspaceStorage", "ws"),
      file = path.join(ws, "chatSessions", "chat.jsonl");
    await write(
      path.join(ws, "workspace.json"),
      JSON.stringify({ folder: "file:///d%3A/my%20proj" }),
    );
    await write(
      file,
      [
        {
          kind: 0,
          v: {
            sessionId: "sess",
            creationDate: 1000,
            requests: [
              { requestId: "r0", timestamp: 5000, modelId: "copilot/gpt-4o" },
            ],
          },
        },
        { kind: 2, k: ["requests"], v: [{ requestId: "r1", timestamp: 6000 }] },
        { kind: 1, k: ["requests", 0, "completionTokens"], v: 40 },
        { kind: 1, k: ["requests", 0, "completionTokens"], v: 25 },
        {
          kind: 1,
          k: ["requests", 0, "result"],
          v: {
            metadata: {
              promptTokens: 100,
              outputTokens: 30,
              toolCallRounds: [{}, {}, {}],
            },
          },
        },
        {
          kind: 2,
          k: ["requests"],
          i: 1,
          v: [{ timestamp: 7000, promptTokens: 60, completionTokens: 5 }],
        },
        {
          kind: 1,
          k: ["inputState", "selectedModel", "identifier"],
          v: "copilot/gpt-5",
        },
        { kind: 1, k: ["requests", 4, "promptTokens"], v: 7 },
        { kind: 1, k: ["__proto__", "polluted"], v: true },
      ]
        .map((v) => JSON.stringify(v))
        .join("\n"),
    );
    const records = await parseCopilot(file);
    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({
      model: "gpt-4o",
      input: 100,
      output: 40,
      calls: 3,
      cwd: "d:\\my proj",
    });
    expect(records[1]).toMatchObject({
      request: "sess:1",
      ts: 7000,
      model: "gpt-5",
    });
    expect(records[2]).toMatchObject({ request: "sess:4", ts: 1000, input: 7 });
    expect(Object.prototype).not.toHaveProperty("polluted");
  });
  it("counts LM Studio selected versions with local known-zero cost and fallback timestamps", async () => {
    const f = path.join(
      env.home,
      ".lmstudio",
      "conversations",
      "chat.conversation.json",
    );
    await write(
      f,
      JSON.stringify({
        assistantLastMessagedAt: 1700000009000,
        lastUsedModel: { identifier: "fallback" },
        messages: [
          {
            currentlySelected: 1,
            versions: [
              {
                role: "assistant",
                steps: [
                  {
                    genInfo: {
                      identifier: "discarded",
                      stats: { promptTokensCount: 999 },
                    },
                  },
                ],
              },
              {
                role: "assistant",
                steps: [
                  {
                    stepIdentifier: "1700000002000-a",
                    genInfo: {
                      identifier: "llama",
                      stats: {
                        promptTokensCount: 120,
                        predictedTokensCount: 30,
                      },
                    },
                  },
                  {
                    stepIdentifier: "x",
                    genInfo: { stats: { promptTokensCount: 1 } },
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    const records = await parseLmStudio(f);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      ts: 1700000002000,
      model: "llama",
      input: 120,
      output: 30,
      cost: 0,
    });
    expect(records[1]).toMatchObject({ ts: 1700000009000, model: "fallback" });
  });
  it("reads ZCode SQLite read-only and subtracts both caches", async () => {
    const f = dbfile("zcode");
    await database(
      f,
      "create table session(id text,directory text);create table model_usage(id text,session_id text,model_id text,started_at integer,input_tokens integer,output_tokens integer,reasoning_tokens integer,cache_creation_input_tokens integer,cache_read_input_tokens integer);insert into session values('s','C:\\work');insert into model_usage values('u','s','glm-4.6',1700000000000,100,40,10,20,30)",
    );
    const before = await fs.readFile(f);
    expect((await adapter("zcode").load(false))[0]).toMatchObject({
      input: 50,
      cacheWrite: 20,
      cacheRead: 30,
      output: 40,
      thinking: 10,
      cwd: "C:\\work",
    });
    expect(await fs.readFile(f)).toEqual(before);
  });
  for (const id of ["opencode", "kilo"])
    it(`reads ${id} output+reasoning, recorded costs, free models and malformed rows`, async () => {
      const f = dbfile(id);
      await database(
        f,
        "create table session(id text,directory text);create table message(id text,session_id text,time_created integer,data text);",
      );
      const db = new DatabaseSync(f);
      const insert = db.prepare("insert into message values(?,?,?,?)");
      insert.run(
        "m1",
        "s",
        1,
        JSON.stringify({
          role: "assistant",
          modelID: "claude-sonnet-4",
          cost: 0.5,
          tokens: {
            input: 10,
            output: 20,
            reasoning: 5,
            cache: { read: 100, write: 7 },
          },
        }),
      );
      insert.run(
        "m2",
        "s",
        2,
        JSON.stringify({
          role: "assistant",
          modelID: "x-free",
          cost: 0,
          tokens: { input: 1 },
        }),
      );
      insert.run("bad", "s", 3, "broken");
      db.close();
      const records = await adapter(id).load(false);
      expect(records).toHaveLength(2);
      expect(records[0]).toMatchObject({
        input: 10,
        output: 25,
        thinking: 5,
        cacheRead: 100,
        cacheWrite: 7,
        cost: 0.5,
      });
      expect(records[1].cost).toBe(0);
    });
  it("preserves Hermes actual zero over estimates and unknown subscription billing", async () => {
    await database(
      dbfile("hermes"),
      "create table sessions(id text,model text,started_at real,input_tokens integer,output_tokens integer,cache_read_tokens integer,cache_write_tokens integer,reasoning_tokens integer,actual_cost_usd real,estimated_cost_usd real,cwd text,api_call_count integer);insert into sessions values('a','hermes',1700000000.5,100,50,30,20,10,0,9,'/w',7);insert into sessions values('b',null,1700000001,1,1,0,0,0,null,.25,null,0);insert into sessions values('c',null,1700000002,1,0,0,0,0,null,0,null,null)",
    );
    const records = await adapter("hermes").load(false);
    expect(records[0]).toMatchObject({
      ts: 1700000000500,
      cost: 0,
      calls: 7,
      thinking: 10,
    });
    expect(records[1].cost).toBe(0.25);
    expect(records[2]).toMatchObject({
      cost: null,
      model: "unknown",
      calls: 1,
    });
  });
  for (const [id, variant] of [
    ["antigravity-ide", "antigravity-ide"],
    ["antigravity", "antigravity"],
    ["agy", "antigravity-cli"],
  ])
    it(`decodes ${id} protobuf usage and conversation-specific model names`, async () => {
      const dir = path.join(env.home, ".gemini", variant, "conversations");
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, "conv.db");
      const db = new DatabaseSync(file);
      db.exec(
        "create table steps(idx integer,metadata blob);create table gen_metadata(data blob);create table trajectory_metadata_blob(data blob)",
      );
      const variable = (n: number) => {
        const bytes: number[] = [];
        do {
          const b = n % 128;
          n = Math.floor(n / 128);
          bytes.push(b | (n ? 128 : 0));
        } while (n);
        return Buffer.from(bytes);
      };
      const int = (f: number, n: number) =>
          Buffer.concat([variable(f * 8), variable(n)]),
        bytes = (f: number, b: Buffer) =>
          Buffer.concat([variable(f * 8 + 2), variable(b.length), b]),
        str = (f: number, s: string) => bytes(f, Buffer.from(s));
      const usage = Buffer.concat([
        int(1, 7),
        int(2, 5e9),
        int(3, 300),
        int(4, 20),
        int(5, 400),
        int(9, 100),
        str(11, "resp"),
      ]);
      db.prepare("insert into steps values(?,?)").run(
        0,
        Buffer.concat([
          bytes(1, Buffer.concat([int(1, 1700000000), int(2, 123456789)])),
          bytes(9, usage),
        ]),
      );
      db.prepare("insert into gen_metadata values(?)").run(
        bytes(
          1,
          Buffer.concat([bytes(4, int(1, 7)), str(19, "gemini-custom")]),
        ),
      );
      db.prepare("insert into trajectory_metadata_blob values(?)").run(
        bytes(1, str(1, "file:///D:/my%20proj")),
      );
      db.close();
      expect((await adapter(id).load(false))[0]).toMatchObject({
        ts: 1700000000123,
        model: "gemini-custom",
        input: 5e9,
        output: 300,
        cacheWrite: 20,
        cacheRead: 400,
        thinking: 100,
        request: "resp",
        cwd: "D:\\my proj",
      });
    });
  it("builds statuses and a combined report without accessing live user roots", async () => {
    const options = defaults().aiUsage;
    options.disabledAgents = ["codex"];
    const result = await buildAi(env, options, false);
    expect(result.combined).toBeNull();
    expect(result.agents).toHaveLength(12);
    expect(result.agents.find((a) => a.id === "codex")?.state).toBe("Disabled");
  });
});

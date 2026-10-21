import path from "node:path";
import fs from "node:fs/promises";
import {
  type AgentRecord,
  obj,
  arr,
  num,
  str,
  record,
  textOr,
  parseTimestamp,
} from "./model";
import {
  exists,
  list,
  walk,
  cached,
  jsonLines,
  readJson,
  withDb,
  rows,
  hasTable,
  sqlText,
} from "./io";
import { cancelled } from "../services/scanner";
import { protobuf, pbSub, pbInt, pbStr, uriToPath } from "./protobuf";
export interface AgentEnvironment {
  home: string;
  appData: string;
  localAppData: string;
  cache: string;
  temp: string;
}
import { agentLabels } from "../shared/agents";
export interface Adapter {
  id: string;
  label: string;
  note?: string;
  detect(): Promise<boolean>;
  load(rescan: boolean, signal?: AbortSignal): Promise<AgentRecord[]>;
}
export async function parseCodex(
  file: string,
  signal?: AbortSignal,
): Promise<AgentRecord[]> {
  let session = "",
    cwd = "",
    model = "",
    prevTotal = -1;
  return jsonLines(
    file,
    (line) => {
      if (
        !line.includes('"token_count"') &&
        !line.includes('"turn_context"') &&
        !line.includes('"session_meta"')
      )
        return null;
      const d = obj(JSON.parse(line)),
        p = obj(d.payload);
      if (d.type === "session_meta") {
        session ||= textOr(p.id, p.session_id);
        cwd ||= textOr(p.cwd);
      } else if (d.type === "turn_context") {
        model = textOr(p.model) || model;
        cwd = textOr(p.cwd) || cwd;
      } else if (d.type === "event_msg" && p.type === "token_count" && p.info) {
        const info = obj(p.info);
        if (!info.last_token_usage || !info.total_token_usage) return null;
        const last = obj(info.last_token_usage),
          total = num(obj(info.total_token_usage).total_tokens);
        if (total === prevTotal) return null;
        prevTotal = total;
        const ts = parseTimestamp(d.timestamp);
        if (ts === null) return null;
        const cr = num(last.cached_input_tokens);
        return record({
          ts,
          model,
          input: num(last.input_tokens) - cr,
          cacheWrite: num(last.cache_write_input_tokens),
          cacheRead: cr,
          output: num(last.output_tokens),
          thinking: num(last.reasoning_output_tokens),
          session,
          request: `codex:${String(d.timestamp)}:${total}`,
          cwd,
        });
      }
      return null;
    },
    signal,
  );
}
export async function parseCline(
  file: string,
  signal?: AbortSignal,
): Promise<AgentRecord[]> {
  const id = path.basename(path.dirname(file)),
    head = obj(await readJson(path.join(path.dirname(file), id + ".json"))),
    body = obj(await readJson(file)),
    records: AgentRecord[] = [];
  for (const message of arr(body.messages)) {
    cancelled(signal);
    const m = obj(message),
      x = obj(m.metrics);
    if (
      !m.metrics ||
      m.role !== "assistant" ||
      (!num(x.inputTokens) && !num(x.outputTokens))
    )
      continue;
    const cr = num(x.cacheReadTokens),
      cw = num(x.cacheWriteTokens);
    records.push(
      record({
        ts: num(m.ts) || parseTimestamp(head.started_at) || 0,
        model: textOr(obj(m.modelInfo).id, head.model),
        input: num(x.inputTokens) - cr - cw,
        cacheWrite: cw,
        cacheRead: cr,
        output: num(x.outputTokens),
        cost: typeof x.cost === "number" ? x.cost : null,
        session: textOr(head.session_id) || id,
        request: "cline:" + String(m.id || m.ts),
        cwd: textOr(head.cwd, head.workspace_root),
      }),
    );
  }
  return records;
}
export async function parseLmStudio(
  file: string,
  signal?: AbortSignal,
): Promise<AgentRecord[]> {
  const j = obj(await readJson(file)),
    session = path.basename(file).slice(0, -".conversation.json".length),
    fallback =
      num(j.assistantLastMessagedAt) ||
      num(j.userLastMessagedAt) ||
      num(j.createdAt),
    records: AgentRecord[] = [];
  for (const message of arr(j.messages)) {
    cancelled(signal);
    const m = obj(message),
      versions = arr(m.versions),
      v = obj(versions[Number(m.currentlySelected ?? 0)] ?? versions[0]);
    if (v.role !== "assistant") continue;
    for (const step of arr(v.steps)) {
      const s = obj(step),
        gen = obj(s.genInfo),
        stats = obj(gen.stats);
      if (!gen.stats) continue;
      const stepId = textOr(s.stepIdentifier),
        ts = Number(stepId.split("-")[0]) || fallback;
      records.push(
        record({
          ts,
          model: textOr(
            gen.identifier,
            gen.indexedModelIdentifier,
            obj(j.lastUsedModel).identifier,
          ),
          input: num(stats.promptTokensCount),
          output: num(stats.predictedTokensCount),
          cost: 0,
          session,
          request: "lmstudio:" + (stepId || ts),
        }),
      );
    }
  }
  return records;
}
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
function safePath(keys: unknown[]): boolean {
  return (
    keys.length > 0 &&
    keys.length < 128 &&
    keys.every(
      (k) =>
        (typeof k === "string" || typeof k === "number") &&
        !forbidden.has(String(k)) &&
        !(typeof k === "string" && /^\d+$/.test(k) && Number(k) > 1e6) &&
        !(typeof k === "number" && (!Number.isInteger(k) || k < 0 || k > 1e6)),
    )
  );
}
function setPath(state: unknown, keys: unknown[], value: unknown): void {
  if (!safePath(keys)) return;
  let o = state as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!o || typeof o !== "object") return;
    const k = String(keys[i]);
    if (!o[k] || typeof o[k] !== "object")
      o[k] = typeof keys[i + 1] === "number" ? [] : Object.create(null);
    o = o[k] as Record<string, unknown>;
  }
  if (o && typeof o === "object") o[String(keys.at(-1))] = value;
}
function getPath(state: unknown, keys: unknown[]): unknown {
  if (!safePath(keys)) return undefined;
  let o = state;
  for (const k of keys) {
    if (!o || typeof o !== "object") return undefined;
    o = (o as Record<string, unknown>)[String(k)];
  }
  return o;
}
export async function parseCopilot(
  file: string,
  signal?: AbortSignal,
): Promise<AgentRecord[]> {
  let state: unknown = {};
  const completion = new Map<number, number>();
  await jsonLines(
    file,
    (line) => {
      const d = obj(JSON.parse(line)),
        keys = arr(d.k),
        value = d.v;
      if (d.kind === 0) state = value && typeof value === "object" ? value : {};
      else if (d.kind === 1 && keys.length) {
        if (
          keys.length === 3 &&
          keys[0] === "requests" &&
          keys[2] === "completionTokens" &&
          typeof keys[1] === "number"
        )
          completion.set(
            keys[1],
            Math.max(completion.get(keys[1]) ?? 0, num(value)),
          );
        if (keys.at(-1) !== "response") setPath(state, keys, value);
      } else if (d.kind === 2 && keys.length) {
        let a = getPath(state, keys);
        if (!Array.isArray(a)) {
          a = [];
          setPath(state, keys, a);
        }
        const list = a as unknown[],
          items = Array.isArray(value) ? value : [value];
        if (typeof d.i === "number")
          list.splice(d.i, list.length - d.i, ...items);
        else list.push(...items);
      }
      return null;
    },
    signal,
  );
  const s = obj(state),
    workspace = obj(
      await readJson(
        path.join(path.dirname(path.dirname(file)), "workspace.json"),
      ),
    );
  let cwd = "";
  try {
    cwd = uriToPath(str(workspace.folder));
  } catch {
    /* invalid URI */
  }
  const session = textOr(s.sessionId) || path.basename(file, ".jsonl"),
    records: AgentRecord[] = [];
  arr(s.requests).forEach((request, i) => {
    const r = obj(request),
      md = obj(obj(r.result).metadata),
      input = num(md.promptTokens) || num(r.promptTokens),
      output = Math.max(
        completion.get(i) ?? 0,
        num(r.completionTokens),
        num(md.outputTokens),
      );
    if (!input && !output) return;
    records.push(
      record({
        ts: num(r.timestamp) || num(s.creationDate),
        model: (
          textOr(
            r.modelId,
            md.resolvedModel,
            obj(obj(s.inputState).selectedModel).identifier,
          ) || "unknown"
        ).replace(/^copilot\//, ""),
        input,
        output,
        session,
        request: textOr(r.requestId) || `${session}:${i}`,
        cwd,
        calls: Math.max(1, arr(md.toolCallRounds).length),
      }),
    );
  });
  return records;
}
function fileAdapter(
  env: AgentEnvironment,
  id: string,
  root: string | string[],
  files: (signal?: AbortSignal) => Promise<string[]>,
  parse: (file: string, signal?: AbortSignal) => Promise<AgentRecord[]>,
  note?: string,
): Adapter {
  return {
    id,
    label: agentLabels[id],
    note,
    detect: async () =>
      (
        await Promise.all((Array.isArray(root) ? root : [root]).map(exists))
      ).some(Boolean),
    load: async (rescan, signal) =>
      cached(
        await files(signal),
        path.join(env.cache, id + ".json"),
        "ts-1.1",
        (f) => parse(f, signal),
        rescan,
        signal,
        undefined,
        id === "cline"
          ? async (f) => {
              try {
                return (
                  await fs.stat(
                    path.join(
                      path.dirname(f),
                      path.basename(path.dirname(f)) + ".json",
                    ),
                  )
                ).mtimeMs;
              } catch {
                return 0;
              }
            }
          : undefined,
      ),
  };
}
function sqlAdapter(
  env: AgentEnvironment,
  id: string,
  file: string,
  read: (
    db: import("node:sqlite").DatabaseSync,
    signal?: AbortSignal,
  ) => AgentRecord[],
  note?: string,
): Adapter {
  return {
    id,
    label: agentLabels[id],
    note,
    detect: () => exists(file),
    load: async (_rescan, signal) => {
      cancelled(signal);
      return (await exists(file))
        ? withDb(file, env.temp, (db) => read(db, signal))
        : [];
    },
  };
}
export function adapters(env: AgentEnvironment): Adapter[] {
  const home = (...p: string[]) => path.join(env.home, ...p);
  const cline = home(".cline", "data", "sessions"),
    lm = home(".lmstudio", "conversations"),
    copilot = path.join(env.appData, "Code", "User", "workspaceStorage");
  return [
    fileAdapter(
      env,
      "codex",
      [home(".codex", "sessions"), home(".codex", "archived_sessions")],
      async (signal) =>
        (
          await Promise.all(
            ["sessions", "archived_sessions"].map((d) =>
              walk(
                home(".codex", d),
                (n) => n.startsWith("rollout-") && n.endsWith(".jsonl"),
                signal,
              ),
            ),
          )
        )
          .flat()
          .sort(),
      parseCodex,
    ),
    ...["antigravity-ide", "antigravity", "agy"].map((id) =>
      antigravity(env, id, id === "agy" ? "antigravity-cli" : id),
    ),
    sqlAdapter(
      env,
      "zcode",
      home(".zcode", "cli", "db", "db.sqlite"),
      (db, signal) => {
        if (!hasTable(db, "model_usage")) return [];
        return rows(
          db,
          "select u.id, u.session_id, u.model_id, u.started_at, u.input_tokens, u.output_tokens, u.reasoning_tokens, u.cache_creation_input_tokens cw, u.cache_read_input_tokens cr, s.directory from model_usage u left join session s on s.id = u.session_id where u.input_tokens > 0 or u.output_tokens > 0",
        ).map((r) => {
          cancelled(signal);
          return record({
            ts: num(r.started_at),
            model: sqlText(r.model_id),
            input: num(r.input_tokens) - num(r.cr) - num(r.cw),
            cacheWrite: num(r.cw),
            cacheRead: num(r.cr),
            output: num(r.output_tokens),
            thinking: num(r.reasoning_tokens),
            session: sqlText(r.session_id),
            request: sqlText(r.id),
            cwd: sqlText(r.directory),
          });
        });
      },
    ),
    ...["opencode", "kilo"].map((id) =>
      sqlAdapter(
        env,
        id,
        home(".local", "share", id, id + ".db"),
        (db, signal) => {
          if (!hasTable(db, "message")) return [];
          const records: AgentRecord[] = [];
          for (const r of rows(
            db,
            "select m.id, m.session_id, m.time_created, m.data, s.directory from message m left join session s on s.id = m.session_id",
          )) {
            cancelled(signal);
            let x: Record<string, unknown>;
            try {
              x = obj(JSON.parse(sqlText(r.data)));
            } catch {
              continue;
            }
            if (x.role !== "assistant") continue;
            const t = obj(x.tokens),
              c = obj(t.cache),
              thinking = num(t.reasoning),
              cost = num(x.cost);
            if (
              !num(t.input) &&
              !num(t.output) &&
              !thinking &&
              !num(c.read) &&
              !num(c.write) &&
              cost <= 0
            )
              continue;
            const model = textOr(x.modelID) || "unknown";
            records.push(
              record({
                ts: num(obj(x.time).created) || num(r.time_created),
                model,
                input: num(t.input),
                cacheWrite: num(c.write),
                cacheRead: num(c.read),
                output: num(t.output) + thinking,
                thinking,
                cost: cost > 0 || /(:free|-free)$/i.test(model) ? cost : null,
                session: sqlText(r.session_id),
                request: sqlText(r.id),
                cwd: textOr(obj(x.path).cwd, r.directory),
              }),
            );
          }
          return records;
        },
      ),
    ),
    fileAdapter(
      env,
      "cline",
      cline,
      async () => {
        const result: string[] = [];
        for (const d of await list(cline)) {
          const f = path.join(cline, d, d + ".messages.json");
          if (await exists(f)) result.push(f);
        }
        return result;
      },
      parseCline,
    ),
    fileAdapter(
      env,
      "copilot",
      copilot,
      async () => {
        const result: string[] = [];
        for (const d of await list(copilot))
          for (const f of await list(path.join(copilot, d, "chatSessions")))
            if (f.endsWith(".jsonl"))
              result.push(path.join(copilot, d, "chatSessions", f));
        return result.sort();
      },
      parseCopilot,
      "Copilot saves only the last tool-call round’s prompt size for each request, so input tokens here are a lower bound. Model calls count every tool-call round.",
    ),
    sqlAdapter(
      env,
      "hermes",
      path.join(env.localAppData, "hermes", "state.db"),
      (db, signal) => {
        if (!hasTable(db, "sessions")) return [];
        return rows(db, "select * from sessions")
          .filter(
            (r) => num(r.input_tokens) !== 0 || num(r.output_tokens) !== 0,
          )
          .map((r) => {
            cancelled(signal);
            return record({
              ts: Math.round(num(r.started_at) * 1000),
              model: sqlText(r.model),
              input: num(r.input_tokens),
              cacheWrite: num(r.cache_write_tokens),
              cacheRead: num(r.cache_read_tokens),
              output: num(r.output_tokens),
              thinking: num(r.reasoning_tokens),
              cost:
                r.actual_cost_usd !== null && r.actual_cost_usd !== undefined
                  ? num(r.actual_cost_usd)
                  : num(r.estimated_cost_usd) > 0
                    ? num(r.estimated_cost_usd)
                    : null,
              session: sqlText(r.id),
              request: "hermes:" + String(r.id),
              cwd: sqlText(r.cwd),
              calls: Math.max(1, num(r.api_call_count)),
            });
          });
      },
      "Hermes stores usage per session, not per call, so all of a session’s tokens land on the hour it started.",
    ),
    fileAdapter(
      env,
      "lmstudio",
      lm,
      async () =>
        (await list(lm))
          .filter((f) => f.endsWith(".conversation.json"))
          .map((f) => path.join(lm, f)),
      parseLmStudio,
    ),
  ];
}
function antigravity(
  env: AgentEnvironment,
  id: string,
  variant: string,
): Adapter {
  const root = path.join(env.home, ".gemini", variant, "conversations");
  return {
    id,
    label: agentLabels[id],
    note: "Antigravity keeps no official usage log; these counts are decoded from its conversation databases (the per-call usage record each model step stores).",
    detect: () => exists(root),
    load: async (_rescan, signal) => {
      type Call = { record: AgentRecord; enumId: number };
      const conversations: { names: Map<number, string>; calls: Call[] }[] = [],
        global = new Map<number, string>();
      for (const file of (await list(root)).filter((f) => f.endsWith(".db"))) {
        cancelled(signal);
        try {
          const c = await withDb(path.join(root, file), env.temp, (db) => {
            const names = new Map<number, string>(),
              calls: Call[] = [];
            if (!hasTable(db, "steps")) return { names, calls };
            const bytes = (v: unknown) =>
              v instanceof Uint8Array
                ? v
                : typeof v === "string"
                  ? Buffer.from(v)
                  : new Uint8Array();
            if (hasTable(db, "gen_metadata"))
              for (const r of rows(db, "select data from gen_metadata")) {
                const one = pbSub(protobuf(bytes(r.data)), 1),
                  usage = pbSub(one, 4),
                  name = pbStr(one, 19);
                if (usage && name) names.set(pbInt(usage, 1), name);
              }
            let cwd = "";
            if (hasTable(db, "trajectory_metadata_blob")) {
              const blob = rows(
                db,
                "select data from trajectory_metadata_blob",
              )[0];
              if (blob)
                cwd = uriToPath(pbStr(pbSub(protobuf(bytes(blob.data)), 1), 1));
            }
            const session = path.basename(file, ".db");
            for (const r of rows(
              db,
              "select idx, metadata from steps where metadata is not null",
            )) {
              cancelled(signal);
              const m = protobuf(bytes(r.metadata)),
                u = pbSub(m, 9);
              if (!u) continue;
              const at = pbSub(m, 1),
                ts = pbInt(at, 1) * 1000 + Math.floor(pbInt(at, 2) / 1e6);
              if (!ts) continue;
              calls.push({
                enumId: pbInt(u, 1),
                record: record({
                  ts,
                  input: pbInt(u, 2),
                  output: pbInt(u, 3),
                  cacheWrite: pbInt(u, 4),
                  cacheRead: pbInt(u, 5),
                  thinking: pbInt(u, 9),
                  request: pbStr(u, 11) || session + ":" + String(r.idx),
                  session,
                  cwd,
                }),
              });
            }
            return { names, calls };
          });
          conversations.push(c);
          for (const [k, v] of c.names) if (!global.has(k)) global.set(k, v);
        } catch {
          cancelled(signal);
        }
      }
      return conversations.flatMap((c) =>
        c.calls.map((x) => ({
          ...x.record,
          model:
            c.names.get(x.enumId) ??
            global.get(x.enumId) ??
            `unnamed model #${x.enumId}`,
        })),
      );
    },
  };
}

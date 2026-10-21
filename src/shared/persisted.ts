import { z } from "zod";
import { scopes } from "./contracts";
const n = z.number().finite().nonnegative();
const stamp = z
  .string()
  .refine((s) => Number.isFinite(Date.parse(s)), "Invalid timestamp");
const scope = z.preprocess(
  (v) => (typeof v === "number" ? scopes[v] : v),
  z.enum(scopes),
);
const categories = [
  "SourceCode",
  "Configuration",
  "DocumentationText",
] as const;
const category = z.preprocess(
  (v) => (typeof v === "number" ? categories[v] : v),
  z.enum(categories),
);
const lines = {
  physicalLines: n,
  blankLines: n,
  codeLines: n,
  commentLines: n,
  mixedLines: n,
  contentLines: n,
};
const file = z.object({
  projectName: z.string(),
  relativePath: z.string(),
  extension: z.string(),
  language: z.string(),
  category,
  bytes: n,
  tokens: n,
  lines: z.object(lines),
});
export const storedSnapshot = z.object({
  scannedAt: stamp,
  countingScope: scope,
  tokenizerEncoding: z.enum(["o200k_base", "cl100k_base"]),
  projects: z.array(
    z.object({
      projectId: z.uuid(),
      projectName: z.string(),
      rootPath: z.string(),
      files: z.array(file),
      warnings: z.array(z.string()).default([]),
      duration: z.union([n, z.string()]).default(0),
    }),
  ),
});
const gitFile = z
  .object({
    path: z.string(),
    added: n,
    deleted: n,
    modifiedEstimate: n,
    binary: z.boolean(),
  })
  .transform((f) => ({ ...f, net: f.added - f.deleted }));
export const storedHistory = z.object({
  end: stamp,
  start: stamp,
  mode: z.preprocess(
    (v) => (typeof v === "number" ? ["Activity", "NetChange"][v] : v),
    z.enum(["Activity", "NetChange"]),
  ),
  scope,
  projects: z.array(
    z.object({
      projectId: z.uuid(),
      projectName: z.string(),
      branch: z.string(),
      head: z.string(),
      status: z.string(),
      isIncomplete: z.boolean(),
      commits: n.nullable(),
      files: z.array(gitFile),
    }),
  ),
});
const language = z.object({
  language: z.string(),
  category,
  files: n,
  tokens: n,
  physicalLines: n,
  codeLines: n,
  commentLines: n,
  contentLines: n,
});
const entry = z.object({
  projectId: z.uuid(),
  name: z.string(),
  rootPath: z.string(),
  scannedAt: stamp,
  scope,
  tokenizer: z.string(),
  files: n,
  bytes: n,
  tokens: n,
  physicalLines: n,
  blankLines: n,
  codeLines: n,
  commentLines: n,
  contentLines: n,
  languages: z.array(language),
});
const amount = z
  .object({
    input: n,
    cacheWrite: n,
    cacheRead: n,
    output: n,
    requests: n,
    cost: z.number().finite(),
    costPartial: z.boolean(),
  })
  .transform((a) => ({
    ...a,
    tokens: a.input + a.cacheWrite + a.cacheRead + a.output,
  }));
const projectUsage = z.object({
  projectId: z.uuid(),
  sessions: n,
  tokens: n,
  cost: z.number().finite(),
  costPartial: z.boolean(),
});
export const storedDaily = z.object({
  version: z.literal(1),
  days: z.array(
    z.object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .refine((s) => Number.isFinite(Date.parse(s + "T00:00:00Z"))),
      lines: z.array(entry),
      ai: z
        .object({
          updatedAt: stamp,
          tz: z.enum(["local", "utc"]),
          total: amount,
          byAgent: z.record(z.string(), amount),
          projects: z.array(projectUsage),
        })
        .nullable()
        .default(null),
    }),
  ),
});
const vector = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);
const cvector = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);
const agentPayload = z.object({
  meta: z.object({
    title: z.string(),
    generatedAt: n,
    tz: z.string(),
    tzLabel: z.string(),
    countedRecords: n,
    droppedDuplicates: n,
    firstTs: n.nullable(),
    lastTs: n.nullable(),
    sessions: n,
  }),
  agents: z.record(
    z.string(),
    z.object({ label: z.string(), note: z.string() }),
  ),
  keys: z.array(z.string()),
  hours: z.record(
    z.string(),
    z.record(z.string(), z.record(z.string(), vector)),
  ),
  sessions: z.array(
    z.tuple([
      z.string(),
      z.string(),
      n,
      n,
      z.string(),
      z.string(),
      z.number(),
      z.number(),
      z.number(),
      z.number(),
      z.number(),
      z.number(),
      z.number(),
      z.number(),
    ]),
  ),
});
const claudePayload = z.object({
  meta: z.object({
    generatedAt: n,
    tz: z.string(),
    tzLabel: z.string(),
    dedupe: z.boolean(),
    rawRecords: n,
    countedRecords: n,
    duplicateRecords: n,
    partialRecords: n,
    inflation: n,
    firstTs: n.nullable(),
    lastTs: n.nullable(),
    sessions: n,
    unknownModels: z.array(z.string()),
  }),
  rates: z.record(
    z.string(),
    z.object({
      input: n,
      output: n,
      cacheRead: n,
      write5m: n,
      write1h: n,
      known: z.boolean(),
      label: z.string(),
    }),
  ),
  models: z.array(z.string()),
  hours: z.record(
    z.string(),
    z.record(z.string(), z.record(z.string(), cvector)),
  ),
  sessions: z.array(
    z.tuple([
      z.string(),
      n,
      n,
      n,
      n,
      n,
      n,
      n,
      n,
      z.string(),
      z.string(),
      z.string(),
    ]),
  ),
  appBasis: z.record(z.string(), cvector),
});
export const storedAi = z.object({
  generatedAt: stamp,
  combined: agentPayload.nullable(),
  claude: claudePayload.nullable(),
  agents: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      state: z.enum(["NotFound", "Disabled", "Empty", "Loaded", "Failed"]),
      records: n,
      elapsed: n,
      error: z.string().optional(),
    }),
  ),
});
export function legacyDuration(value: number | string): number {
  if (typeof value === "number") return value;
  const m = /^(?:(\d+)\.)?(\d+):(\d+):(\d+)(?:\.(\d+))?$/.exec(value);
  if (!m) throw new Error("Invalid legacy duration");
  return (
    ((Number(m[1] ?? 0) * 24 + Number(m[2])) * 3600 +
      Number(m[3]) * 60 +
      Number(m[4])) *
      1000 +
    Number("0." + (m[5] ?? 0)) * 1000
  );
}

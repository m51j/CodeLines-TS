import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import {
  projectSchema,
  scanOptionsSchema,
  aiOptionsSchema,
  historyOptionsSchema,
  type Settings,
  type DailyLog,
  type AppState,
  type Project,
  type AiResult,
} from "../shared/contracts";
import { defaults, upgradeExclusions } from "../domain/defaults";
import { projectMetrics, snapshot } from "../domain/metrics";
import {
  storedSnapshot,
  storedHistory,
  storedDaily,
  storedAi,
  legacyDuration,
} from "../shared/persisted";
import { finishGit } from "../domain/history";
import { gitTotals } from "../domain/history";
const object = z.record(z.string(), z.unknown());
export function parseSettings(value: unknown): Settings {
  const o = object.parse(value);
  if (o.schemaVersion !== undefined && o.schemaVersion !== 1)
    throw new Error("Unsupported settings schema version");
  const d = defaults();
  const s = {
    ...d,
    ...o,
    projects: z.array(projectSchema).parse(o.projects ?? []),
    scanOptions: scanOptionsSchema.parse({
      ...d.scanOptions,
      ...object.parse(o.scanOptions ?? {}),
      defaultExclusionsRevision:
        (o.scanOptions as Record<string, unknown> | undefined)
          ?.defaultExclusionsRevision ?? 0,
    }),
    aiUsage: aiOptionsSchema.parse({
      ...d.aiUsage,
      ...object.parse(o.aiUsage ?? {}),
    }),
    gitHistory: historyOptionsSchema.parse({
      ...d.gitHistory,
      ...object.parse(o.gitHistory ?? {}),
    }),
    dailyLog: z
      .object({ refreshAiAfterScan: z.boolean() })
      .parse({ ...d.dailyLog, ...object.parse(o.dailyLog ?? {}) }),
    theme: z.enum(["System", "Light", "Dark"]).parse(o.theme ?? "System"),
    schemaVersion: 1,
  } as Settings;
  if (s.lastSnapshot) {
    const old = storedSnapshot.parse(s.lastSnapshot);
    const projects = old.projects.map((p) => {
      const definition = {
        id: p.projectId,
        name: p.projectName,
        rootPath: p.rootPath,
        isEnabled: true,
        excludePatterns: [],
      };
      if (!Array.isArray(p.files)) throw new Error("Invalid snapshot files");
      return projectMetrics(
        definition,
        p.files,
        p.warnings ?? [],
        legacyDuration(p.duration),
      );
    });
    s.lastSnapshot = snapshot(
      projects,
      old.countingScope,
      old.tokenizerEncoding,
      old.scannedAt,
    );
  }
  if (s.lastGitHistory) {
    const h = storedHistory.parse(s.lastGitHistory);
    const projects = h.projects.map((p) =>
      finishGit({
        ...p,
        added: 0,
        deleted: 0,
        modifiedEstimate: 0,
        net: 0,
        changedFiles: 0,
        binaryFiles: 0,
      }),
    );
    s.lastGitHistory = { ...h, projects, totals: gitTotals(projects, h.mode) };
  }
  upgradeExclusions(s);
  return s;
}
export function parseDaily(value: unknown): DailyLog {
  return storedDaily.parse(value);
}
const queues = new Map<string, Promise<void>>();
export async function atomicWrite(file: string, value: unknown): Promise<void> {
  const bytes = JSON.stringify(value, null, 2);
  const previous = queues.get(file) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = file + "." + randomUUID() + ".tmp";
      try {
        const handle = await fs.open(tmp, "wx");
        try {
          await handle.writeFile(bytes, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        try {
          await fs.copyFile(file, file + ".bak");
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
        await fs.rename(tmp, file);
      } finally {
        await fs.rm(tmp, { force: true });
      }
    });
  queues.set(file, next);
  try {
    await next;
  } finally {
    if (queues.get(file) === next) queues.delete(file);
  }
}
export async function readRecover<T>(
  file: string,
  parse: (v: unknown) => T,
  fallback: () => T,
  warnings: string[],
): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback();
    throw e;
  }
  try {
    return parse(JSON.parse(raw));
  } catch (e) {
    const backup = file + ".invalid-" + Date.now() + "-" + randomUUID();
    await fs.copyFile(file, backup);
    warnings.push(
      `Recovered malformed ${path.basename(file)}; original saved at ${backup}: ${String(e)}`,
    );
    try {
      const recovered = parse(
        JSON.parse(await fs.readFile(file + ".bak", "utf8")),
      );
      warnings.push("Loaded the previous valid backup.");
      return recovered;
    } catch {
      return fallback();
    }
  }
}
export const normalizeProjectPath = (p: string) =>
  path
    .resolve(p.trim())
    .replace(/[\\/]+$/, "")
    .toLowerCase();
export function importProjectList(
  value: unknown,
  current: Project[],
): { projects: Project[]; added: number; duplicates: number } {
  const root = Array.isArray(value) ? value : object.parse(value).projects;
  if (!Array.isArray(root))
    throw new Error("The file does not contain a project list.");
  const projects = [...current];
  let added = 0,
    duplicates = 0;
  for (const item of root) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    if (typeof p.rootPath !== "string" || !p.rootPath.trim()) continue;
    const rootPath = path.resolve(p.rootPath.trim());
    if (
      projects.some(
        (x) =>
          normalizeProjectPath(x.rootPath) === normalizeProjectPath(rootPath),
      )
    ) {
      duplicates++;
      continue;
    }
    const project = projectSchema.parse({
      id: p.id ?? randomUUID(),
      name:
        typeof p.name === "string" && p.name.trim()
          ? p.name.trim()
          : path.basename(rootPath),
      rootPath,
      isEnabled: p.isEnabled ?? true,
      excludePatterns: p.excludePatterns ?? [],
    });
    if (
      project.id === "00000000-0000-0000-0000-000000000000" ||
      projects.some((x) => x.id === project.id)
    )
      project.id = randomUUID();
    projects.push(project);
    added++;
  }
  return { projects, added, duplicates };
}
export class Store {
  settings = defaults();
  daily: DailyLog = { version: 1, days: [] };
  ai: AiResult | null = null;
  warnings: string[] = [];
  private dailyReadFailed = false;
  constructor(readonly directory: string) {}
  async load() {
    this.settings = await readRecover(
      path.join(this.directory, "settings.json"),
      parseSettings,
      defaults,
      this.warnings,
    );
    try {
      this.daily = await readRecover(
        path.join(this.directory, "daily-log.json"),
        parseDaily,
        () => ({ version: 1, days: [] }),
        this.warnings,
      );
      this.dailyReadFailed = false;
    } catch (error) {
      this.dailyReadFailed = true;
      this.warnings.push(
        "Daily log could not be read; its file will be preserved until it can be read again. " +
          String(error),
      );
    }
    try {
      this.ai = await readRecover(
        path.join(this.directory, "ai-report.json"),
        (v) => storedAi.parse(v) as AiResult,
        () => null,
        this.warnings,
      );
    } catch (error) {
      // The report is regenerated from local logs, so an unreadable copy must not block startup.
      this.ai = null;
      this.warnings.push(
        "The saved AI report could not be read; refresh AI usage to rebuild it. " +
          String(error),
      );
    }
    return this.state();
  }
  state(): AppState {
    return structuredClone({
      settings: this.settings,
      daily: this.daily,
      ai: this.ai,
      warnings: this.warnings,
      dataDirectory: this.directory,
    });
  }
  async save() {
    await atomicWrite(
      path.join(this.directory, "settings.json"),
      this.settings,
    );
  }
  private assertDailyWritable() {
    if (this.dailyReadFailed)
      throw new Error(
        "The existing daily log was unreadable. Resolve access to daily-log.json and reopen the application before recording changes.",
      );
  }
  async saveDaily() {
    this.assertDailyWritable();
    await atomicWrite(path.join(this.directory, "daily-log.json"), this.daily);
  }
  async migrate(legacy: string) {
    // Migration writes settings and the daily log together; refuse before changing either.
    this.assertDailyWritable();
    const sources = ["settings.json", "daily-log.json"];
    const bytes = await Promise.all(
      sources.map(async (n) => {
        try {
          return await fs.readFile(path.join(legacy, n));
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw e;
        }
      }),
    );
    if (bytes.every((b) => !b))
      throw new Error("No legacy CodeLines data was found.");
    const hash = createHash("sha256");
    for (const b of bytes) if (b) hash.update(b);
    const fingerprint = hash.digest("hex");
    const manifest = path.join(this.directory, "migration.json");
    let migrated: string[] = [];
    try {
      migrated =
        JSON.parse(await fs.readFile(manifest, "utf8")).fingerprints ?? [];
    } catch {
      /* first migration */
    }
    if (migrated.includes(fingerprint)) {
      this.warnings.push("This legacy data has already been imported.");
      return this.state();
    }
    const incoming = bytes[0]
      ? parseSettings(JSON.parse(bytes[0].toString("utf8")))
      : null;
    const log = bytes[1]
      ? parseDaily(JSON.parse(bytes[1].toString("utf8")))
      : null;
    const recovery = path.join(
      this.directory,
      "migration-backups",
      new Date().toISOString().replaceAll(":", "-"),
    );
    await fs.mkdir(recovery, { recursive: true });
    await atomicWrite(
      path.join(recovery, "replacement-settings.json"),
      this.settings,
    );
    await atomicWrite(
      path.join(recovery, "replacement-daily.json"),
      this.daily,
    );
    for (let i = 0; i < sources.length; i++)
      if (bytes[i])
        await fs.writeFile(
          path.join(recovery, "legacy-" + sources[i]),
          bytes[i]!,
        );
    if (incoming) {
      const imported = importProjectList(
        incoming.projects,
        this.settings.projects,
      );
      // Match duplicate roots to the identity already in use; remap all imported references together.
      const ids = new Map(
        incoming.projects.map((p) => [
          p.id,
          imported.projects.find(
            (x) =>
              normalizeProjectPath(x.rootPath) ===
              normalizeProjectPath(p.rootPath),
          )!.id,
        ]),
      );
      for (const p of incoming.lastSnapshot?.projects ?? [])
        p.projectId = ids.get(p.projectId) ?? p.projectId;
      for (const p of incoming.lastGitHistory?.projects ?? [])
        p.projectId = ids.get(p.projectId) ?? p.projectId;
      for (const day of log?.days ?? []) {
        for (const line of day.lines)
          line.projectId = ids.get(line.projectId) ?? line.projectId;
        for (const p of day.ai?.projects ?? [])
          p.projectId = ids.get(p.projectId) ?? p.projectId;
      }
      const oldSnapshot = this.settings.lastSnapshot,
        newSnapshot = incoming.lastSnapshot;
      let mergedSnapshot = oldSnapshot ?? newSnapshot;
      if (
        oldSnapshot &&
        newSnapshot &&
        oldSnapshot.countingScope === newSnapshot.countingScope &&
        oldSnapshot.tokenizerEncoding === newSnapshot.tokenizerEncoding
      ) {
        const projects = [...oldSnapshot.projects];
        for (const p of newSnapshot.projects) {
          const index = projects.findIndex((x) => x.projectId === p.projectId);
          if (index < 0) projects.push(p);
          else if (
            Date.parse(newSnapshot.scannedAt) >
            Date.parse(oldSnapshot.scannedAt)
          )
            projects[index] = p;
        }
        mergedSnapshot = snapshot(
          projects,
          oldSnapshot.countingScope,
          oldSnapshot.tokenizerEncoding,
          Date.parse(oldSnapshot.scannedAt) > Date.parse(newSnapshot.scannedAt)
            ? oldSnapshot.scannedAt
            : newSnapshot.scannedAt,
        );
      }
      this.settings =
        this.settings.projects.length === 0
          ? incoming
          : {
              ...this.settings,
              projects: imported.projects,
              lastSnapshot: mergedSnapshot,
              lastGitHistory:
                this.settings.lastGitHistory ?? incoming.lastGitHistory,
            };
    }
    if (log) {
      for (const d of log.days) {
        const current = this.daily.days.find((x) => x.date === d.date);
        if (!current) this.daily.days.push(d);
        else {
          for (const e of d.lines) {
            const previous = current.lines.find(
              (x) => x.projectId === e.projectId,
            );
            if (
              !previous ||
              new Date(e.scannedAt) > new Date(previous.scannedAt)
            ) {
              current.lines = current.lines.filter(
                (x) => x.projectId !== e.projectId,
              );
              current.lines.push(e);
            }
          }
          if (
            d.ai &&
            (!current.ai || d.ai.total.tokens > current.ai.total.tokens)
          )
            current.ai = d.ai;
        }
      }
      this.daily.days.sort((a, b) => a.date.localeCompare(b.date));
    }
    await this.save();
    await this.saveDaily();
    await atomicWrite(manifest, {
      schemaVersion: 1,
      fingerprints: [...migrated, fingerprint],
      lastBackup: recovery,
    });
    this.warnings.push(
      "Legacy data imported. Originals are unchanged; recovery copies are in " +
        recovery,
    );
    return this.state();
  }
}

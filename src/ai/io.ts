import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { atomicWrite } from "../services/persistence";
import { cancelled } from "../services/scanner";
export async function exists(file: string): Promise<boolean> {
  try {
    await fs.lstat(file);
    return true;
  } catch {
    return false;
  }
}
export async function list(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).sort();
  } catch {
    return [];
  }
}
export async function walk(
  root: string,
  accept: (name: string) => boolean,
  signal?: AbortSignal,
): Promise<string[]> {
  const out: string[] = [],
    pending = [root];
  while (pending.length) {
    cancelled(signal);
    const dir = pending.pop()!;
    try {
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        if (e.isSymbolicLink()) continue;
        const f = path.join(dir, e.name);
        if (e.isDirectory()) pending.push(f);
        else if (e.isFile() && accept(e.name)) out.push(f);
      }
    } catch {
      /* unreadable roots do not hide the other sources */
    }
  }
  return out.sort();
}
export async function jsonLines<T>(
  file: string,
  parse: (line: string) => T | null,
  signal?: AbortSignal,
): Promise<T[]> {
  const out: T[] = [];
  const stream = createReadStream(file, { encoding: "utf8" });
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of reader) {
      cancelled(signal);
      try {
        const value = parse(line);
        if (value !== null) out.push(value);
      } catch {
        /* a malformed record is isolated */
      }
    }
  } catch (e) {
    cancelled(signal);
    if (
      (e as NodeJS.ErrnoException).code !== "ENOENT" &&
      (e as NodeJS.ErrnoException).code !== "EACCES"
    )
      throw e;
  } finally {
    reader.close();
    stream.destroy();
  }
  return out;
}
export async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}
interface Cache<T> {
  version: string;
  files: Record<
    string,
    { size: number; mtime: number; related?: number; records: T[] }
  >;
}
export async function cached<T>(
  files: string[],
  cacheFile: string,
  version: string,
  parse: (f: string) => Promise<T[]>,
  rescan: boolean,
  signal?: AbortSignal,
  progress?: (done: number, total: number) => void,
  related?: (f: string) => Promise<number>,
): Promise<T[]> {
  const previous = rescan
    ? null
    : ((await readJson(cacheFile)) as Cache<T> | null);
  const cache =
      previous?.version === version &&
      previous.files &&
      typeof previous.files === "object"
        ? previous
        : null,
    next: Cache<T> = { version, files: Object.create(null) },
    records: T[] = [];
  let done = 0;
  for (const f of files) {
    cancelled(signal);
    try {
      const stat = await fs.stat(f),
        extra = related ? await related(f) : undefined,
        hit = cache?.files[f];
      const entry =
        hit &&
        Array.isArray(hit.records) &&
        hit.size === stat.size &&
        hit.mtime === stat.mtimeMs &&
        hit.related === extra
          ? hit
          : {
              size: stat.size,
              mtime: stat.mtimeMs,
              related: extra,
              records: await parse(f),
            };
      next.files[f] = entry;
      for (const record of entry.records) records.push(record);
    } catch (e) {
      cancelled(signal);
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    done++;
    if (done % 25 === 0 || done === files.length)
      progress?.(done, files.length);
  }
  cancelled(signal);
  await atomicWrite(cacheFile, next);
  return records;
}
export type SqlRow = Record<
  string,
  string | number | bigint | Uint8Array | null
>;
export function rows(db: DatabaseSync, sql: string): SqlRow[] {
  const statement = db.prepare(sql);
  statement.setReadBigInts(true);
  return statement
    .all()
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          // Keep 64-bit IDs exact so distinct requests never collide as duplicates.
          typeof value === "bigint"
            ? value >= BigInt(Number.MIN_SAFE_INTEGER) &&
              value <= BigInt(Number.MAX_SAFE_INTEGER)
              ? Number(value)
              : String(value)
            : value,
        ]),
      ),
    ) as SqlRow[];
}
export const sqlText = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);
export function hasTable(db: DatabaseSync, table: string): boolean {
  return !!db
    .prepare("select 1 from sqlite_master where type='table' and name=?")
    .get(table);
}
export async function withDb<T>(
  file: string,
  temp: string,
  read: (db: DatabaseSync) => T,
): Promise<T> {
  let db: DatabaseSync | undefined, copyDir: string | undefined;
  try {
    try {
      db = new DatabaseSync(file, { readOnly: true, allowExtension: false });
      db.exec("PRAGMA query_only=ON");
      db.prepare("select count(*) from sqlite_master").get();
    } catch {
      db?.close();
      db = undefined;
      copyDir = path.join(temp, "sqlite-" + randomUUID());
      await fs.mkdir(copyDir, { recursive: true });
      const copy = path.join(copyDir, "source.db");
      await fs.copyFile(file, copy);
      for (const ext of ["-wal", "-shm"])
        if (await exists(file + ext)) await fs.copyFile(file + ext, copy + ext);
      db = new DatabaseSync(copy, { readOnly: true, allowExtension: false });
      db.exec("PRAGMA query_only=ON");
    }
    return read(db);
  } finally {
    db?.close();
    if (copyDir) await fs.rm(copyDir, { recursive: true, force: true });
  }
}

import fs from "node:fs/promises";
import path from "node:path";
import type {
  FileMetric,
  Lines,
  Project,
  ScanOptions,
} from "../shared/contracts";
import { classify, extension, type Language } from "../domain/languages";
import { analyzeLines } from "../domain/lines";
import { projectMetrics } from "../domain/metrics";
import { IgnoreProvider } from "./ignore";
import { countTokens } from "./tokenizer";
export const cancelled = (signal?: AbortSignal) => signal?.throwIfAborted();
export function tokenCount(
  text: string,
  encoding: ScanOptions["tokenizerEncoding"],
): number {
  return countTokens(text, encoding);
}
export function looksBinary(bytes: Uint8Array): boolean {
  if (
    bytes.length >= 2 &&
    ((bytes[0] === 255 && bytes[1] === 254) ||
      (bytes[0] === 254 && bytes[1] === 255))
  )
    return false;
  const sample = bytes.subarray(0, 8192);
  if (sample.includes(0)) return true;
  let controls = 0;
  for (const b of sample)
    if (b < 8 || b === 11 || b === 12 || (b >= 14 && b < 32)) controls++;
  return controls > Math.floor(sample.length / 20);
}
export function decode(bytes: Uint8Array): string {
  if (bytes[0] === 255 && bytes[1] === 254)
    return new TextDecoder("utf-16le", { ignoreBOM: true }).decode(
      bytes.subarray(2),
    );
  if (bytes[0] === 254 && bytes[1] === 255)
    return new TextDecoder("utf-16be", { ignoreBOM: true }).decode(
      bytes.subarray(2),
    );
  if (bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191)
    return new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      bytes.subarray(3),
    );
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
async function exists(file: string) {
  try {
    await fs.lstat(file);
    return true;
  } catch {
    return false;
  }
}
async function nuget(dir: string) {
  if (path.basename(dir).toLowerCase() !== "packages") return false;
  if (await exists(path.join(dir, "repositories.config"))) return true;
  try {
    for (const entry of await fs.readdir(dir, { withFileTypes: true }))
      if (
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        (await fs.readdir(path.join(dir, entry.name))).some((n) =>
          n.toLowerCase().endsWith(".nupkg"),
        )
      )
        return true;
  } catch {
    /* ordinary folders remain eligible */
  }
  return false;
}
const maxBufferedBytes = 512 * 1024 ** 2;
export type FileAnalysis =
  | { kind: "text"; bytes: number; tokens: number; lines: Lines }
  | { kind: "binary" }
  | { kind: "oversized" };
// The CPU-heavy part of a scan, kept free of shared state so worker threads
// can run it in parallel.
export async function analyzeFile(
  file: string,
  language: Language,
  options: Pick<ScanOptions, "maxFileSizeBytes" | "tokenizerEncoding">,
): Promise<FileAnalysis> {
  const bytes = await fs.readFile(file);
  if (bytes.length > options.maxFileSizeBytes) return { kind: "oversized" };
  if (looksBinary(bytes)) return { kind: "binary" };
  const text = decode(bytes);
  return {
    kind: "text",
    bytes: bytes.length,
    tokens: tokenCount(text, options.tokenizerEncoding),
    lines: analyzeLines(text, language),
  };
}
export type FileAnalyzer = (
  file: string,
  language: Language,
  options: ScanOptions,
) => Promise<FileAnalysis>;
export interface ScanUpdate {
  project: string;
  path: string;
  processed: number;
  discovered: number;
}
export async function scanProject(
  project: Project,
  options: ScanOptions,
  signal?: AbortSignal,
  progress?: (p: ScanUpdate) => void,
  analyze: FileAnalyzer = analyzeFile,
  workers = options.maxDegreeOfParallelism,
) {
  const start = performance.now(),
    warnings: string[] = [],
    files: FileMetric[] = [],
    candidates: {
      file: string;
      relative: string;
      bytes: number;
      language: Language;
    }[] = [],
    ignores = new IgnoreProvider();
  const pending = [path.resolve(project.rootPath)];
  while (pending.length) {
    cancelled(signal);
    const dir = pending.pop()!;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        cancelled(signal);
        const file = path.join(dir, e.name);
        if (e.isSymbolicLink()) continue;
        if (
          ignores.ignored(
            project.rootPath,
            file,
            e.isDirectory(),
            options.globalExcludePatterns,
            project.excludePatterns,
          )
        )
          continue;
        if (e.isDirectory()) {
          if (await exists(path.join(file, ".git"))) {
            warnings.push(`Skipped nested repository: ${file}`);
            continue;
          }
          if (await nuget(file)) {
            warnings.push(`Skipped NuGet packages folder: ${file}`);
            continue;
          }
          pending.push(file);
        } else if (e.isFile()) {
          const language = classify(file, options.countingScope);
          if (!language) continue;
          try {
            const stat = await fs.lstat(file);
            if (stat.isSymbolicLink()) continue;
            if (stat.size > options.maxFileSizeBytes) {
              warnings.push(`Skipped oversized file: ${file}`);
              continue;
            }
            candidates.push({
              file,
              relative: path.relative(project.rootPath, file),
              bytes: stat.size,
              language,
            });
          } catch (e) {
            warnings.push(`Skipped ${file}: ${String(e)}`);
          }
        }
      }
    } catch (e) {
      warnings.push(`Cannot enumerate ${dir}: ${String(e)}`);
    }
  }
  let next = 0,
    processed = 0;
  // Each reader holds up to one maximum-size file, so cap the readers to keep
  // buffered bytes bounded even with very large file-size limits.
  const readers = Math.min(
    workers,
    Math.max(1, Math.floor(maxBufferedBytes / options.maxFileSizeBytes)),
    candidates.length,
  );
  await Promise.all(
    Array.from({ length: readers }, async () => {
      while (next < candidates.length) {
        cancelled(signal);
        const c = candidates[next++];
        try {
          const result = await analyze(c.file, c.language, options);
          cancelled(signal);
          if (result.kind === "oversized") {
            warnings.push(`Skipped oversized file: ${c.file}`);
            continue;
          }
          if (result.kind === "binary") continue;
          files.push({
            projectName: project.name,
            relativePath: c.relative,
            extension: extension(c.file) || "[no extension]",
            language: c.language.name,
            category: c.language.category,
            bytes: result.bytes,
            tokens: result.tokens,
            lines: result.lines,
          });
        } catch (e) {
          cancelled(signal);
          warnings.push(`Skipped ${c.file}: ${String(e)}`);
        } finally {
          processed++;
          if (
            processed === 1 ||
            processed % 25 === 0 ||
            processed === candidates.length
          )
            progress?.({
              project: project.name,
              path: c.relative,
              processed,
              discovered: candidates.length,
            });
        }
      }
    }),
  );
  cancelled(signal);
  return projectMetrics(
    project,
    files.sort((a, b) => {
      const x = a.relativePath.toLowerCase(),
        y = b.relativePath.toLowerCase();
      return x < y ? -1 : x > y ? 1 : a.relativePath < b.relativePath ? -1 : 1;
    }),
    warnings.sort(),
    performance.now() - start,
  );
}

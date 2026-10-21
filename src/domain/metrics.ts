import type {
  FileMetric,
  Lines,
  Project,
  ProjectMetric,
  Snapshot,
  Scope,
  LanguageMetric,
  CategoryMetric,
} from "../shared/contracts";
export const lineKeys = [
  "physicalLines",
  "blankLines",
  "codeLines",
  "commentLines",
  "mixedLines",
  "contentLines",
] as const;
export const sum = <T>(items: T[], get: (v: T) => number): number =>
  items.reduce((n, v) => n + get(v), 0);
export function projectMetrics(
  project: Project,
  files: FileMetric[],
  warnings: string[] = [],
  duration = 0,
): ProjectMetric {
  const langs = new Map<string, LanguageMetric>();
  const cats = new Map<string, CategoryMetric>();
  for (const f of files) {
    let l = langs.get(f.language);
    if (!l) {
      l = {
        language: f.language,
        category: f.category,
        files: 0,
        bytes: 0,
        tokens: 0,
        physicalLines: 0,
        blankLines: 0,
        codeLines: 0,
        commentLines: 0,
        mixedLines: 0,
        contentLines: 0,
      };
      langs.set(f.language, l);
    }
    l.files++;
    l.bytes += f.bytes;
    l.tokens += f.tokens;
    for (const k of lineKeys) l[k] += f.lines[k];
    let c = cats.get(f.category);
    if (!c) {
      c = {
        category: f.category,
        files: 0,
        tokens: 0,
        physicalLines: 0,
        codeOrContentLines: 0,
      };
      cats.set(f.category, c);
    }
    c.files++;
    c.tokens += f.tokens;
    c.physicalLines += f.lines.physicalLines;
    c.codeOrContentLines += f.lines.codeLines + f.lines.contentLines;
  }
  const totals = Object.fromEntries(
    lineKeys.map((k) => [k, sum(files, (f) => f.lines[k])]),
  ) as unknown as Lines;
  return {
    projectId: project.id,
    projectName: project.name,
    rootPath: project.rootPath,
    files,
    languages: [...langs.values()].sort(
      (a, b) => b.codeLines + b.contentLines - a.codeLines - a.contentLines,
    ),
    categories: [...cats.values()],
    warnings,
    duration,
    fileCount: files.length,
    totalBytes: sum(files, (f) => f.bytes),
    totalTokens: sum(files, (f) => f.tokens),
    ...totals,
  };
}
export function snapshot(
  projects: ProjectMetric[],
  countingScope: Scope,
  tokenizerEncoding: string,
  scannedAt = new Date().toISOString(),
): Snapshot {
  return {
    projects,
    countingScope,
    tokenizerEncoding,
    scannedAt,
    fileCount: sum(projects, (p) => p.fileCount),
    totalTokens: sum(projects, (p) => p.totalTokens),
    physicalLines: sum(projects, (p) => p.physicalLines),
    codeLines: sum(projects, (p) => p.codeLines),
    contentLines: sum(projects, (p) => p.contentLines),
  };
}

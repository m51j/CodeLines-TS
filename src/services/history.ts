import { spawn } from "node:child_process";
import path from "node:path";
import type {
  GitFile,
  GitProject,
  HistoryOptions,
  Project,
  ScanOptions,
} from "../shared/contracts";
import { classify } from "../domain/languages";
import { IgnoreProvider, within, slash } from "./ignore";
import { cancelled } from "./scanner";
export interface HistoryUpdate {
  stage: string;
  completed: number;
  total: number | null;
  completedFiles?: number;
  totalFiles?: number;
  path?: string;
}
export function gitRun(
  directory: string,
  args: string[],
  signal?: AbortSignal,
  allowFailure = false,
  executable = "git",
): Promise<string> {
  cancelled(signal);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: directory,
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_OPTIONAL_LOCKS: "0",
        GIT_LITERAL_PATHSPECS: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end();
    const out: Buffer[] = [],
      err: Buffer[] = [];
    child.stdout.on("data", (b: Buffer) => out.push(b));
    child.stderr.on("data", (b: Buffer) => err.push(b));
    const abort = () => child.kill();
    signal?.addEventListener("abort", abort, { once: true });
    child.once("error", (e) => {
      signal?.removeEventListener("abort", abort);
      reject(e);
    });
    child.once("close", (code) => {
      signal?.removeEventListener("abort", abort);
      try {
        cancelled(signal);
        if (code !== 0 && !allowFailure)
          throw new Error(
            Buffer.concat(err).toString("utf8").trim() || `Git exited ${code}`,
          );
        resolve(code === 0 ? Buffer.concat(out).toString("utf8") : "");
      } catch (e) {
        reject(e);
      }
    });
  });
}
interface Entry {
  path: string;
  oldPath?: string;
  added: number;
  deleted: number;
  binary: boolean;
}
export function parseNumstat(output: string): Entry[] {
  const records = output.split("\0"),
    rows: Entry[] = [];
  for (let i = 0; i < records.length; i++) {
    if (!records[i]) continue;
    const match = /^([^\t]+)\t([^\t]+)\t([\s\S]*)$/.exec(records[i]);
    if (!match) throw new Error("Unexpected Git statistics format");
    let file = match[3],
      oldPath: string | undefined;
    if (!file) {
      oldPath = records[++i];
      file = records[++i];
      if (file === undefined) throw new Error("Incomplete rename statistics");
    }
    const binary = match[1] === "-" || match[2] === "-";
    rows.push({
      path: file,
      oldPath,
      added: binary ? 0 : Number(match[1]),
      deleted: binary ? 0 : Number(match[2]),
      binary,
    });
  }
  return rows;
}
export function estimateModified(patch: string): number {
  let total = 0,
    added = 0,
    deleted = 0,
    inHunk = false;
  const flush = () => {
    total += Math.min(added, deleted);
    added = deleted = 0;
  };
  for (const line of patch.split("\n")) {
    if (line.startsWith("@@ ")) {
      flush();
      inHunk = true;
    } else if (line.startsWith("diff --git ")) {
      flush();
      inHunk = false;
    } else if (inHunk && line.startsWith("+")) added++;
    else if (inHunk && line.startsWith("-")) deleted++;
    else if (!line.startsWith("\\ No newline")) flush();
  }
  flush();
  return total;
}
import { finishGit } from "../domain/history";
export { finishGit } from "../domain/history";
export { gitTotals } from "../domain/history";
export async function analyzeHistory(
  project: Project,
  scan: ScanOptions,
  options: HistoryOptions,
  end: Date,
  signal?: AbortSignal,
  progress?: (p: HistoryUpdate) => void,
  executable = "git",
): Promise<GitProject> {
  const result: GitProject = {
    projectId: project.id,
    projectName: project.name,
    branch: "",
    head: "",
    status: "Complete",
    isIncomplete: false,
    commits: null,
    files: [],
    added: 0,
    deleted: 0,
    modifiedEstimate: 0,
    net: 0,
    changedFiles: 0,
    binaryFiles: 0,
  };
  if (!options.enabled) {
    result.status = "Disabled";
    return result;
  }
  if (
    !Number.isInteger(options.days) ||
    options.days < 1 ||
    options.days > 36500
  )
    throw new Error("Choose 1–36500 days.");
  const run = (dir: string, args: string[], allow = false) =>
    gitRun(dir, args, signal, allow, executable);
  const report = (
    stage: string,
    completed = 0,
    total: number | null = null,
    extra: Partial<HistoryUpdate> = {},
  ) => progress?.({ stage, completed, total, ...extra });
  try {
    cancelled(signal);
    report("Opening repository");
    const start = end.getTime() - options.days * 86400000,
      root = (
        await run(project.rootPath, ["rev-parse", "--show-toplevel"])
      ).trim();
    result.branch = (
      await run(root, ["rev-parse", "--abbrev-ref", "HEAD"], true)
    ).trim();
    result.head = (
      await run(root, ["rev-parse", "--verify", "HEAD"], true)
    ).trim();
    if (!result.head) {
      result.status = "No commits";
      result.commits = options.mode === "Activity" ? 0 : null;
      report("No commits", 0, 0);
      return result;
    }
    if (result.branch === "HEAD")
      result.branch = "Detached " + result.head.slice(0, 8);
    result.isIncomplete =
      (await run(root, ["rev-parse", "--is-shallow-repository"])).trim() ===
      "true";
    if (result.isIncomplete)
      result.status = "Incomplete: shallow local history";
    report("Reading commit history");
    const commits = (
      await run(root, [
        "log",
        "--first-parent",
        "--format=%H %ct %P",
        result.head,
      ])
    )
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const p = l.trim().split(" ");
        return { hash: p[0], time: Number(p[1]) * 1000, parent: p[2] };
      });
    const emptyTree = (
      await run(root, ["hash-object", "-t", "tree", "--stdin"])
    ).trim();
    const changes = new Map<string, GitFile>(),
      ignores = new IgnoreProvider(),
      selected = commits.filter(
        (c) => c.time >= start && c.time <= end.getTime(),
      );
    result.commits = options.mode === "Activity" ? selected.length : null;
    const total = options.mode === "Activity" ? selected.length : 1;
    let completed = 0;
    report("Preparing comparisons", 0, total);
    const included = (p: string) => {
      cancelled(signal);
      const full = path.resolve(root, p);
      return (
        within(project.rootPath, full) &&
        classify(p, scan.countingScope) !== null &&
        !ignores.ignored(
          project.rootPath,
          full,
          false,
          scan.globalExcludePatterns,
          project.excludePatterns,
        )
      );
    };
    const flags = [
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
      "--diff-algorithm=myers",
    ];
    const accumulate = async (before: string, after: string) => {
      report("Reading changed files", completed, total, {
        path: after.slice(0, 8),
      });
      const output = await run(root, [
        "diff",
        "--numstat",
        "-z",
        "--find-renames=50%",
        ...flags,
        before,
        after,
        "--",
      ]);
      const entries: Entry[] = [];
      for (const e of parseNumstat(output)) {
        cancelled(signal);
        if (e.oldPath && included(e.path) !== included(e.oldPath))
          entries.push(
            ...parseNumstat(
              await run(root, [
                "diff",
                "--numstat",
                "-z",
                "--no-renames",
                ...flags,
                before,
                after,
                "--",
                e.oldPath,
                e.path,
              ]),
            ),
          );
        else entries.push(e);
      }
      const filtered = entries.filter(
        (e) => included(e.path) || (e.oldPath && included(e.oldPath)),
      );
      let done = 0;
      for (const e of filtered) {
        cancelled(signal);
        report("Analyzing files", completed, total, {
          completedFiles: done,
          totalFiles: filtered.length,
          path: e.path,
        });
        const modifiedEstimate =
          !e.binary && e.added > 0 && e.deleted > 0
            ? estimateModified(
                await run(root, [
                  "diff",
                  "--unified=0",
                  "--find-renames=50%",
                  ...flags,
                  before,
                  after,
                  "--",
                  e.path,
                  ...(e.oldPath ? [e.oldPath] : []),
                ]),
              )
            : 0;
        let relative = slash(
          path.relative(project.rootPath, path.join(root, e.path)),
        );
        if (relative.startsWith("../") && e.oldPath)
          relative = slash(
            path.relative(project.rootPath, path.join(root, e.oldPath)),
          );
        const prev = changes.get(relative);
        const added = (prev?.added ?? 0) + e.added,
          deleted = (prev?.deleted ?? 0) + e.deleted;
        changes.set(relative, {
          path: relative,
          added,
          deleted,
          modifiedEstimate: (prev?.modifiedEstimate ?? 0) + modifiedEstimate,
          binary: (prev?.binary ?? false) || e.binary,
          net: added - deleted,
        });
        report("Analyzing files", completed, total, {
          completedFiles: ++done,
          totalFiles: filtered.length,
          path: e.path,
        });
      }
    };
    if (options.mode === "Activity") {
      for (const c of selected) {
        cancelled(signal);
        if (result.isIncomplete && !c.parent) {
          result.status = "Incomplete: shallow boundary excluded";
          report("Shallow boundary excluded", ++completed, total);
          continue;
        }
        await accumulate(c.parent ?? emptyTree, c.hash);
        report("Comparison complete", ++completed, total);
      }
    } else {
      const baseline = commits.find((c) => c.time < start);
      if (!baseline && result.isIncomplete) {
        result.status =
          "Unavailable: period starts before available shallow history";
        return result;
      }
      await accumulate(baseline?.hash ?? emptyTree, result.head);
      completed = 1;
    }
    result.files = [...changes.values()].sort(
      (a, b) =>
        b.added + b.deleted - a.added - a.deleted ||
        a.path.localeCompare(b.path),
    );
    report("Project complete", completed, total);
    return finishGit(result);
  } catch (e) {
    cancelled(signal);
    result.status =
      "Unavailable: " + (e instanceof Error ? e.message : String(e));
    result.isIncomplete = true;
    return result;
  }
}

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  analyzeHistory,
  estimateModified,
  splitPatch,
  type HistoryUpdate,
} from "../src/services/history";
import { defaults } from "../src/domain/defaults";
import type { Project } from "../src/shared/contracts";
let root: string;
const end = new Date("2026-09-06T12:00:00Z");
const git = (args: string[], day?: number) => {
  const env = { ...process.env };
  if (day !== undefined) {
    env.GIT_AUTHOR_DATE = env.GIT_COMMITTER_DATE = new Date(
      end.getTime() + day * 86400000,
    ).toISOString();
  }
  const p = spawnSync("git", args, {
    cwd: root,
    env,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
  });
  if (p.status !== 0) throw new Error(p.stderr);
  return p.stdout;
};
const write = async (p: string, text: string | Buffer) => {
  const f = path.join(root, p);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, text);
};
const commit = (day: number) => {
  git(["add", "."]);
  git(["commit", "-m", "fixture"], day);
};
const project = (sub = ""): Project => ({
  id: randomUUID(),
  name: "Test",
  rootPath: path.join(root, sub),
  isEnabled: true,
  excludePatterns: [],
});
const analyze = (
  mode: "Activity" | "NetChange" = "Activity",
  days = 7,
  p = project(),
  progress?: (p: HistoryUpdate) => void,
) =>
  analyzeHistory(
    p,
    defaults().scanOptions,
    { enabled: true, days, mode },
    end,
    undefined,
    progress,
  );
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "codelines-ts-git-"));
  git(["init", "-b", "main"]);
  git(["config", "user.name", "Test"]);
  git(["config", "user.email", "test@example.invalid"]);
  git(["config", "core.autocrlf", "false"]);
  git(["config", "commit.gpgsign", "false"]);
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 3 });
});
describe("local first-parent history parity", () => {
  it("counts reverted activity but no net edits; ignores working files and reports stages", async () => {
    await write("a.cs", "one\ntwo\n");
    commit(-10);
    await write("a.cs", "one\nchanged\n");
    commit(-2);
    await write("a.cs", "one\ntwo\n");
    commit(-1);
    await write("a.cs", "uncommitted\n");
    const events: HistoryUpdate[] = [],
      activity = await analyze("Activity", 7, project(), (e) => events.push(e)),
      net = await analyze("NetChange");
    expect(activity).toMatchObject({
      added: 2,
      deleted: 2,
      modifiedEstimate: 2,
      commits: 2,
      status: "Complete",
    });
    expect(net.files).toEqual([]);
    expect(net.commits).toBeNull();
    expect(
      events.some(
        (e) => e.stage === "Reading commit history" && e.total === null,
      ),
    ).toBe(true);
    expect(events.at(-1)).toMatchObject({
      stage: "Project complete",
      completed: 2,
      total: 2,
    });
  });
  it("uses the empty tree for a new repository and includes the exact boundary", async () => {
    await write("a.cs", "one\ntwo\n");
    commit(-7);
    expect((await analyze()).added).toBe(2);
    expect((await analyze("NetChange")).added).toBe(2);
    expect((await analyze("Activity", 1)).files).toEqual([]);
  });
  it("preserves binary, Unicode, deletion and rename rows", async () => {
    await write("قديم.cs", "one\ntwo\nthree\nfour\n");
    await write("delete.cs", "delete\n");
    commit(-10);
    git(["mv", "قديم.cs", "جديد.cs"]);
    await fs.rm(path.join(root, "delete.cs"));
    await write("binary.cs", Buffer.from([0, 1, 2, 0]));
    commit(-1);
    const result = await analyze();
    expect(result).toMatchObject({
      added: 0,
      deleted: 1,
      changedFiles: 3,
      binaryFiles: 1,
    });
    expect(result.files.find((f) => f.path === "جديد.cs")).toMatchObject({
      added: 0,
      deleted: 0,
    });
  });
  it("filters current ignore and scope for deleted paths inside a repository subfolder", async () => {
    await write("sub/include.cs", "a\n");
    await write("sub/ignored.cs", "b\n");
    await write("sub/config.json", "{}\n");
    await write("outside.cs", "c\n");
    commit(-10);
    await fs.rm(path.join(root, "sub/include.cs"));
    await fs.rm(path.join(root, "sub/ignored.cs"));
    await write("sub/config.json", "{ }\n");
    await write("outside.cs", "d\n");
    commit(-1);
    await write("sub/.gitignore", "ignored.cs\n");
    const result = await analyze("Activity", 7, project("sub"));
    expect(result.files.map((f) => f.path)).toEqual(["include.cs"]);
    expect(result.deleted).toBe(1);
  });
  it("counts a full file entering scope and names detached HEAD", async () => {
    await write("outside.cs", "one\ntwo\n");
    commit(-10);
    await fs.mkdir(path.join(root, "sub"));
    git(["mv", "outside.cs", "sub/inside.cs"]);
    commit(-1);
    git(["checkout", "--detach"]);
    const result = await analyze("Activity", 7, project("sub"));
    expect(result.added).toBe(2);
    expect(result.branch).toMatch(/^Detached /);
  });
  it("counts a merge exactly once against its first parent", async () => {
    await write("base.cs", "base\n");
    commit(-10);
    git(["checkout", "-b", "feature"]);
    await write("feature.cs", "feature\n");
    commit(-3);
    git(["checkout", "main"]);
    await write("main.cs", "main\n");
    commit(-2);
    git(["merge", "--no-ff", "feature", "-m", "merge"], -1);
    expect(await analyze()).toMatchObject({ added: 2, commits: 2 });
  });
  it("reports missing Git, empty repositories and cancellation; validates days", async () => {
    expect((await analyze()).status).toBe("No commits");
    const failed = await analyzeHistory(
      project(),
      defaults().scanOptions,
      { enabled: true, days: 7, mode: "Activity" },
      end,
      undefined,
      undefined,
      "codelines-no-such-git-12345",
    );
    expect(failed.isIncomplete).toBe(true);
    expect(failed.status).toMatch(/^Unavailable:/);
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      analyzeHistory(
        project(),
        defaults().scanOptions,
        { enabled: true, days: 7, mode: "Activity" },
        end,
        aborted.signal,
      ),
    ).rejects.toThrow();
    await expect(analyze("Activity", 0)).rejects.toThrow();
  });
  it("never treats a shallow boundary as an entirely new tree", async () => {
    await write("a.cs", "one\n");
    commit(-10);
    await write("a.cs", "two\n");
    commit(-1);
    git([
      "clone",
      "--depth",
      "1",
      pathToFileURL(root + path.sep).href,
      path.join(root, "shallow"),
    ]);
    const activity = await analyze("Activity", 7, project("shallow")),
      net = await analyze("NetChange", 7, project("shallow"));
    expect(activity.isIncomplete).toBe(true);
    expect(activity.files).toEqual([]);
    expect(net.status).toMatch(/^Unavailable:/);
  });
  it("pairs adjacent replacements rather than separate hunks", () =>
    expect(
      estimateModified(
        "diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1 +1 @@\n---source\n+++source\n@@ -3,0 +3 @@\n+addition\n@@ -6 +6,0 @@\n-deletion\n",
      ),
    ).toBe(1));
  it("splits a whole-comparison patch by file, including spaced, quoted and deleted paths", () => {
    const sections = splitPatch(
      [
        "diff --git a/with space.sql b/with space.sql",
        "--- a/with space.sql\t",
        "+++ b/with space.sql\t",
        "@@ -1 +1 @@",
        "--- removed comment",
        "+++ added comment",
        'diff --git "a/caf\\303\\251 \\"q\\".ts" "b/caf\\303\\251 \\"q\\".ts"',
        '--- "a/caf\\303\\251 \\"q\\".ts"',
        '+++ "b/caf\\303\\251 \\"q\\".ts"',
        "@@ -2 +2 @@",
        "-x",
        "+y",
        "diff --git a/gone.sql b/gone.sql",
        "deleted file mode 100644",
        "--- a/gone.sql",
        "+++ /dev/null",
        "@@ -1 +0,0 @@",
        "--- only line",
      ].join("\n"),
    );
    expect([...sections.keys()]).toEqual([
      "with space.sql",
      'café "q".ts',
      "gone.sql",
    ]);
    expect(estimateModified(sections.get("with space.sql")!)).toBe(1);
    expect(estimateModified(sections.get('café "q".ts')!)).toBe(1);
  });
});

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { getEncoding } from "js-tiktoken";
import tokenGoldens from "./fixtures/token-counts.golden.json";
import { classify, languages } from "../src/domain/languages";
import { analyzeLines } from "../src/domain/lines";
import { defaults } from "../src/domain/defaults";
import { IgnoreProvider } from "../src/services/ignore";
import {
  scanProject,
  tokenCount,
  looksBinary,
  decode,
} from "../src/services/scanner";
import { AnalyzerPool } from "../src/services/pool";
import {
  Store,
  parseSettings,
  atomicWrite,
  importProjectList,
} from "../src/services/persistence";
const temp: string[] = [];
const root = async () => {
  const p = await fs.mkdtemp(path.join(os.tmpdir(), "codelines-ts-"));
  temp.push(p);
  return p;
};
afterEach(async () => {
  for (const p of temp.splice(0))
    await fs.rm(p, { recursive: true, force: true });
});
describe("classification and line semantics", () => {
  it("matches Microsoft.ML.Tokenizers 2.0.0 golden counts for Unicode, code, newlines and special-token text", () => {
    for (const r of tokenGoldens) {
      expect(tokenCount(r.text, "o200k_base"), r.text).toBe(r.o200k_base);
      expect(tokenCount(r.text, "cl100k_base"), r.text).toBe(r.cl100k_base);
    }
  });
  for (const [file, language] of [
    ["screen.tsx", "TypeScript"],
    ["view.xaml", "XAML"],
    ["main.dart", "Dart"],
    ["query.sql", "SQL"],
    ["native.cpp", "C/C++"],
    ["build.kts", "Kotlin"],
    ["Dockerfile", "Build Script"],
  ])
    it(`classifies ${file}`, () =>
      expect(classify(file, "SourceOnly")?.name).toBe(language));
  it("ports every registered language and all scopes", () => {
    expect(languages).toHaveLength(38);
    expect(classify("settings.json", "SourceOnly")).toBeNull();
    expect(classify("settings.json", "SourceAndConfiguration")?.category).toBe(
      "Configuration",
    );
    expect(classify("README.md", "SourceAndConfiguration")).toBeNull();
    expect(classify("unknown.ext", "AllText")?.name).toBe("Plain Text");
  });
  it("counts code, comment, mixed, blank and documentation lines", () => {
    expect(
      analyzeLines(
        "// header\n\nvar x = 1; // mixed\n/* block\ncontinued */\nreturn x;",
        classify("a.cs", "SourceOnly")!,
      ),
    ).toEqual({
      physicalLines: 6,
      blankLines: 1,
      codeLines: 2,
      commentLines: 3,
      mixedLines: 1,
      contentLines: 0,
    });
    expect(
      analyzeLines("Title\n\nParagraph\n", classify("readme.md", "AllText")!),
    ).toEqual({
      physicalLines: 3,
      blankLines: 1,
      codeLines: 0,
      commentLines: 0,
      mixedLines: 0,
      contentLines: 2,
    });
  });
  it("keeps comment markers inside quotes as code; final newline creates no phantom", () => {
    expect(
      analyzeLines(
        'var url = "https://example.com";\nvar text = "/* literal */";\n',
        classify("a.ts", "SourceOnly")!,
      ),
    ).toMatchObject({
      physicalLines: 2,
      codeLines: 2,
      commentLines: 0,
      mixedLines: 0,
    });
    expect(analyzeLines("", languages[0]).physicalLines).toBe(0);
    expect(analyzeLines("\r\n\r\n", languages[0]).blankLines).toBe(2);
  });
  it("counts Visual Basic apostrophe comments and Lua block comments", () => {
    const vb = classify("a.vb", "SourceOnly")!,
      lua = classify("a.lua", "SourceOnly")!;
    expect(
      analyzeLines("x = 1\n' a comment\ny = \"it's\" ' trailing\n", vb),
    ).toMatchObject({ codeLines: 2, commentLines: 1, mixedLines: 1 });
    expect(
      analyzeLines("--[[\nlocal x\n]]\nlocal y = 1 -- note\n-- line\n", lua),
    ).toMatchObject({ codeLines: 1, commentLines: 4, mixedLines: 1 });
  });
  it("handles UTF-8/UTF-16 BOMs, invalid UTF-8 and binary controls", () => {
    expect(decode(Buffer.from([239, 187, 191, 104, 105]))).toBe("hi");
    expect(decode(Buffer.from([255, 254, 104, 0, 105, 0]))).toBe("hi");
    expect(decode(Buffer.from([254, 255, 0, 104, 0, 105]))).toBe("hi");
    expect(() => decode(Buffer.from([255, 255]))).toThrow();
    expect(decode(Buffer.from([239, 187, 191, 255]))).toBe("\uFFFD");
    expect(decode(Buffer.from([255, 254, 255, 254, 104, 0]))).toBe("\uFEFFh");
    expect(looksBinary(Buffer.from([0, 1, 2]))).toBe(true);
    expect(looksBinary(Buffer.from([255, 254, 0, 0]))).toBe(false);
  });
  for (const encoding of ["o200k_base", "cl100k_base"] as const)
    it(`uses offline ${encoding} BPE`, () => {
      expect(tokenCount("hello", encoding)).toBe(1);
      expect(tokenCount("hello world", encoding)).toBe(2);
      expect(tokenCount("", encoding)).toBe(0);
      expect(tokenCount("<|endoftext|>", encoding)).toBe(1);
    });
  it("matches js-tiktoken's merges and stays fast on long unbroken runs", () => {
    const alphabet = "aAbB01 _-=+/\\\n\t\r.,;'\"<|>éمر日本語🙂\u200d";
    let seed = 7;
    const random = () =>
      (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (const encoding of ["o200k_base", "cl100k_base"] as const) {
      const reference = getEncoding(encoding);
      const texts = ["A".repeat(300), "ab".repeat(200), "=".repeat(300)];
      for (let k = 0; k < 300; k++)
        texts.push(
          Array.from(
            { length: Math.floor(random() * 120) },
            () => alphabet[Math.floor(random() * alphabet.length)],
          ).join(""),
        );
      for (const text of texts)
        expect(tokenCount(text, encoding), JSON.stringify(text)).toBe(
          reference.encode(text, "all", []).length,
        );
    }
    // js-tiktoken needs minutes for this; a scan must not stall on one file.
    const start = performance.now();
    expect(tokenCount("A".repeat(200_000), "o200k_base")).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});
describe("scanner and exclusions", () => {
  it("runs analyzers on a bounded pool and survives a crashed worker", async () => {
    const script = path.join(await root(), "analyzer.cjs");
    await fs.writeFile(
      script,
      `const { parentPort } = require("node:worker_threads");
      parentPort.on("message", ({ file }) => {
        if (file === "crash") process.exit(3);
        if (file === "missing")
          parentPort.postMessage({ error: { name: "Error", message: "ENOENT: missing" } });
        else
          setTimeout(() => parentPort.postMessage({ value: { kind: "binary" } }), 20);
      });`,
    );
    const pool = new AnalyzerPool(script, 2),
      language = classify("a.ts", "AllText")!,
      run = (file: string) =>
        pool.analyze(file, language, defaults().scanOptions);
    try {
      expect(await Promise.all(["a", "b", "c", "d", "e"].map(run))).toEqual(
        Array(5).fill({ kind: "binary" }),
      );
      await expect(run("crash")).rejects.toThrow("Analyzer exited (3)");
      expect(String(await run("missing").catch((e: unknown) => e))).toBe(
        "Error: ENOENT: missing",
      );
      expect(await run("after")).toEqual({ kind: "binary" });
    } finally {
      await pool.close();
    }
  });
  it("does not traverse a junction back to the project root", async () => {
    const p = await root();
    await fs.writeFile(path.join(p, "only.ts"), "export const value=1;");
    await fs.symlink(
      p,
      path.join(p, "loop"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const result = await scanProject(
      {
        id: randomUUID(),
        name: "Loop fixture",
        rootPath: p,
        isEnabled: true,
        excludePatterns: [],
      },
      defaults().scanOptions,
    );
    expect(result.fileCount).toBe(1);
  });
  it("applies ordered root/nested ignore, anchoring, glob and final project rules", async () => {
    const p = await root();
    await fs.mkdir(path.join(p, "src"));
    await fs.writeFile(path.join(p, ".gitignore"), "bin/\n*.tmp\n!keep.tmp\n");
    await fs.writeFile(path.join(p, "src", ".gitignore"), "/generated.cs\n");
    const ig = new IgnoreProvider(),
      ignored = (f: string, dir = false, project: string[] = []) =>
        ig.ignored(p, path.join(p, f), dir, [], project);
    expect(ignored("src/bin", true)).toBe(true);
    expect(ignored("cache.tmp")).toBe(true);
    expect(ignored("keep.tmp")).toBe(false);
    expect(ignored("src/generated.cs")).toBe(true);
    expect(ignored("generated.cs")).toBe(false);
    await fs.writeFile(path.join(p, "src", ".gitignore"), "blocked.cs\n");
    const nested = new IgnoreProvider();
    expect(nested.ignored(p, path.join(p, "blocked.cs"), false, [], [])).toBe(
      false,
    );
    expect(
      nested.ignored(p, path.join(p, "src", "blocked.cs"), false, [], []),
    ).toBe(true);
    expect(ignored("src/secret.cs", false, ["**/secret.cs"])).toBe(true);
    expect(ig.ignored(p, path.join(p, "..", "outside.cs"), false, [], [])).toBe(
      true,
    );
  });
  it("applies directory-only rules to directories and their contents, not same-named files", () => {
    const p = path.join(os.tmpdir(), "codelines-dir-only"),
      ig = new IgnoreProvider(),
      global = ["build/"],
      ignored = (f: string, dir = false) =>
        ig.ignored(p, path.join(p, f), dir, global, []);
    expect(ignored("build", true)).toBe(true);
    expect(ignored("src/build", true)).toBe(true);
    expect(ignored("src/build/out.js")).toBe(true);
    expect(ignored("build/deep/out.js")).toBe(true);
    expect(ignored("build")).toBe(false);
    expect(ignored("src/build")).toBe(false);
    expect(ignored("src/builder.js")).toBe(false);
  });
  it("scans all scopes, skips nested checkouts/NuGet, retains npm packages and reports progress", async () => {
    const p = await root();
    const write = async (f: string, c: string | Buffer) => {
      await fs.mkdir(path.dirname(path.join(p, f)), { recursive: true });
      await fs.writeFile(path.join(p, f), c);
    };
    await write(".gitignore", "ignored.cs\n");
    await write("Program.cs", "// comment\nvar answer = 42;\n");
    await write("settings.json", '{"enabled":true}');
    await write("README.md", "# Sample\n\nDocumentation");
    await write("ignored.cs", "ignored");
    await write("bin/generated.cs", "generated");
    await write("binary.unknown", Buffer.from([0, 1, 2]));
    await write("vendor/clone/.git", "gitdir: elsewhere");
    await write("vendor/clone/copy.cs", "class Copy{}");
    await write("packages/Foo.1.0/Foo.nupkg", "PK");
    await write("packages/Foo.1.0/content/a.cs", "class Ship{}");
    await write("studio/packages/core/index.ts", "export const answer = 42;\n");
    const project = {
      id: randomUUID(),
      name: "Fixture",
      rootPath: p,
      isEnabled: true,
      excludePatterns: [],
    };
    const options = defaults().scanOptions;
    const events: unknown[] = [];
    const source = await scanProject(project, options, undefined, (e) =>
      events.push(e),
    );
    expect(source.files.map((f) => f.relativePath)).toEqual([
      "Program.cs",
      path.join("studio", "packages", "core", "index.ts"),
    ]);
    expect(source.warnings.some((w) => w.includes("nested repository"))).toBe(
      true,
    );
    expect(source.warnings.some((w) => w.includes("NuGet"))).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(
      (
        await scanProject(project, {
          ...options,
          countingScope: "SourceAndConfiguration",
        })
      ).fileCount,
    ).toBe(3);
    expect(
      (await scanProject(project, { ...options, countingScope: "AllText" }))
        .fileCount,
    ).toBe(5);
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      scanProject(project, options, cancelled.signal),
    ).rejects.toThrow();
    const tiny = await scanProject(project, {
      ...options,
      maxFileSizeBytes: 1,
    });
    expect(tiny.fileCount).toBe(0);
    expect(tiny.warnings.some((w) => w.includes("oversized"))).toBe(true);
  });
});
describe("persistence compatibility and recovery", () => {
  it("upgrades exclusions once, retaining user removals and additions", () => {
    const s = parseSettings({
      scanOptions: {
        globalExcludePatterns: [".git/", "bin/", "packages/", "vendor/"],
      },
    });
    expect(s.scanOptions.globalExcludePatterns).toEqual([
      ".git/",
      "bin/",
      "vendor/",
      ".claude/worktrees/",
      ".kilo/worktrees/",
    ]);
    s.scanOptions.globalExcludePatterns.pop();
    expect(parseSettings(s).scanOptions.globalExcludePatterns).not.toContain(
      ".kilo/worktrees/",
    );
  });
  it("imports portable, bare-array and settings projects without duplicate paths or IDs", () => {
    const id = randomUUID(),
      p = {
        id,
        name: "Mine",
        rootPath: "C:\\repo",
        isEnabled: true,
        excludePatterns: [],
      };
    const incoming = importProjectList(
      {
        projects: [
          { ...p, rootPath: "C:\\repo\\" },
          { id, rootPath: "D:\\other" },
        ],
      },
      [p],
    );
    expect(incoming.added).toBe(1);
    expect(incoming.duplicates).toBe(1);
    expect(incoming.projects[1].name).toBe("other");
    expect(incoming.projects[1].id).not.toBe(id);
    expect(() => importProjectList({ theme: "Dark" }, [])).toThrow();
  });
  it("starts without the AI report when its file cannot be read", async () => {
    const p = await root();
    // A directory in the file's place makes every read fail with a non-ENOENT error.
    await fs.mkdir(path.join(p, "ai-report.json"));
    const state = await new Store(p).load();
    expect(state.ai).toBeNull();
    expect(state.warnings.join()).toContain("AI report could not be read");
  });
  it("serializes atomic saves and recovers corrupt data without losing originals", async () => {
    const p = await root(),
      store = new Store(p);
    await store.load();
    store.settings.theme = "Dark";
    await store.save();
    store.settings.theme = "Light";
    await store.save();
    await fs.writeFile(path.join(p, "settings.json"), "{ malformed");
    const recovered = await new Store(p).load();
    expect(recovered.settings.theme).toBe("Dark");
    expect(recovered.warnings.join()).toContain("previous valid backup");
    expect((await fs.readdir(p)).some((n) => n.includes(".invalid-"))).toBe(
      true,
    );
    await Promise.all([
      atomicWrite(path.join(p, "ordered.json"), { n: 1 }),
      atomicWrite(path.join(p, "ordered.json"), { n: 2 }),
    ]);
    expect(
      JSON.parse(await fs.readFile(path.join(p, "ordered.json"), "utf8")),
    ).toEqual({ n: 2 });
  });
  it("migrates settings, snapshots, history and daily data idempotently without modifying legacy bytes", async () => {
    const p = await root(),
      legacy = path.join(p, "legacy"),
      replacement = path.join(p, "new");
    await fs.mkdir(legacy);
    const s = defaults();
    s.theme = "Dark";
    const raw = JSON.stringify(s),
      log = JSON.stringify({
        version: 1,
        days: [{ date: "2026-09-21", lines: [], ai: null }],
      });
    await fs.writeFile(path.join(legacy, "settings.json"), raw);
    await fs.writeFile(path.join(legacy, "daily-log.json"), log);
    const store = new Store(replacement);
    await store.load();
    await store.migrate(legacy);
    await store.migrate(legacy);
    expect(store.settings.theme).toBe("Dark");
    expect(store.daily.days).toHaveLength(1);
    expect(await fs.readFile(path.join(legacy, "settings.json"), "utf8")).toBe(
      raw,
    );
    expect(await fs.readFile(path.join(legacy, "daily-log.json"), "utf8")).toBe(
      log,
    );
    expect(store.warnings.join()).toContain("already been imported");
  });
});

import type { Settings } from "../shared/contracts";
export const defaultExclusions = [
  ".git/",
  ".vs/",
  ".idea/",
  "bin/",
  "obj/",
  "node_modules/",
  "dist/",
  "dist-ssr/",
  "build/",
  "target/",
  ".dart_tool/",
  "coverage/",
  "publish/",
  "Releases/",
  "TestResults/",
  "playwright-report/",
  "test-results/",
  "artifacts/",
  ".next/",
  "out/",
  ".claude/worktrees/",
  ".kilo/worktrees/",
];
export function defaults(): Settings {
  return {
    schemaVersion: 1,
    projects: [],
    scanOptions: {
      countingScope: "SourceOnly",
      tokenizerEncoding: "o200k_base",
      maxFileSizeBytes: 5 * 1024 ** 2,
      maxDegreeOfParallelism: 4,
      globalExcludePatterns: [...defaultExclusions],
      defaultExclusionsRevision: 1,
    },
    theme: "System",
    lastSnapshot: null,
    gitHistory: { enabled: false, days: 7, mode: "Activity" },
    lastGitHistory: null,
    aiUsage: {
      enabled: true,
      useUtc: false,
      deduplicate: true,
      autoRefreshOnOpen: true,
      disabledAgents: [],
      extraClaudeRoots: [],
    },
    dailyLog: { refreshAiAfterScan: true },
  };
}
export function upgradeExclusions(settings: Settings): void {
  const s = settings.scanOptions;
  if (s.defaultExclusionsRevision < 1) {
    s.globalExcludePatterns = s.globalExcludePatterns.filter(
      (p) => p.trim().toLowerCase() !== "packages/",
    );
    for (const p of [".claude/worktrees/", ".kilo/worktrees/"])
      if (!s.globalExcludePatterns.some((x) => x.toLowerCase() === p))
        s.globalExcludePatterns.push(p);
  }
  s.defaultExclusionsRevision = 1;
}

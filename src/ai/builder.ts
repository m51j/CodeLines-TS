import path from "node:path";
import type { AiOptions, AiResult } from "../shared/contracts";
import { adapters, type AgentEnvironment } from "./adapters";
import { agentLabels } from "../shared/agents";
import { walk, cached, jsonLines, exists } from "./io";
import { parseClaudeLine } from "./claude";
import {
  aggregateAgents,
  aggregateClaude,
  fromClaude,
  type AgentSource,
} from "./aggregate";
import { cancelled } from "../services/scanner";
export async function buildAi(
  env: AgentEnvironment,
  options: AiOptions,
  rescan: boolean,
  signal?: AbortSignal,
  progress?: (stage: string, done?: number, total?: number) => void,
): Promise<AiResult> {
  const result: AiResult = {
      generatedAt: new Date().toISOString(),
      combined: null,
      claude: null,
      agents: [],
    },
    sources: AgentSource[] = [];
  const disabled = new Set(options.disabledAgents.map((x) => x.toLowerCase()));
  const roots = [
    path.join(env.home, ".claude", "projects"),
    ...options.extraClaudeRoots,
  ];
  const started = performance.now();
  if (disabled.has("claude"))
    result.agents.push({
      id: "claude",
      label: agentLabels.claude,
      state: "Disabled",
      records: 0,
      elapsed: 0,
    });
  else if (!(await Promise.all(roots.map(exists))).some(Boolean))
    result.agents.push({
      id: "claude",
      label: agentLabels.claude,
      state: "NotFound",
      records: 0,
      elapsed: 0,
    });
  else {
    progress?.("Scanning Claude Code transcripts");
    try {
      const files = [
        ...new Set(
          (
            await Promise.all(
              roots.map((root) =>
                walk(root, (n) => n.endsWith(".jsonl"), signal),
              ),
            )
          ).flat(),
        ),
      ].sort();
      const records = await cached(
        files,
        path.join(env.cache, "claude.json"),
        "ts-claude-2",
        (f) => jsonLines(f, parseClaudeLine, signal),
        rescan,
        signal,
        (done, total) =>
          progress?.("Reading Claude Code transcripts", done, total),
      );
      result.claude = aggregateClaude(
        records,
        options.useUtc,
        options.deduplicate,
      );
      sources.push({
        id: "claude",
        label: agentLabels.claude,
        records: fromClaude(records),
      });
      result.agents.push({
        id: "claude",
        label: agentLabels.claude,
        state: records.length ? "Loaded" : "Empty",
        records: records.length,
        elapsed: performance.now() - started,
      });
    } catch (e) {
      cancelled(signal);
      result.agents.push({
        id: "claude",
        label: agentLabels.claude,
        state: "Failed",
        records: 0,
        error: String(e),
        elapsed: performance.now() - started,
      });
    }
  }
  for (const adapter of adapters(env)) {
    cancelled(signal);
    const start = performance.now();
    if (disabled.has(adapter.id)) {
      result.agents.push({
        id: adapter.id,
        label: adapter.label,
        state: "Disabled",
        records: 0,
        elapsed: 0,
      });
      continue;
    }
    if (!(await adapter.detect())) {
      result.agents.push({
        id: adapter.id,
        label: adapter.label,
        state: "NotFound",
        records: 0,
        elapsed: 0,
      });
      continue;
    }
    progress?.("Reading " + adapter.label);
    try {
      const records = await adapter.load(rescan, signal);
      if (records.length)
        sources.push({
          id: adapter.id,
          label: adapter.label,
          note: adapter.note,
          records,
        });
      result.agents.push({
        id: adapter.id,
        label: adapter.label,
        state: records.length ? "Loaded" : "Empty",
        records: records.length,
        elapsed: performance.now() - start,
      });
    } catch (e) {
      cancelled(signal);
      result.agents.push({
        id: adapter.id,
        label: adapter.label,
        state: "Failed",
        records: 0,
        error: String(e),
        elapsed: performance.now() - start,
      });
    }
  }
  cancelled(signal);
  progress?.("Combining all agents");
  if (sources.length)
    result.combined = aggregateAgents(sources, "All agents", options.useUtc);
  return result;
}

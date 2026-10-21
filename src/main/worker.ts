import { parentPort, workerData } from "node:worker_threads";
import type {
  Settings,
  OperationKind,
  Progress,
  AiResult,
  GitProject,
} from "../shared/contracts";
import { scanProject } from "../services/scanner";
import { analyzeHistory, gitTotals } from "../services/history";
import { buildAi } from "../ai/builder";
import type { AgentEnvironment } from "../ai/adapters";
interface Work {
  id: string;
  kind: OperationKind;
  settings: Settings;
  projectId?: string;
  rescan?: boolean;
  environment: AgentEnvironment;
}
const work = workerData as Work,
  controller = new AbortController(),
  signal = controller.signal,
  start = performance.now();
parentPort?.on("message", (m) => {
  if (m === "cancel") controller.abort();
});
let latest: Progress = {
  id: work.id,
  kind: work.kind,
  stage: "Discovering work",
  completed: 0,
  total: null,
  elapsed: 0,
};
const update = (value: Partial<Progress>) => {
  latest = { ...latest, ...value, elapsed: performance.now() - start };
};
const timer = setInterval(
  () => parentPort?.postMessage({ type: "progress", value: latest }),
  250,
);
async function execute() {
  try {
    const projects = work.projectId
      ? work.settings.projects.filter((p) => p.id === work.projectId)
      : work.settings.projects.filter((p) => p.isEnabled);
    if (work.projectId && !projects.length)
      throw new Error("Project no longer exists.");
    if (work.kind === "scan") {
      if (!projects.length)
        throw new Error("No enabled projects. Add or enable a project first.");
      const results = [];
      for (let i = 0; i < projects.length; i++) {
        update({
          project: projects[i].name,
          projectIndex: i,
          projectCount: projects.length,
          completed: 0,
          total: null,
        });
        results.push(
          await scanProject(
            projects[i],
            work.settings.scanOptions,
            signal,
            (p) =>
              update({
                stage: "Analyzing files",
                path: p.path,
                completed: p.processed,
                total: p.discovered,
              }),
          ),
        );
      }
      parentPort?.postMessage({ type: "result", value: { projects: results } });
    } else if (work.kind === "history") {
      if (!projects.length)
        throw new Error("No enabled projects. Add or enable a project first.");
      const end = new Date(),
        results: GitProject[] = [];
      for (let i = 0; i < projects.length; i++) {
        const projectStart = performance.now();
        update({
          project: projects[i].name,
          projectIndex: i,
          projectCount: projects.length,
          completed: 0,
          total: null,
          partial: [...results],
        });
        const tick = setInterval(
          () => update({ projectElapsed: performance.now() - projectStart }),
          250,
        );
        try {
          results.push(
            await analyzeHistory(
              projects[i],
              work.settings.scanOptions,
              work.settings.gitHistory,
              end,
              signal,
              (p) => {
                const fraction = p.total
                  ? (p.completed +
                      (p.totalFiles
                        ? (p.completedFiles ?? 0) / p.totalFiles
                        : 0)) /
                    p.total
                  : 0;
                update({
                  stage: p.stage,
                  completed: p.completed,
                  total: p.total,
                  path: p.path,
                  completedFiles: p.completedFiles,
                  totalFiles: p.totalFiles,
                  projectElapsed: performance.now() - projectStart,
                  eta:
                    p.completed >= 2 && fraction > 0 && fraction < 1
                      ? ((performance.now() - projectStart) * (1 - fraction)) /
                        fraction
                      : undefined,
                });
              },
            ),
          );
        } finally {
          clearInterval(tick);
        }
        update({ partial: [...results] });
      }
      parentPort?.postMessage({
        type: "result",
        value: {
          history: {
            end: end.toISOString(),
            start: new Date(
              end.getTime() - work.settings.gitHistory.days * 86400000,
            ).toISOString(),
            mode: work.settings.gitHistory.mode,
            scope: work.settings.scanOptions.countingScope,
            projects: results,
            totals: gitTotals(results, work.settings.gitHistory.mode),
          },
        },
      });
    } else {
      const ai: AiResult = await buildAi(
        work.environment,
        work.settings.aiUsage,
        !!work.rescan,
        signal,
        (stage, done, total) =>
          update({ stage, completed: done ?? 0, total: total ?? null }),
      );
      parentPort?.postMessage({ type: "result", value: { ai } });
    }
  } catch (e) {
    parentPort?.postMessage({
      type: "error",
      message: e instanceof Error ? e.message : String(e),
    });
  } finally {
    clearInterval(timer);
    parentPort?.close();
  }
}
void execute();

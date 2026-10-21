import { app, BrowserWindow, ipcMain, dialog, shell, session } from "electron";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { z } from "zod";
import {
  Store,
  parseSettings,
  importProjectList,
  atomicWrite,
} from "../services/persistence";
import { snapshot } from "../domain/metrics";
import { recordLines, recordAi } from "../domain/daily";
import {
  analysisCsv,
  historyCsv,
  dailyCsv,
  reportHtml,
} from "../services/exports";
import type {
  Settings,
  OperationResult,
  Progress,
  AiResult,
  ProjectMetric,
  HistorySnapshot,
  GitProject,
} from "../shared/contracts";
let window: BrowserWindow;
let store: Store;
const active = new Map<
  string,
  { worker: Worker; kind: string; cancelled: boolean; partial: GitProject[] }
>();
const reservedLanes = new Set<string>();
let mutationInProgress = false;
const mutationChannels = new Set(["save", "add", "import", "migrate"]);
const operationSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["scan", "history", "ai"]),
  projectId: z.uuid().optional(),
  rescan: z.boolean().optional(),
  settings: z.unknown(),
});
const entry = path.join(__dirname, "renderer", "index.html");
function checkSender(event: Electron.IpcMainInvokeEvent) {
  const url = event.senderFrame?.url;
  if (
    event.sender !== window.webContents ||
    !url ||
    url !== (process.env.CODELINES_DEV_URL ?? pathToFileURL(entry).href)
  )
    throw new Error("Untrusted desktop request");
}
const handle = (channel: string, handler: (...args: unknown[]) => unknown) =>
  ipcMain.handle("codelines:" + channel, async (event, ...args: unknown[]) => {
    checkSender(event);
    const mutating = mutationChannels.has(channel);
    let acquired = false;
    try {
      if (mutating) {
        if (mutationInProgress)
          throw new Error("Another change is being saved. Please wait.");
        mutationInProgress = true;
        acquired = true;
      }
      return { ok: true, value: await handler(...args) };
    } catch (error) {
      return {
        ok: false,
        error: {
          code:
            error instanceof z.ZodError ? "INVALID_INPUT" : "REQUEST_FAILED",
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
        },
      };
    } finally {
      if (acquired) mutationInProgress = false;
    }
  });
function editorSettings(raw: unknown): Settings {
  const input = z.record(z.string(), z.unknown()).parse(raw);
  return parseSettings({
    ...input,
    lastSnapshot: store.settings.lastSnapshot,
    lastGitHistory: store.settings.lastGitHistory,
  });
}
function assertIdle() {
  if (active.size || reservedLanes.size)
    throw new Error(
      "Wait for the current operation or cancel it before changing settings.",
    );
}
function localNow(): string {
  const d = new Date(),
    offset = -d.getTimezoneOffset(),
    a = Math.abs(offset);
  return (
    new Date(d.getTime() + offset * 60000).toISOString().slice(0, -1) +
    (offset < 0 ? "-" : "+") +
    String(Math.floor(a / 60)).padStart(2, "0") +
    ":" +
    String(a % 60).padStart(2, "0")
  );
}
async function run(raw: unknown): Promise<OperationResult> {
  if (mutationInProgress)
    throw new Error(
      "Wait for the current settings or project change to finish.",
    );
  const request = operationSchema.parse(raw),
    settings = editorSettings(request.settings);
  const lane = request.kind === "ai" ? "ai" : "analysis";
  if (reservedLanes.has(lane))
    throw new Error("A conflicting operation is already running.");
  if (
    active.has(request.id) ||
    [...active.values()].some(
      (a) => (a.kind === "ai") === (request.kind === "ai"),
    )
  )
    throw new Error("A conflicting operation is already running.");
  if (request.kind === "history" && !settings.gitHistory.enabled)
    throw new Error("Git history is disabled.");
  if (request.kind === "ai" && !settings.aiUsage.enabled)
    throw new Error("AI usage is disabled.");
  reservedLanes.add(lane);
  if (request.kind === "history") settings.lastGitHistory = null;
  store.settings = settings;
  try {
    await store.save();
  } catch (error) {
    reservedLanes.delete(lane);
    throw error;
  }
  const worker = new Worker(path.join(__dirname, "worker.cjs"), {
    workerData: {
      ...request,
      settings,
      environment: {
        home: process.env.CODELINES_AGENT_HOME ?? os.homedir(),
        appData: process.env.CODELINES_AGENT_APPDATA ?? app.getPath("appData"),
        localAppData:
          process.env.CODELINES_AGENT_LOCALAPPDATA ??
          process.env.LOCALAPPDATA ??
          app.getPath("userData"),
        cache: path.join(store.directory, "ai-usage", "cache"),
        temp: path.join(store.directory, "ai-usage", "temp"),
      },
    },
  });
  const operation = {
    worker,
    kind: request.kind,
    cancelled: false,
    partial: [] as GitProject[],
  };
  active.set(request.id, operation);
  return new Promise((resolve) => {
    let settled = false;
    let receivedResult = false;
    const finish = (status: OperationResult["status"], error?: string) => {
      if (settled) return;
      settled = true;
      active.delete(request.id);
      reservedLanes.delete(lane);
      void worker.terminate();
      resolve({
        id: request.id,
        status,
        state: store.state(),
        error,
        failure:
          status === "failed"
            ? {
                code: "OPERATION_FAILED",
                message: error ?? "Operation failed",
                recoverable: true,
              }
            : undefined,
        partial: operation.partial,
      });
    };
    worker.on(
      "message",
      async (message: {
        type: string;
        value?:
          | {
              projects?: ProjectMetric[];
              history?: HistorySnapshot;
              ai?: AiResult;
            }
          | Progress;
        message?: string;
      }) => {
        if (operation.cancelled || settled) return;
        if (message.type === "progress") {
          const p = message.value as Progress;
          operation.partial = p.partial ?? operation.partial;
          if (!window.isDestroyed())
            window.webContents.send("codelines:progress", p);
          return;
        }
        if (message.type === "error") {
          finish("failed", message.message);
          return;
        }
        if (message.type === "result") {
          receivedResult = true;
          try {
            const value = message.value as {
              projects?: ProjectMetric[];
              history?: HistorySnapshot;
              ai?: AiResult;
            };
            if (value.projects) {
              const contract =
                store.settings.lastSnapshot?.countingScope ===
                  settings.scanOptions.countingScope &&
                store.settings.lastSnapshot?.tokenizerEncoding ===
                  settings.scanOptions.tokenizerEncoding;
              const prior =
                request.projectId && contract
                  ? store.settings.lastSnapshot!.projects.filter(
                      (p) => p.projectId !== request.projectId,
                    )
                  : [];
              const merged = [...prior, ...value.projects].sort(
                (a, b) =>
                  settings.projects.findIndex((p) => p.id === a.projectId) -
                  settings.projects.findIndex((p) => p.id === b.projectId),
              );
              store.settings.lastSnapshot = snapshot(
                merged,
                settings.scanOptions.countingScope,
                settings.scanOptions.tokenizerEncoding,
              );
              recordLines(
                store.daily,
                value.projects,
                settings.scanOptions.countingScope,
                settings.scanOptions.tokenizerEncoding,
                localNow(),
              );
              try {
                await store.saveDaily();
              } catch (e) {
                store.warnings.push(
                  "Scan complete; daily log could not be saved: " + String(e),
                );
              }
            }
            if (value.history) store.settings.lastGitHistory = value.history;
            if (value.ai) {
              store.ai = value.ai;
              await atomicWrite(
                path.join(store.directory, "ai-report.json"),
                store.ai,
              );
              if (value.ai.combined) {
                recordAi(
                  store.daily,
                  value.ai.combined,
                  store.settings.projects,
                );
                try {
                  await store.saveDaily();
                } catch (e) {
                  store.warnings.push(
                    "AI report complete; daily log could not be saved: " +
                      String(e),
                  );
                }
              }
            }
            await store.save();
            finish("completed");
          } catch (e) {
            finish("failed", String(e));
          }
        }
      },
    );
    worker.on("error", (e) => finish("failed", e.message));
    worker.on("exit", (code) => {
      if (!settled && !receivedResult)
        finish(
          operation.cancelled ? "cancelled" : "failed",
          operation.cancelled
            ? undefined
            : `Worker exited before returning results (${code})`,
        );
    });
  });
}
async function standalone(): Promise<string> {
  if (!store.ai?.combined)
    throw new Error("Refresh AI usage before exporting.");
  const [script, css] = await Promise.all([
    fs.readFile(path.join(__dirname, "report.js"), "utf8"),
    fs.readFile(path.join(__dirname, "report.css"), "utf8"),
  ]);
  return reportHtml(store.ai, script, css);
}
async function setup() {
  store = new Store(
    process.env.CODELINES_DATA_DIR ??
      path.join(
        process.env.LOCALAPPDATA ?? app.getPath("userData"),
        "CodeLines-TS",
      ),
  );
  await store.load();
  handle("load", () => store.state());
  handle("save", async (value) => {
    assertIdle();
    const next = editorSettings(value);
    const historyChanged =
      JSON.stringify([
        next.projects,
        next.scanOptions.countingScope,
        next.scanOptions.globalExcludePatterns,
        next.gitHistory,
      ]) !==
      JSON.stringify([
        store.settings.projects,
        store.settings.scanOptions.countingScope,
        store.settings.scanOptions.globalExcludePatterns,
        store.settings.gitHistory,
      ]);
    if (historyChanged) next.lastGitHistory = null;
    store.settings = next;
    await store.save();
    return store.state();
  });
  handle("add", async () => {
    assertIdle();
    const selected = await dialog.showOpenDialog(window, {
      title: "Select a source project folder",
      properties: ["openDirectory"],
    });
    if (selected.canceled) return store.state();
    const p = selected.filePaths[0];
    const result = importProjectList(
      [
        {
          id: randomUUID(),
          name: path.basename(p),
          rootPath: p,
          isEnabled: true,
          excludePatterns: [],
        },
      ],
      store.settings.projects,
    );
    store.settings.projects = result.projects;
    if (result.added) store.settings.lastGitHistory = null;
    await store.save();
    return store.state();
  });
  handle("import", async () => {
    assertIdle();
    const selected = await dialog.showOpenDialog(window, {
      title: "Import CodeLines projects or settings",
      filters: [{ name: "CodeLines JSON", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (selected.canceled) return store.state();
    const stat = await fs.stat(selected.filePaths[0]);
    if (stat.size > 256 * 1024 ** 2)
      throw new Error("Import file exceeds 256 MB.");
    const imported = importProjectList(
      JSON.parse(await fs.readFile(selected.filePaths[0], "utf8")),
      store.settings.projects,
    );
    let missing = 0;
    for (const p of imported.projects.filter(
      (p) => !store.settings.projects.some((old) => old.id === p.id),
    )) {
      try {
        if (!(await fs.stat(p.rootPath)).isDirectory()) missing++;
      } catch {
        missing++;
      }
    }
    store.settings.projects = imported.projects;
    if (imported.added) store.settings.lastGitHistory = null;
    store.warnings.push(
      `Imported ${imported.added} projects` +
        (imported.duplicates
          ? ` • ${imported.duplicates} already in the list`
          : "") +
        (missing ? ` • ${missing} folders not found on this machine` : ""),
    );
    await store.save();
    return store.state();
  });
  handle("migrate", async () => {
    assertIdle();
    return store.migrate(
      path.join(
        process.env.LOCALAPPDATA ?? app.getPath("userData"),
        "CodeLines",
      ),
    );
  });
  handle("run", run);
  handle("cancel", async (id) => {
    const key = z.uuid().parse(id),
      op = active.get(key);
    if (op) {
      op.cancelled = true;
      op.worker.postMessage("cancel");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          void op.worker.terminate().finally(resolve);
        }, 1000);
        op.worker.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  });
  handle("export", async (raw) => {
    const r = z
      .object({
        kind: z.enum(["projects", "analysis", "history", "daily", "ai"]),
        format: z.enum(["json", "csv", "html"]),
        projectIds: z.array(z.uuid()).optional(),
        allAgents: z.boolean().optional(),
      })
      .parse(raw);
    if (
      r.kind === "history" &&
      [...active.values()].some((a) => a.kind === "history")
    )
      throw new Error("Finish history analysis before exporting.");
    let content: string;
    if (r.kind === "projects") {
      if (r.format !== "json") throw new Error("Projects export as JSON.");
      content = JSON.stringify(
        {
          format: "codelines-projects",
          version: 1,
          exportedAt: new Date().toISOString(),
          projects: store.settings.projects,
        },
        null,
        2,
      );
    } else if (r.kind === "analysis") {
      const s = store.settings.lastSnapshot;
      if (!s) throw new Error("Scan a project first.");
      if (r.format === "html") throw new Error("Choose CSV or JSON.");
      content =
        r.format === "csv" ? analysisCsv(s) : JSON.stringify(s, null, 2);
    } else if (r.kind === "history") {
      const s = store.settings.lastGitHistory;
      if (!s) throw new Error("Refresh Git history first.");
      if (r.format === "html") throw new Error("Choose CSV or JSON.");
      content = r.format === "csv" ? historyCsv(s) : JSON.stringify(s, null, 2);
    } else if (r.kind === "daily") {
      if (r.format !== "csv") throw new Error("Daily log export uses CSV.");
      content = dailyCsv(store.daily, r.projectIds, r.allAgents);
    } else {
      if (!store.ai?.combined) throw new Error("Refresh AI usage first.");
      if (r.format === "csv") throw new Error("Choose HTML or JSON.");
      content =
        r.format === "html"
          ? await standalone()
          : JSON.stringify(store.ai.combined, null, 2);
    }
    const selected = await dialog.showSaveDialog(window, {
      title: "Export " + r.kind,
      defaultPath: `codelines-${r.kind}-${new Date().toISOString().slice(0, 10)}.${r.format}`,
      filters: [{ name: r.format.toUpperCase(), extensions: [r.format] }],
    });
    if (selected.canceled || !selected.filePath) return null;
    await fs.writeFile(selected.filePath, content, "utf8");
    return selected.filePath;
  });
  handle("openReport", async () => {
    const file = path.join(store.directory, "ai-usage", "report.html");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, await standalone(), "utf8");
    const error = await shell.openPath(file);
    if (error) throw new Error(error);
  });
  session.defaultSession.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  );
  session.defaultSession.webRequest.onBeforeRequest((details, callback) =>
    callback({
      cancel:
        !details.url.startsWith("file:") &&
        !(
          process.env.CODELINES_DEV_URL &&
          details.url.startsWith(process.env.CODELINES_DEV_URL)
        ) &&
        !(
          process.env.CODELINES_DEV_URL &&
          details.url.startsWith("ws://127.0.0.1:5173")
        ),
    }),
  );
  window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#0b1120",
    title: "CodeLines TS",
    show: process.env.CODELINES_TEST !== "1",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== (process.env.CODELINES_DEV_URL ?? pathToFileURL(entry).href))
      event.preventDefault();
  });
  await (process.env.CODELINES_DEV_URL
    ? window.loadURL(process.env.CODELINES_DEV_URL)
    : window.loadFile(entry));
}
if (process.env.CODELINES_DATA_DIR)
  app.setPath("userData", process.env.CODELINES_DATA_DIR);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    window?.show();
    window?.focus();
  });
  app
    .whenReady()
    .then(setup)
    .catch((e) => {
      dialog.showErrorBox("CodeLines could not start", String(e));
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    for (const o of active.values()) void o.worker.terminate();
  });
}

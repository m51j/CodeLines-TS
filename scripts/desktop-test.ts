import { _electron, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import { defaults } from "../src/domain/defaults";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "codelines-desktop-")),
  data = path.join(root, "data"),
  home = path.join(root, "agents"),
  project = path.join(root, "project"),
  out = path.resolve("artifacts/desktop");
await fs.mkdir(data, { recursive: true });
await fs.mkdir(project, { recursive: true });
await fs.mkdir(out, { recursive: true });
const git = (args: string[]) => {
  const r = spawnSync("git", args, {
    cwd: project,
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error(r.stderr);
};
git(["init", "-b", "main"]);
git(["config", "user.name", "Fixture"]);
git(["config", "user.email", "fixture@example.invalid"]);
git(["config", "commit.gpgsign", "false"]);
await fs.writeFile(
  path.join(project, "hello.ts"),
  '// fixture\nexport const hello = "hello world";\n',
);
git(["add", "."]);
git(["commit", "-m", "fixture"]);
await fs.cp(
  path.resolve("tests/fixtures/claude"),
  path.join(home, ".claude", "projects"),
  { recursive: true },
);
const zcode = path.join(home, ".zcode", "cli", "db", "db.sqlite");
await fs.mkdir(path.dirname(zcode), { recursive: true });
const db = new DatabaseSync(zcode);
db.exec(
  "create table session(id text,directory text);create table model_usage(id text,session_id text,model_id text,started_at integer,input_tokens integer,output_tokens integer,reasoning_tokens integer,cache_creation_input_tokens integer,cache_read_input_tokens integer);insert into model_usage values('r','s','gpt-5.5',1700000000000,100,20,5,10,30)",
);
db.close();
const longPath = "D:\\Work\\" + "long-project-folder\\".repeat(25);
const clineDir = path.join(home, ".cline", "data", "sessions", "long");
await fs.mkdir(clineDir, { recursive: true });
await fs.writeFile(
  path.join(clineDir, "long.json"),
  JSON.stringify({ cwd: longPath, model: "gpt-5.5" }),
);
await fs.writeFile(
  path.join(clineDir, "long.messages.json"),
  JSON.stringify({
    messages: [
      {
        id: "long",
        role: "assistant",
        ts: Date.now(),
        metrics: { inputTokens: 100, outputTokens: 10 },
      },
    ],
  }),
);
const settings = defaults();
settings.projects = [
  {
    id: randomUUID(),
    name: "Fixture project",
    rootPath: project,
    isEnabled: true,
    excludePatterns: [],
  },
];
settings.gitHistory.enabled = true;
settings.aiUsage.autoRefreshOnOpen = false;
settings.dailyLog.refreshAiAfterScan = false;
await fs.writeFile(path.join(data, "settings.json"), JSON.stringify(settings));
const packaged = process.argv.includes("--packaged"),
  exe =
    process.env.CODELINES_TEST_EXECUTABLE ??
    (packaged
      ? path.resolve("release/win-unpacked/CodeLines TS.exe")
      : undefined),
  env = {
    ...process.env,
    CODELINES_TEST: "1",
    CODELINES_DATA_DIR: data,
    CODELINES_AGENT_HOME: home,
    CODELINES_AGENT_APPDATA: path.join(root, "roaming"),
    CODELINES_AGENT_LOCALAPPDATA: path.join(root, "local"),
  };
delete (env as NodeJS.ProcessEnv).ELECTRON_RUN_AS_NODE;
const desktop = await _electron.launch({
  args: exe ? [] : ["."],
  executablePath: exe,
  env,
  timeout: 30000,
});
const errors: string[] = [];
/** The theme applies and persists immediately; wait for the saved value. */
async function chooseTheme(page: Page, theme: string) {
  await page.getByRole("radio", { name: `${theme} theme`, exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => (await window.codelines.load()).settings.theme),
    )
    .toBe(theme);
}
async function capture(page: Page, options: { path: string }) {
  const base64 = await desktop.evaluate(async ({ BrowserWindow }, url) => {
    const w = BrowserWindow.getAllWindows().find(
      (w) => w.webContents.getURL() === url,
    );
    if (!w) throw new Error("No window to capture");
    w.webContents.setBackgroundThrottling(false);
    await w.webContents.executeJavaScript(
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );
    const image = await w.capturePage(undefined, {
      stayHidden: true,
      stayAwake: true,
    });
    return image.toPNG().toString("base64");
  }, page.url());
  await fs.writeFile(options.path, Buffer.from(base64, "base64"));
}
try {
  const page = await desktop.firstWindow();
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false),
  );
  await page.context().setOffline(true);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForFunction(() => !!window.codelines);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => typeof (window as unknown as Record<string, unknown>).require,
    ),
  ).toBe("undefined");
  const prefs = await desktop.evaluate(({ BrowserWindow }) =>
    (
      BrowserWindow.getAllWindows()[0].webContents as unknown as {
        getLastWebPreferences(): Record<string, unknown>;
      }
    ).getLastWebPreferences(),
  );
  expect(prefs).toMatchObject({
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  });
  const titlebar = page.getByRole("banner", { name: "Application title bar" });
  await expect(titlebar).toBeVisible();
  expect(
    await titlebar.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("-webkit-app-region"),
    ),
  ).toBe("drag");
  expect(
    await page
      .getByRole("group", { name: "Window controls" })
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("-webkit-app-region"),
      ),
  ).toBe("no-drag");
  for (const kind of ["scan", "history", "ai"] as const) {
    const result = await page.evaluate(async (kind) => {
      const state = await window.codelines.load();
      return window.codelines.run({
        id: crypto.randomUUID(),
        kind,
        settings: state.settings,
      });
    }, kind);
    expect(result.status, result.error).toBe("completed");
    if (kind === "scan") {
      expect(result.state.settings.lastSnapshot?.fileCount).toBe(1);
      expect(result.state.settings.lastSnapshot?.totalTokens).toBeGreaterThan(
        1,
      );
      expect(result.state.daily.days[0].lines[0].projectId).toBe(
        settings.projects[0].id,
      );
    }
    if (kind === "history") {
      expect(result.state.settings.lastGitHistory?.projects[0].added).toBe(2);
    }
    if (kind === "ai") {
      expect(result.state.ai?.claude?.meta.rawRecords).toBe(685);
      expect(result.state.ai?.agents.find((a) => a.id === "zcode")?.state).toBe(
        "Loaded",
      );
    }
  }
  // Cancellation must preserve the previous complete snapshot and reject same-lane work.
  await fs.writeFile(
    path.join(project, "large.ts"),
    'export const value = "hello world";\n'.repeat(70000),
  );
  const cancellation = await page.evaluate(async () => {
    const state = await window.codelines.load(),
      id = crypto.randomUUID();
    const pending = window.codelines.run({
      id,
      kind: "scan",
      settings: state.settings,
    });
    const conflict = window.codelines
      .run({
        id: crypto.randomUUID(),
        kind: "history",
        settings: state.settings,
      })
      .then(
        () => false,
        () => true,
      );
    await new Promise((resolve) => setTimeout(resolve, 50));
    await window.codelines.cancel(id);
    return { result: await pending, conflict: await conflict };
  });
  expect(cancellation.conflict).toBe(true);
  expect(cancellation.result.status).toBe("cancelled");
  expect(cancellation.result.state.settings.lastSnapshot?.fileCount).toBe(1);
  await fs.rm(path.join(project, "large.ts"));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await desktop.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folder],
    });
  }, project);
  const duplicate = await page.evaluate(() => window.codelines.addProject());
  expect(duplicate.settings.projects).toHaveLength(1);
  for (const theme of ["Light", "Dark"]) {
    console.log(`Desktop UI: ${theme} theme`);
    await chooseTheme(page, theme);
    expect(
      await titlebar.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(theme === "Light" ? "rgb(247, 249, 253)" : "rgb(21, 33, 54)");
    await capture(page, {
      path: path.join(
        out,
        `${packaged ? "packaged" : "built"}-dashboard-${theme.toLowerCase()}.png`,
      ),
    });
    for (const name of [
      "Projects",
      "Analysis",
      "Code changes",
      "Daily log",
      "AI usage",
      "Settings",
    ]) {
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
      if (name === "AI usage") {
        const before = await page
          .locator(".reports .tile strong")
          .first()
          .textContent();
        await page
          .getByRole("group", { name: "Report range", exact: true })
          .getByRole("button", { name: "7d", exact: true })
          .click();
        await expect(
          page.locator(".reports .tile strong").first(),
        ).not.toHaveText(before ?? "");
        await page
          .getByRole("group", { name: "Report range", exact: true })
          .getByRole("button", { name: "All", exact: true })
          .click();
        await page
          .getByRole("group", { name: "Group usage", exact: true })
          .getByRole("button", { name: "By model", exact: true })
          .click();
        for (const tab of [
          "Overview",
          "Models",
          "Time",
          "Tables",
          "Projects",
        ]) {
          await page.getByRole("tab", { name: tab, exact: true }).click();
          await expect(
            page.getByRole("tabpanel", { name: tab, exact: true }),
          ).toBeVisible();
        }
        await page.getByRole("tab", { name: "Projects", exact: true }).click();
        const longCell = page
          .locator(".project-path")
          .filter({ hasText: longPath.replace(/\\+$/, "") })
          .first();
        await expect(longCell).toBeVisible();
        expect(
          await longCell.evaluate((el) => el.scrollWidth > el.clientWidth),
        ).toBe(true);
        expect(await longCell.getAttribute("title")).toBe(
          longPath.replace(/\\+$/, ""),
        );
        await page.getByRole("tab", { name: /^Claude Code/ }).click();
        await expect(
          page.getByRole("tab", { name: "Overview", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
        await page
          .getByRole("group", { name: "Report range", exact: true })
          .getByRole("button", { name: "30d", exact: true })
          .click();
        await page.getByRole("tab", { name: "Tables", exact: true }).click();
        await expect(
          page.getByRole("heading", { name: "App card vs reality" }),
        ).toBeVisible();
        await page.getByRole("tab", { name: "Projects", exact: true }).click();
        const region = page.getByRole("region", {
          name: "By project table",
          exact: true,
        });
        await expect(region).toBeVisible();
        expect(
          await region.locator(".project-path").first().getAttribute("title"),
        ).toBeTruthy();
        await page.getByRole("tab", { name: /^All agents/ }).click();
        await expect(
          page.getByRole("tab", { name: "Projects", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
        await expect(
          page.getByRole("button", { name: "By model", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("tab", { name: /^Claude Code/ }).click();
        await expect(
          page.getByRole("button", { name: "30d", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await page.getByLabel("Report start date").fill("2099-01-02");
        await page.getByLabel("Report end date").fill("2099-01-01");
        await expect(page.getByRole("alert")).toContainText(
          "Start date must be on or before end date",
        );
        await page.getByLabel("Report end date").fill("2099-01-03");
        await expect(
          page.getByText("No usage in this range", { exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: "7d", exact: true }).click();
        await expect(page.getByLabel("Report start date")).toHaveValue("");
        await expect(page.getByLabel("Report end date")).toHaveValue("");
        await page.getByRole("button", { name: "All", exact: true }).click();
        await page.getByRole("tab", { name: "Overview", exact: true }).click();
        const cell = page.locator(".heat-cell").first();
        await cell.focus();
        await expect(page.getByRole("tooltip")).toBeVisible();
        await expect(page.getByRole("tooltip")).toContainText("Real tokens");
        await cell.press("Escape");
        await expect(page.getByRole("tooltip")).toHaveCount(0);
        await cell.hover();
        await expect(page.getByRole("tooltip")).toBeVisible();
        await page
          .getByRole("heading", { name: "Activity", exact: true })
          .hover();
        const overviewTab = page.getByRole("tab", {
          name: "Overview",
          exact: true,
        });
        await overviewTab.focus();
        await overviewTab.press("ArrowRight");
        await expect(
          page.getByRole("tab", { name: "Models", exact: true }),
        ).toBeFocused();
        await expect(
          page.getByRole("tab", { name: "Models", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
        const legendColors = () =>
          page
            .locator(".recharts-legend-item")
            .evaluateAll((items) =>
              Object.fromEntries(
                items.map((item) => [
                  item.textContent ?? "",
                  item.querySelector("path")?.getAttribute("fill"),
                ]),
              ),
            );
        await expect(
          page.locator(".recharts-legend-item").first(),
        ).toBeVisible();
        const modelColors = await legendColors();
        console.log(`AI report interactions and colors: ${theme}`);
        await page.getByRole("button", { name: "7d", exact: true }).click();
        for (const [key, color] of Object.entries(await legendColors())) {
          expect(color).toBeTruthy();
          expect(color).toBe(modelColors[key]);
        }
        await page.getByRole("button", { name: "All", exact: true }).click();
        await page.getByRole("tab", { name: /^All agents/ }).click();
        await page.getByRole("tab", { name: "Time", exact: true }).click();
        await page
          .getByRole("button", { name: "Refresh", exact: true })
          .click();
        await expect(page.locator(".statusbar")).toContainText(
          "AI usage complete",
          { timeout: 30000 },
        );
        await expect(
          page.getByRole("tab", { name: "Time", exact: true }),
        ).toHaveAttribute("aria-selected", "true");
        await expect(
          page.getByRole("button", { name: "By model", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await page.locator(".ai-sources summary").click();
        await expect(
          page.getByRole("region", { name: "AI adapter status", exact: true }),
        ).toBeVisible();
        await page.locator(".ai-sources summary").click();
        for (const screenshotTab of ["Overview", "Time", "Projects"]) {
          await page
            .getByRole("tab", { name: screenshotTab, exact: true })
            .click();
          await page
            .getByRole("heading", { name: "AI usage", exact: true })
            .scrollIntoViewIfNeeded();
          await capture(page, {
            path: path.join(
              out,
              `${packaged ? "packaged" : "built"}-ai-${screenshotTab.toLowerCase()}-${theme.toLowerCase()}.png`,
            ),
          });
        }
        await capture(page, {
          path: path.join(
            out,
            `${packaged ? "packaged" : "built"}-reports-${theme.toLowerCase()}.png`,
          ),
        });
      }
    }
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Dashboard", exact: true })
      .click();
  }
  await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(950, 700),
  );
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "AI usage", exact: true })
    .click();
  for (const smallTheme of ["Light", "Dark"]) {
    console.log(`Desktop UI: 950×700 ${smallTheme}`);
    await chooseTheme(page, smallTheme);
    for (const smallTab of ["Overview", "Time", "Projects"]) {
      await page.getByRole("tab", { name: smallTab, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const reportBox = await page.locator(".reports").boundingBox();
      expect(reportBox!.x + reportBox!.width).toBeLessThanOrEqual(950);
      await page
        .getByRole("heading", { name: "AI usage", exact: true })
        .scrollIntoViewIfNeeded();
      await capture(page, {
        path: path.join(
          out,
          `${packaged ? "packaged" : "built"}-ai-small-${smallTab.toLowerCase()}-${smallTheme.toLowerCase()}.png`,
        ),
      });
    }
  }
  await chooseTheme(page, "Dark");
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Dark theme", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.evaluate(async () => {
    const state = await window.codelines.load();
    state.settings.dailyLog.refreshAiAfterScan = true;
    await window.codelines.save(state.settings);
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Scan all projects", exact: true })
    .click();
  await expect(page.locator(".statusbar")).toContainText(
    "Scan complete · AI usage completed",
    { timeout: 30000 },
  );
  await page.evaluate(async () => {
    const state = await window.codelines.load();
    state.settings.aiUsage.autoRefreshOnOpen = true;
    await window.codelines.save(state.settings);
  });
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "AI usage", exact: true })
    .click();
  await expect(page.locator(".statusbar")).toContainText("AI usage complete", {
    timeout: 30000,
  });
  const generated = await page.evaluate(
    async () => (await window.codelines.load()).ai?.generatedAt,
  );
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "AI usage", exact: true })
    .click();
  expect(
    await page.evaluate(
      async () => (await window.codelines.load()).ai?.generatedAt,
    ),
  ).toBe(generated);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await capture(page, {
    path: path.join(out, `${packaged ? "packaged" : "built"}-small-window.png`),
  });
  // Replace only native dialogs in this isolated app process, then exercise real export handlers.
  const exportFile = path.join(root, "export.html");
  await desktop.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, exportFile);
  await page.evaluate(() =>
    window.codelines.export({ kind: "ai", format: "html" }),
  );
  const html = await fs.readFile(exportFile, "utf8");
  expect(html).not.toContain("<iframe");
  expect(html).not.toMatch(/<script[^>]+src=/);
  expect(html).toContain("CodeLines");
  const newWindow = desktop.waitForEvent("window");
  await desktop.evaluate(async ({ BrowserWindow }, file) => {
    const w = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    await w.loadFile(file);
  }, exportFile);
  const report = await newWindow;
  await desktop.evaluate(
    ({ BrowserWindow }, url) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL() === url)!
        .webContents.setBackgroundThrottling(false),
    report.url(),
  );
  report.on("pageerror", (e) => errors.push(e.message));
  await report.waitForFunction(() => document.querySelector("[role=tab]"));
  expect(await report.evaluate(() => typeof window.codelines)).toBe(
    "undefined",
  );
  for (const tab of ["Overview", "Models", "Time", "Tables", "Projects"]) {
    await report.getByRole("tab", { name: tab, exact: true }).click();
    await expect(
      report.getByRole("tabpanel", { name: tab, exact: true }),
    ).toBeVisible();
  }
  await report.getByRole("tab", { name: /^Claude Code/ }).click();
  await report.getByRole("button", { name: "7d", exact: true }).click();
  await report.getByRole("tab", { name: "Time", exact: true }).click();
  await report.getByRole("tab", { name: /^All agents/ }).click();
  await expect(
    report.getByRole("tab", { name: "Projects", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await report.getByRole("tab", { name: /^Claude Code/ }).click();
  await expect(
    report.getByRole("tab", { name: "Time", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    report.getByRole("button", { name: "7d", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await report.getByRole("tab", { name: "Overview", exact: true }).click();
  await report.getByLabel("Report start date").fill("2099-01-02");
  await report.getByLabel("Report end date").fill("2099-01-01");
  await expect(report.getByRole("alert")).toContainText(
    "Start date must be on or before end date",
  );
  await report.getByRole("button", { name: "All", exact: true }).click();
  await report.locator(".heat-cell").first().focus();
  await expect(report.getByRole("tooltip")).toContainText("Real tokens");
  await report.locator(".heat-cell").first().press("Escape");
  await report
    .getByRole("heading", { name: "AI usage", exact: true })
    .scrollIntoViewIfNeeded();
  await capture(report, {
    path: path.join(
      out,
      `${packaged ? "packaged" : "built"}-standalone-offline.png`,
    ),
  });
  await desktop.evaluate(
    ({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    },
    path.join(root, "history.csv"),
  );
  await page.evaluate(() =>
    window.codelines.export({ kind: "history", format: "csv" }),
  );
  expect(await fs.readFile(path.join(root, "history.csv"), "utf8")).toContain(
    '"Totals"',
  );
  for (const [kind, format] of [
    ["projects", "json"],
    ["analysis", "csv"],
    ["analysis", "json"],
    ["history", "json"],
    ["daily", "csv"],
    ["ai", "json"],
  ] as const) {
    const file = path.join(root, `${kind}.${format}`);
    await desktop.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, file);
    await page.evaluate(
      ({ kind, format }) => window.codelines.export({ kind, format }),
      { kind, format },
    );
    const data = await fs.readFile(file, "utf8");
    if (format === "json") expect(JSON.parse(data)).toBeTruthy();
    else expect(data.split("\n").length).toBeGreaterThan(1);
  }
  await desktop.evaluate(
    ({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    },
    path.join(root, "projects.json"),
  );
  expect(
    (await page.evaluate(() => window.codelines.importProjects())).settings
      .projects,
  ).toHaveLength(1);
  expect(errors).toEqual([]);
  // Exercise the real OS window and state events, including changes outside the UI.
  const nativeWindow = await desktop.browserWindow(page);
  await nativeWindow.evaluate((w) => w.showInactive());
  await page
    .getByRole("button", { name: "Maximize window", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Restore window", exact: true }),
  ).toBeVisible();
  expect(await nativeWindow.evaluate((w) => w.isMaximized())).toBe(true);
  await page
    .getByRole("button", { name: "Restore window", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Maximize window", exact: true }),
  ).toBeVisible();
  expect(await nativeWindow.evaluate((w) => w.isMaximized())).toBe(false);
  await nativeWindow.evaluate((w) => w.maximize());
  await expect(
    page.getByRole("button", { name: "Restore window", exact: true }),
  ).toBeVisible();
  await nativeWindow.evaluate((w) => w.unmaximize());
  await expect(
    page.getByRole("button", { name: "Maximize window", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Minimize window", exact: true })
    .click();
  await expect
    .poll(() => nativeWindow.evaluate((w) => w.isMinimized()))
    .toBe(true);
  await nativeWindow.evaluate((w) => w.restore());
  await expect
    .poll(() => nativeWindow.evaluate((w) => w.isMinimized()))
    .toBe(false);
  await nativeWindow.evaluate((w) => w.blur());
  await expect(titlebar).toHaveClass(/titlebar-inactive/);
  const invalidWindowAction = await page.evaluate(() =>
    window.codelines.windowAction("invalid" as "close").then(
      () => false,
      () => true,
    ),
  );
  expect(invalidWindowAction).toBe(true);
  const closed = page.waitForEvent("close");
  await page.getByRole("button", { name: "Close window", exact: true }).click();
  await closed;
  console.log(
    JSON.stringify(
      {
        packaged,
        executable: exe ?? "electron .",
        checks: [
          "sandboxed startup",
          "themed custom title bar, OS minimize/maximize/restore/close and external state events",
          "scan worker and bundled offline BPE",
          "Git worker",
          "Claude golden fixtures",
          "packaged node:sqlite reader",
          "seven-page navigation",
          "all report tabs and agent-specific selection restoration",
          "preset/custom dates, invalid dates and empty ranges",
          "stable model colors, keyboard tabs and focus/hover tooltips",
          "AI refresh preserves selected report state",
          "overview/time/projects in light/dark at full and 950px widths",
          "light/dark",
          "950px window",
          "standalone HTML without IPC or network",
          "CSV export",
          "JSON/project-list/daily exports and native import",
          "cancellation and conflicting-operation rejection",
          "settings save/reload and post-scan AI refresh",
          "long project-path clipping and full tooltip",
          "Chromium forced offline",
        ],
        screenshots: out,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await desktop.close();
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5 });
}

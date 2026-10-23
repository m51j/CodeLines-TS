import { chromium, expect, type Browser } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { defaults } from "../src/domain/defaults";
import manifest from "../package.json";
const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), "codelines-portable-")),
  ),
  data = path.join(root, "data"),
  project = path.join(root, "project");
await fs.mkdir(data);
await fs.mkdir(project);
await fs.writeFile(
  path.join(project, "hello.ts"),
  '// portable fixture\nexport const hello = "hello world";\n',
);
const settings = defaults();
settings.projects = [
  {
    id: randomUUID(),
    name: "Portable fixture",
    rootPath: project,
    isEnabled: true,
    excludePatterns: [],
  },
];
settings.aiUsage.autoRefreshOnOpen = false;
settings.dailyLog.refreshAiAfterScan = false;
await fs.writeFile(path.join(data, "settings.json"), JSON.stringify(settings));
const server = createServer();
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("No test port");
const port = address.port;
await new Promise<void>((resolve) => server.close(() => resolve()));
const env: NodeJS.ProcessEnv = {
  ...process.env,
  CODELINES_TEST: "1",
  CODELINES_DATA_DIR: data,
  CODELINES_AGENT_HOME: path.join(root, "agents"),
  CODELINES_AGENT_APPDATA: path.join(root, "roaming"),
  CODELINES_AGENT_LOCALAPPDATA: path.join(root, "local"),
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.CODELINES_DEV_URL;
const executable = path.resolve(
    manifest.build.directories.output,
    `${manifest.build.productName} ${manifest.version}.exe`,
  ),
  child = spawn(executable, [`--remote-debugging-port=${port}`], {
    env,
    windowsHide: true,
    stdio: "ignore",
  });
let browser: Browser | undefined;
try {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
        timeout: 1000,
      });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  if (!browser)
    throw new Error(
      "Portable executable did not open its Chromium debugging endpoint",
    );
  const context = browser.contexts()[0],
    page = context.pages()[0];
  await context.setOffline(true);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  expect(page.url()).toMatch(/^file:/);
  await expect(page).toHaveTitle("CodeLines");
  await expect(page.locator(".titlebar-brand")).toHaveText("CodeLines");
  await page
    .getByRole("button", { name: "Scan all projects", exact: true })
    .click();
  await expect(page.locator(".statusbar")).toContainText("Scan complete", {
    timeout: 30000,
  });
  const state = await page.evaluate(() => window.codelines.load());
  expect(state.settings.lastSnapshot?.fileCount).toBe(1);
  expect(state.settings.lastSnapshot?.totalTokens).toBeGreaterThan(1);
  await fs.mkdir("artifacts/desktop", { recursive: true });
  console.log(
    JSON.stringify(
      {
        executable,
        checks: [
          "actual portable wrapper launch",
          "local file startup without development server",
          "Chromium forced offline",
          "packaged scan worker and real BPE",
          "snapshot persistence",
        ],
        status: "passed",
      },
      null,
      2,
    ),
  );
} finally {
  if (browser) {
    try {
      await Promise.race([
        browser.contexts()[0].pages()[0].close(),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      /* closing disconnects the debugging endpoint */
    }
    await browser.close().catch(() => {});
  }
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", () => resolve());
    setTimeout(resolve, 5000);
  });
  if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep))
    throw new Error("Unexpected temporary directory");
  await fs.rm(root, { recursive: true, force: true, maxRetries: 5 });
}

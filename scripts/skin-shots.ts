/**
 * Screenshots every page of one skin in the real app, for visual review.
 *
 *   npx tsx scripts/skin-shots.ts --skin Instrument --theme Dark [--url http://127.0.0.1:5174] [--out dir] [--accent #2e86f0] [--compact] [--reduce] [--scale 2] [--widget 480x300]
 *
 * Without --url it loads the built renderer (run `npm run build` first). With --url it loads
 * a running Vite dev server (`npx vite --port 5174 --strictPort`), so renderer edits show
 * without a rebuild; dist/main.cjs and the preloads must still be built.
 * The workspace scans this repository and the Claude fixtures, then visits each page through
 * the skin's own navigation (a nav landmark named "Main navigation" with one control per page).
 * --scale renders at that device scale factor (sharper README images); --widget resizes the widget.
 */
import { _electron, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { defaults } from "../src/domain/defaults";
import { skins, type Skin } from "../src/shared/appearance";
const arg = (name: string) => {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const skin = (arg("skin") ?? "Classic") as Skin;
if (!skins.includes(skin)) throw new Error("Unknown skin " + skin);
const theme = (arg("theme") ?? "Dark") as "Light" | "Dark",
  // The main process trusts the exact dev URL, which Vite serves with a trailing slash.
  url = arg("url")?.replace(/\/?$/, "/"),
  out = path.resolve(arg("out") ?? `artifacts/skins/${skin.toLowerCase()}-${theme.toLowerCase()}`);
await fs.mkdir(out, { recursive: true });
const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "codelines-skin-"))),
  data = path.join(root, "data"),
  home = path.join(root, "agents");
await fs.mkdir(data, { recursive: true });
await fs.cp(path.resolve("tests/fixtures/claude"), path.join(home, ".claude", "projects"), {
  recursive: true,
});
// Synthetic Claude sessions over the last 120 days, so the AI charts have something to draw.
{
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const models = ["claude-opus-4-1", "claude-sonnet-4-5", "claude-haiku-4-5"];
  const cwds = [path.resolve("."), path.resolve("tests"), "D:\\Work\\alpha", "D:\\Work\\beta"];
  for (let d = 0; d < 120; d++) {
    if (rand() < 0.28) continue;
    const day = Date.now() - d * 86400000;
    const sessions = 1 + Math.floor(rand() * 3);
    for (let s = 0; s < sessions; s++) {
      const id = `synthetic-${d}-${s}`,
        cwd = cwds[Math.floor(rand() * cwds.length)],
        start = day - Math.floor(rand() * 10) * 3600000,
        lines: string[] = [];
      const requests = 5 + Math.floor(rand() * 40);
      for (let r = 0; r < requests; r++)
        lines.push(
          JSON.stringify({
            parentUuid: "p",
            isSidechain: false,
            userType: "external",
            cwd,
            sessionId: id,
            version: "2.1.0",
            gitBranch: "main",
            message: {
              id: `msg-${id}-${r}`,
              type: "message",
              role: "assistant",
              model: models[Math.floor(rand() * models.length)],
              content: [{ type: "text", text: "x" }],
              usage: {
                input_tokens: Math.floor(rand() * 4000),
                output_tokens: Math.floor(rand() * 3000),
                cache_read_input_tokens: Math.floor(rand() * 90000),
                cache_creation_input_tokens: Math.floor(rand() * 12000),
              },
            },
            requestId: `req-${id}-${r}`,
            type: "assistant",
            uuid: `u-${id}-${r}`,
            timestamp: new Date(start + r * 90000).toISOString(),
          }),
        );
      const dir = path.join(home, ".claude", "projects", "synthetic-" + (d % 4));
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, id + ".jsonl"), lines.map((l) => l + "\n").join(""));
    }
  }
}
const settings = defaults();
settings.projects = [
  {
    id: randomUUID(),
    name: "CodeLines",
    rootPath: path.resolve("."),
    isEnabled: true,
    excludePatterns: ["artifacts/", "release/"],
  },
  {
    id: randomUUID(),
    name: "Fixtures",
    rootPath: path.resolve("tests"),
    isEnabled: true,
    excludePatterns: [],
  },
];
settings.gitHistory = { enabled: true, days: 30, mode: "Activity" };
settings.aiUsage.autoRefreshOnOpen = false;
settings.dailyLog.refreshAiAfterScan = false;
settings.theme = theme;
settings.appearance = {
  skin,
  accents: arg("accent") ? { [skin]: arg("accent") } : {},
  motion: process.argv.includes("--reduce") ? "Reduce" : "System",
  density: process.argv.includes("--compact") ? "Compact" : "Comfortable",
};
await fs.writeFile(path.join(data, "settings.json"), JSON.stringify(settings));
const env: Record<string, string> = {
  ...(process.env as Record<string, string>),
  CODELINES_TEST: "1",
  CODELINES_DATA_DIR: data,
  CODELINES_AGENT_HOME: home,
  CODELINES_AGENT_APPDATA: path.join(root, "roaming"),
  CODELINES_AGENT_LOCALAPPDATA: path.join(root, "local"),
};
if (url) env.CODELINES_DEV_URL = url;
delete env.ELECTRON_RUN_AS_NODE;
const scale = arg("scale"),
  widgetSize = arg("widget")?.split("x").map(Number);
const desktop = await _electron.launch({
  args: [...(scale ? ["--force-device-scale-factor=" + scale] : []), "."],
  env,
  timeout: 30000,
});
const problems: string[] = [];
async function capture(page: Page, file: string) {
  const base64 = await desktop.evaluate(async ({ BrowserWindow }, u) => {
    const w = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL() === u);
    if (!w) throw new Error("No window to capture");
    w.webContents.setBackgroundThrottling(false);
    await w.webContents.executeJavaScript(
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );
    const image = await w.capturePage(undefined, { stayHidden: true, stayAwake: true });
    return image.toPNG().toString("base64");
  }, page.url());
  await fs.writeFile(path.join(out, file), Buffer.from(base64, "base64"));
}
try {
  const page = await desktop.firstWindow();
  await desktop.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.webContents.setBackgroundThrottling(false);
    w.setSize(1440, 940);
  });
  page.on("pageerror", (e) => problems.push("page error: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/ws:\/\/|WebSocket|vite/i.test(m.text()))
      problems.push("console: " + m.text());
  });
  await page.waitForFunction(() => !!window.codelines);
  // Let the boot animation finish.
  await page.waitForTimeout(2500);
  await capture(page, "00-start.png");
  for (const kind of ["scan", "history", "ai"] as const) {
    const result = await page.evaluate(async (kind) => {
      const state = await window.codelines.load();
      return window.codelines.run({ id: crypto.randomUUID(), kind, settings: state.settings });
    }, kind);
    if (result.status !== "completed") problems.push(`${kind}: ${result.status} ${result.error ?? ""}`);
  }
  await page.reload();
  await page.waitForFunction(() => !!window.codelines);
  await page.waitForTimeout(2500);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const names = ["Dashboard", "Projects", "Analysis", "Code changes", "Daily log", "AI usage", "Settings"];
  let n = 1;
  for (const name of names) {
    const target = nav.getByRole("button", { name: new RegExp("^" + name) }).first();
    if (!(await target.count())) {
      problems.push(`navigation: no "${name}" in the Main navigation landmark`);
      continue;
    }
    await target.click();
    await page.waitForTimeout(1400);
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    await capture(page, `${String(n++).padStart(2, "0")}-${slug}.png`);
    // A second shot further down long pages.
    const scrolled = await page.evaluate(() => {
      const el = [...document.querySelectorAll<HTMLElement>("*")].find(
        (e) => e.scrollHeight > e.clientHeight + 200 && /(auto|scroll)/.test(getComputedStyle(e).overflowY),
      );
      if (!el) return false;
      el.scrollTop = el.scrollHeight;
      return true;
    });
    if (scrolled) {
      await page.waitForTimeout(900);
      await capture(page, `${String(n - 1).padStart(2, "0")}-${slug}-end.png`);
    }
  }
  // The desktop widget, in the same skin.
  const opened = desktop.waitForEvent("window", { predicate: (p) => p.url().endsWith("widget.html") });
  await page.evaluate(async () => {
    const state = await window.codelines.load();
    await window.codelines.save({ ...state.settings, widget: { ...state.settings.widget, enabled: true } });
  });
  const widget = await opened;
  widget.on("pageerror", (e) => problems.push("widget error: " + e.message));
  if (widgetSize)
    await desktop.evaluate(
      ({ BrowserWindow }, [u, w, h]) =>
        BrowserWindow.getAllWindows()
          .find((b) => b.webContents.getURL() === u)
          ?.setSize(w as number, h as number),
      [widget.url(), widgetSize[0], widgetSize[1]] as const,
    );
  await widget.waitForTimeout(2000);
  await capture(widget, "90-widget.png");
  for (const tab of ["Projects", "Total"]) {
    const t = widget.getByRole("tab", { name: tab, exact: true });
    if (await t.count()) {
      await t.click();
      await widget.waitForTimeout(900);
      await capture(widget, `9${tab === "Projects" ? 1 : 2}-widget-${tab.toLowerCase()}.png`);
    }
  }
} catch (e) {
  problems.push("script: " + (e instanceof Error ? e.stack : String(e)));
} finally {
  await desktop.close().catch(() => {});
  await fs.rm(root, { recursive: true, force: true }).catch(() => {});
}
console.log(`Screenshots in ${out}`);
if (problems.length) {
  console.log("Problems:\n- " + problems.join("\n- "));
  process.exitCode = 1;
}

import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  nativeTheme,
  screen,
} from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import type {
  Settings,
  WidgetData,
  WidgetOptions,
  WidgetView,
} from "../shared/contracts";
import { fitBounds, widgetMinimum, type Rect } from "../widget/bounds";
import { atomicWrite } from "../services/persistence";
const finite = z.number().finite();
const viewSchema = z.object({
  tab: z.enum(["overview", "projects", "total"]),
  range: z.enum(["today", "d30", "all"]),
});
/** Position, size and view change often, so they live beside settings, not in them. */
const placementSchema = z
  .object({ x: finite, y: finite, width: finite, height: finite })
  .partial()
  .extend(viewSchema.partial().shape);
type Placement = z.infer<typeof placementSchema>;
export interface WidgetHost {
  directory: string;
  icon: string;
  settings(): Settings;
  data(): WidgetData;
  openMain(): void;
  refresh(): void;
  change(patch: Partial<WidgetOptions>): Promise<void>;
}
export interface WidgetController {
  apply(settings: Settings): Promise<void>;
  publish(): void;
  isActive(): boolean;
  window(): BrowserWindow | null;
}
export function createWidget(host: WidgetHost): WidgetController {
  const entry = path.join(__dirname, "renderer", "widget.html"),
    devUrl = process.env.CODELINES_DEV_URL,
    url = devUrl
      ? devUrl.replace(/\/$/, "") + "/widget.html"
      : pathToFileURL(entry).href,
    file = path.join(host.directory, "widget.json"),
    testing = process.env.CODELINES_TEST === "1";
  let placement: Placement = {},
    loaded = false,
    win: BrowserWindow | null = null,
    tray: Tray | null = null,
    timer: NodeJS.Timeout | undefined,
    saveTimer: NodeJS.Timeout | undefined,
    applied: WidgetOptions | null = null,
    loginItem: boolean | null = null,
    // The size we asked for: on scaled displays getBounds() grows by a pixel or two each time.
    requested: Rect = { x: 0, y: 0, width: 0, height: 0 },
    move: {
      cursor: Electron.Point;
      moved: boolean;
      last: Rect;
      timer: NodeJS.Timeout;
    } | null = null;
  async function loadPlacement() {
    if (loaded) return;
    loaded = true;
    try {
      placement = placementSchema.parse(
        JSON.parse(await fs.readFile(file, "utf8")),
      );
    } catch {
      placement = {};
    }
  }
  function remember(next: Partial<Placement>) {
    placement = { ...placement, ...next };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(
      () => void atomicWrite(file, placement).catch(() => {}),
      300,
    );
  }
  const view = (): WidgetView => ({
    tab: placement.tab ?? "overview",
    range: placement.range ?? "today",
  });
  function trusted(event: Electron.IpcMainInvokeEvent) {
    if (
      !win ||
      event.sender !== win.webContents ||
      event.senderFrame?.url !== url
    )
      throw new Error("Untrusted widget request");
  }
  const handle = (channel: string, handler: (...args: unknown[]) => unknown) =>
    ipcMain.handle(
      "codelines:widget:" + channel,
      async (event, ...args: unknown[]) => {
        try {
          trusted(event);
          return { ok: true, value: await handler(...args) };
        } catch (error) {
          return {
            ok: false,
            error: {
              code:
                error instanceof z.ZodError
                  ? "INVALID_INPUT"
                  : "REQUEST_FAILED",
              message: error instanceof Error ? error.message : String(error),
              recoverable: true,
            },
          };
        }
      },
    );
  function endMove(): boolean {
    if (!move) return false;
    clearInterval(move.timer);
    const p = screen.getCursorScreenPoint(),
      moved =
        move.moved ||
        Math.abs(p.x - move.cursor.x) + Math.abs(p.y - move.cursor.y) > 4;
    if (move.moved) {
      requested = move.last;
      remember(move.last);
    }
    move = null;
    return moved;
  }
  handle("load", () => ({ data: host.data(), view: view() }));
  handle("view", (raw) => remember(viewSchema.parse(raw)));
  handle("openApp", () => host.openMain());
  handle("menu", () => {
    if (win) menu().popup({ window: win });
  });
  // The page reports the press; the window then follows the cursor until it
  // reports the release, so a press without movement stays a click.
  handle("move", (raw) => {
    const mode = z.enum(["drag", "resize", "stop"]).parse(raw),
      moved = endMove();
    if (mode === "stop" || !win) return moved;
    const cursor = screen.getCursorScreenPoint(),
      [x, y] = win.getPosition(),
      start = { x, y, width: requested.width, height: requested.height };
    const state = {
      cursor,
      moved: false,
      last: start,
      timer: setInterval(() => {
        if (!win || win.isDestroyed()) {
          endMove();
          return;
        }
        const p = screen.getCursorScreenPoint(),
          dx = p.x - cursor.x,
          dy = p.y - cursor.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) state.moved = true;
        if (!state.moved) return;
        // setBounds with a fixed size: setPosition can grow the window on scaled displays.
        state.last =
          mode === "drag"
            ? { ...start, x: start.x + dx, y: start.y + dy }
            : {
                ...start,
                width: Math.max(widgetMinimum.width, start.width + dx),
                height: Math.max(widgetMinimum.height, start.height + dy),
              };
        win.setBounds(state.last);
      }, 16),
    };
    move = state;
    return false;
  });
  nativeTheme.on("updated", () => publish());
  function publish() {
    if (win && !win.isDestroyed() && !win.webContents.isLoading())
      win.webContents.send("codelines:widget:data", host.data());
  }
  function toggle() {
    if (!win) void open();
    else if (win.isVisible()) win.hide();
    else win.showInactive();
    tray?.setContextMenu(menu());
  }
  function menu() {
    const s = host.settings(),
      o = s.widget;
    return Menu.buildFromTemplate([
      { label: "Open CodeLines", click: () => host.openMain() },
      {
        label: win?.isVisible() ? "Hide widget" : "Show widget",
        click: toggle,
      },
      { type: "separator" },
      {
        label: "Always on top",
        type: "checkbox",
        checked: o.alwaysOnTop,
        click: (item) => void host.change({ alwaysOnTop: item.checked }),
      },
      {
        label: "Start with Windows",
        type: "checkbox",
        checked: o.startWithWindows,
        click: (item) => void host.change({ startWithWindows: item.checked }),
      },
      {
        label: "Refresh AI usage",
        enabled: s.aiUsage.enabled,
        click: () => host.refresh(),
      },
      { type: "separator" },
      {
        label: "Turn off widget",
        click: () => void host.change({ enabled: false }),
      },
      { label: "Quit CodeLines", click: () => app.quit() },
    ]);
  }
  async function open() {
    await loadPlacement();
    const primary = screen.getPrimaryDisplay().workArea;
    requested = fitBounds(
      placement,
      screen.getAllDisplays().map((d) => d.workArea),
      primary,
    );
    const w = new BrowserWindow({
      ...requested,
      minWidth: widgetMinimum.width,
      minHeight: widgetMinimum.height,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      resizable: true,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: host.settings().widget.alwaysOnTop,
      show: false,
      title: "CodeLines widget",
      icon: host.icon,
      webPreferences: {
        preload: path.join(__dirname, "widget-preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    win = w;
    // Created windows come out a few pixels larger; this brings it back to the requested size.
    w.setBounds(requested);
    w.removeMenu();
    w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    const guard = (event: Electron.Event, target: string) => {
      if (target !== url) event.preventDefault();
    };
    w.webContents.on("will-navigate", guard);
    w.webContents.on("will-redirect", guard);
    w.once("ready-to-show", () => {
      if (!testing) w.showInactive();
      tray?.setContextMenu(menu());
    });
    w.on("closed", () => {
      if (win === w) win = null;
      endMove();
      tray?.setContextMenu(menu());
    });
    await (devUrl ? w.loadURL(url) : w.loadFile(entry));
  }
  /** Login item: the packaged or portable executable, or Electron with this app in development. */
  function setLoginItem(open: boolean) {
    loginItem = open;
    if (testing) return;
    app.setLoginItemSettings({
      openAtLogin: open,
      path: process.env.PORTABLE_EXECUTABLE_FILE ?? process.execPath,
      args: app.isPackaged ? ["--widget"] : [app.getAppPath(), "--widget"],
    });
  }
  function stale(minutes: number) {
    const at = host.data().generatedAt;
    return !at || Date.now() - Date.parse(at) > minutes * 60000;
  }
  async function apply(settings: Settings) {
    const o = settings.widget,
      login = o.enabled && o.startWithWindows;
    // Leave the registry alone at startup unless the widget asks to start with Windows.
    if (loginItem === null ? login : login !== loginItem) setLoginItem(login);
    const opening = o.enabled && !applied?.enabled,
      retimed = o.refreshMinutes !== applied?.refreshMinutes;
    applied = o;
    if (!o.enabled) {
      clearInterval(timer);
      timer = undefined;
      endMove();
      win?.destroy();
      win = null;
      tray?.destroy();
      tray = null;
      return;
    }
    if (!tray) {
      tray = new Tray(nativeImage.createFromPath(host.icon));
      tray.setToolTip("CodeLines");
      tray.on("click", toggle);
    }
    if (!win) await open();
    else win.setAlwaysOnTop(o.alwaysOnTop);
    tray.setContextMenu(menu());
    if (opening || retimed || !timer) {
      clearInterval(timer);
      timer = setInterval(() => {
        if (win?.isVisible()) host.refresh();
      }, o.refreshMinutes * 60000);
    }
    if (opening && settings.aiUsage.enabled && stale(o.refreshMinutes))
      host.refresh();
    publish();
  }
  return {
    apply,
    publish,
    isActive: () => !!applied?.enabled,
    window: () => win,
  };
}

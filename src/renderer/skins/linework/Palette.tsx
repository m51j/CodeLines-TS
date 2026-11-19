/**
 * The command palette (Ctrl+K): every page, action, appearance option and window command,
 * with fuzzy matching and arrow keys. "?" opens the same list as a shortcut reference.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAppearanceControls } from "../../appearance/controls";
import { play } from "../../motion/core";
import { useWindowControls } from "../../window";
import { useWorkspace } from "../../workspace";
import { useShell } from "./context";
import { Icon, type IconName } from "./icons";
import { pageIcons } from "./Rail";
import { developer, openAboutLink, requestAbout } from "../../about";

interface Item {
  group: string;
  label: string;
  icon?: IconName;
  swatch?: string;
  key?: string;
  run: () => void;
  off?: boolean;
}

const score = (label: string, q: string) => {
  if (!q) return 1;
  const l = label.toLowerCase();
  let i = 0,
    s = 0,
    last = -2;
  for (const ch of q.toLowerCase()) {
    const j = l.indexOf(ch, i);
    if (j < 0) return 0;
    s += j === last + 1 ? 3 : 1;
    if (j === 0 || l[j - 1] === " ") s += 2;
    last = j;
    i = j + 1;
  }
  return s;
};

export function Palette({ mode, onClose, toggleRail }: { mode: "commands" | "shortcuts"; onClose: () => void; toggleRail: () => void }) {
  const ws = useWorkspace(),
    shell = useShell(),
    c = useAppearanceControls(),
    { state: win, control } = useWindowControls();
  const { draft, busy, dirty } = ws;
  const [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const back = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    list = useRef<HTMLUListElement>(null),
    returnTo = useRef<Element | null>(null);

  const items = useMemo<Item[]>(() => {
    const pages = shell.visible.map((name, i) => ({ name, key: "Alt " + (i + 1) }));
    if (mode === "shortcuts")
      return [
        ...pages.map((p) => ({ group: "Shortcuts", label: p.name, key: p.key, icon: pageIcons[p.name], run: () => shell.go(p.name) })),
        { group: "Shortcuts", label: "Command palette", key: "Ctrl K", icon: "search", run: () => shell.openPalette("commands") },
        { group: "Shortcuts", label: "Save changes", key: "Ctrl S", icon: "db", run: () => void ws.save() },
        { group: "Shortcuts", label: "Close menus and dialogs", key: "Esc", icon: "x", run: () => {} },
        { group: "Shortcuts", label: "Move inside tabs, charts and heatmaps", key: "← → ↑ ↓", icon: "keyboard", run: () => {} },
      ];
    const aiOn = draft.aiUsage.enabled,
      gitOn = draft.gitHistory.enabled,
      reduce = document.documentElement.dataset.motion === "reduce";
    return [
      ...pages.map((p) => ({ group: "Pages", label: "Go to " + p.name, icon: pageIcons[p.name], key: p.key, run: () => shell.go(p.name) })),
      { group: "Actions", label: "Scan all projects", icon: "play", run: () => void ws.execute("scan"), off: !!busy || !draft.projects.some((p) => p.isEnabled) },
      {
        group: "Actions",
        label: "Refresh AI usage",
        icon: "refresh",
        run: () => {
          shell.go("AI usage");
          void ws.execute("ai");
        },
        off: !!busy || !aiOn,
      },
      {
        group: "Actions",
        label: "Full rescan of AI usage",
        icon: "rescan",
        run: () => {
          shell.go("AI usage");
          void ws.execute("ai", undefined, true);
        },
        off: !!busy || !aiOn,
      },
      {
        group: "Actions",
        label: "Refresh Git history",
        icon: "branch",
        run: () => {
          shell.go("Code changes");
          void ws.execute("history");
        },
        off: !!busy || !gitOn,
      },
      {
        group: "Actions",
        label: "Add project…",
        icon: "plus",
        run: () => {
          shell.go("Projects");
          void ws.saveThen(() => window.codelines.addProject(), "Project added");
        },
        off: !!busy,
      },
      { group: "Actions", label: "Import project list…", icon: "upload", run: () => void ws.saveThen(() => window.codelines.importProjects(), "Project list imported"), off: !!busy },
      { group: "Actions", label: "Save changes", icon: "db", key: "Ctrl S", run: () => void ws.save(), off: !dirty || !!busy },
      {
        group: "Actions",
        label: "Discard edits",
        icon: "x",
        run: () =>
          ws.setDraft({ ...structuredClone(ws.state.settings), theme: draft.theme, appearance: draft.appearance, widget: draft.widget }),
        off: !dirty || !!busy,
      },
      { group: "Actions", label: "Cancel the running operation", icon: "stop", run: ws.cancel, off: !busy },
      ...c.skins.map((s) => ({
        group: "Appearance",
        label: "Skin: " + s.name,
        icon: "skin" as const,
        run: () => c.setSkin(s.id),
        off: c.busy || c.appearance.skin === s.id,
      })),
      { group: "Appearance", label: "Theme: System", icon: "monitor", run: () => c.setTheme("System"), off: c.busy },
      { group: "Appearance", label: "Theme: Light", icon: "sun", run: () => c.setTheme("Light"), off: c.busy },
      { group: "Appearance", label: "Theme: Dark", icon: "moon", run: () => c.setTheme("Dark"), off: c.busy },
      ...c.info.presets.map((a) => ({ group: "Appearance", label: "Accent: " + a.name, swatch: a.hex, run: () => c.pickAccent(a.hex), off: c.busy })),
      {
        group: "Appearance",
        label: reduce ? "Motion: full" : "Motion: reduce",
        icon: "motion",
        run: () => c.setMotion(reduce ? "Full" : "Reduce"),
        off: c.busy,
      },
      {
        group: "Appearance",
        label: c.appearance.density === "Compact" ? "Density: comfortable" : "Density: compact",
        icon: "table",
        run: () => c.setDensity(c.appearance.density === "Compact" ? "Comfortable" : "Compact"),
        off: c.busy,
      },
      { group: "Appearance", label: "Toggle navigation rail", icon: "sidebar", run: toggleRail },
      {
        group: "Window",
        label: draft.widget.enabled ? "Turn off desktop widget" : "Show desktop widget",
        icon: "widget",
        run: () => void ws.setWidget({ enabled: !draft.widget.enabled }),
      },
      { group: "Window", label: win.maximized ? "Restore window" : "Maximize window", icon: win.maximized ? "restore" : "max", run: () => void control("toggleMaximize") },
      { group: "Window", label: "Minimize window", icon: "min", run: () => void control("minimize") },
      {
        group: "Window",
        label: "Open the AI report in the browser",
        icon: "external",
        run: () => void window.codelines.openReport().catch((e: unknown) => ws.setError(e)),
        off: !!busy || !ws.state.ai?.combined,
      },
      { group: "Help", label: "Keyboard shortcuts", icon: "keyboard", key: "?", run: () => shell.openPalette("shortcuts") },
      { group: "Help", label: "About CodeLines", icon: "info", run: () => (requestAbout(), shell.go("Settings")) },
      { group: "Help", label: "Open GitHub repository", icon: "branch", run: () => openAboutLink("repo", ws.setError) },
      { group: "Help", label: "Report an issue", icon: "alert", run: () => openAboutLink("issues", ws.setError) },
      { group: "Help", label: "Release notes", icon: "external", run: () => openAboutLink("releases", ws.setError) },
      { group: "Help", label: `Visit ${developer.name} website`, icon: "external", run: () => openAboutLink("website", ws.setError) },
    ] satisfies Item[];
  }, [mode, shell, ws, draft, busy, dirty, c, win.maximized, control, toggleRail]);

  const filtered = useMemo(
    () =>
      items
        .map((x) => ({ x, s: score(x.label + " " + x.group, query) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => (query ? b.s - a.s : 0))
        .map((r) => r.x),
    [items, query],
  );
  const current = Math.min(active, Math.max(0, filtered.length - 1));

  useLayoutEffect(() => {
    returnTo.current = document.activeElement;
    input.current?.focus();
    play(back.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
    play(back.current?.firstElementChild, [{ opacity: 0, transform: "translateY(-14px) scale(0.98)" }, { opacity: 1, transform: "none" }], {
      duration: 240,
    });
    const el = returnTo;
    return () => {
      const t = el.current;
      if (t instanceof HTMLElement && t.isConnected) t.focus();
    };
  }, []);
  useLayoutEffect(() => {
    list.current?.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const run = (i: number) => {
    const x = filtered[i];
    if (!x || x.off) return;
    onClose();
    setTimeout(x.run, 10);
  };
  let group = "";
  return (
    <div
      className="palette-backdrop"
      ref={back}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label={mode === "shortcuts" ? "Keyboard shortcuts" : "Command palette"}>
        <div className="palette-input">
          <Icon name="search" />
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="lw-palette-list"
            aria-autocomplete="list"
            aria-activedescendant={filtered.length ? "lw-pl-" + current : undefined}
            placeholder={mode === "shortcuts" ? "Filter shortcuts…" : "Type a page, an action or a setting…"}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (filtered.length) setActive((current + (e.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(current);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              } else if (e.key === "Tab") e.preventDefault();
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-list" role="listbox" aria-label="Commands" id="lw-palette-list" ref={list}>
          {filtered.length ? (
            filtered.map((x, i) => {
              const head = x.group !== group && !query;
              group = x.group;
              return [
                head && (
                  <li key={"g" + x.group} className="pl-group" role="presentation">
                    {x.group}
                  </li>
                ),
                <li
                  key={x.group + x.label}
                  role="option"
                  id={"lw-pl-" + i}
                  className={(i === current ? "active" : "") + (x.off ? " off" : "")}
                  aria-selected={i === current}
                  aria-disabled={!!x.off}
                  onPointerMove={() => i !== current && setActive(i)}
                  onClick={() => run(i)}
                >
                  {x.swatch ? <span className="pl-sw" style={{ background: x.swatch }} /> : <Icon name={x.icon ?? "chev"} />}
                  <span className="pl-label">{x.label}</span>
                  {query && <span className="pl-group-tag">{x.group}</span>}
                  {x.key && <kbd>{x.key}</kbd>}
                </li>,
              ];
            })
          ) : (
            <li className="pl-empty" role="presentation">
              No matching pages, actions or settings
            </li>
          )}
        </ul>
        <div className="palette-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>Enter</kbd> run
          </span>
          <span>
            <kbd>Alt</kbd>+<kbd>1–7</kbd> pages
          </span>
          <span>
            <kbd>?</kbd> shortcuts
          </span>
        </div>
      </div>
    </div>
  );
}

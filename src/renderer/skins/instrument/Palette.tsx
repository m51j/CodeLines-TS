/** Command palette (Ctrl+K): every page, action, project, agent and appearance option in one list. */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAppearanceControls } from "../../appearance/controls";
import type { Page, PageDef } from "../../pages";
import { useWorkspace } from "../../workspace";
import { play } from "../../motion/core";
import { useSkin } from "./context";
import { Icon, type IconName } from "./icons";
import { pageIcons } from "./TitleBar";
import { developer, openAboutLink, requestAbout } from "../../about";
interface Item {
  group: string;
  label: string;
  hint?: string;
  icon?: IconName;
  swatch?: string;
  kbd?: string;
  run: () => void;
}
const lookOrigin = () => document.querySelector<HTMLElement>('.titlebar .tb-btn[aria-haspopup="dialog"]');
export function Palette({ visible, onClose }: { visible: PageDef[]; onClose: () => void }) {
  const ws = useWorkspace(),
    look = useAppearanceControls(),
    skin = useSkin();
  const { state, draft, busy, dirty } = ws;
  const items = useMemo(() => {
    const out: Item[] = [];
    const go = (p: Page) => skin.go(p);
    visible.forEach((p, i) => out.push({ group: "Go to", label: p.name, hint: p.hint, icon: pageIcons[p.name], kbd: "Alt " + (i + 1), run: () => go(p.name) }));
    const canScan = !busy && draft.projects.some((p) => p.isEnabled);
    if (canScan) out.push({ group: "Actions", label: "Scan all projects", icon: "play", kbd: "Ctrl Enter", run: () => void ws.execute("scan") });
    out.push({ group: "Actions", label: "Add project", hint: "Choose a folder", icon: "plus", run: () => void ws.saveThen(() => window.codelines.addProject(), "Project added") });
    if (draft.aiUsage.enabled && !busy) {
      out.push({ group: "Actions", label: "Refresh AI usage", icon: "refresh", run: () => (go("AI usage"), void ws.execute("ai")) });
      out.push({ group: "Actions", label: "Full AI rescan", icon: "refresh", run: () => (go("AI usage"), void ws.execute("ai", undefined, true)) });
    }
    if (draft.gitHistory.enabled && !busy && draft.projects.some((p) => p.isEnabled))
      out.push({ group: "Actions", label: "Refresh Git history", icon: "branch", run: () => (go("Code changes"), void ws.execute("history")) });
    if (dirty && !busy) out.push({ group: "Actions", label: "Save changes", icon: "save", kbd: "Ctrl S", run: () => void ws.save() });
    if (state.settings.lastSnapshot && !busy) out.push({ group: "Actions", label: "Export analysis as CSV", icon: "download", run: () => void ws.exportData("analysis", "csv") });
    if (state.ai?.combined && !busy) {
      out.push({ group: "Actions", label: "Export AI usage report (HTML)", icon: "download", run: () => void ws.exportData("ai", "html") });
      out.push({ group: "Actions", label: "Open AI usage report in browser", icon: "external", run: () => void window.codelines.openReport().catch((e: unknown) => ws.setError(e)) });
    }
    out.push({ group: "Actions", label: draft.widget.enabled ? "Hide desktop widget" : "Show desktop widget", icon: "widget", run: () => void ws.setWidget({ enabled: !draft.widget.enabled }) });
    if (!look.busy) {
      look.skins.forEach((s) => {
        if (s.id !== look.appearance.skin) out.push({ group: "Appearance", label: "Skin: " + s.name, hint: s.tagline, icon: "layers", run: () => look.setSkin(s.id, lookOrigin()) });
      });
      out.push(
        { group: "Appearance", label: "Theme: System", icon: "monitor", run: () => look.setTheme("System", lookOrigin()) },
        { group: "Appearance", label: "Theme: Light", icon: "sun", run: () => look.setTheme("Light", lookOrigin()) },
        { group: "Appearance", label: "Theme: Dark", icon: "moon", run: () => look.setTheme("Dark", lookOrigin()) },
        {
          group: "Appearance",
          label: look.appearance.motion === "Reduce" ? "Motion: full" : "Motion: reduce",
          icon: "wave",
          run: () => look.setMotion(look.appearance.motion === "Reduce" ? "Full" : "Reduce"),
        },
        {
          group: "Appearance",
          label: look.appearance.density === "Compact" ? "Density: comfortable" : "Density: compact",
          icon: "rows",
          run: () => look.setDensity(look.appearance.density === "Compact" ? "Comfortable" : "Compact"),
        },
      );
      look.info.presets.forEach((p) => out.push({ group: "Appearance", label: "Accent: " + p.name, swatch: p.hex, run: () => look.pickAccent(p.hex) }));
    }
    out.push(
      { group: "Help", label: "About CodeLines", hint: "Version, developer and links", icon: "info", run: () => (requestAbout(), go("Settings")) },
      { group: "Help", label: "Open GitHub repository", hint: "Source code", icon: "code", run: () => openAboutLink("repo", ws.setError) },
      { group: "Help", label: "Report an issue", hint: "GitHub issues", icon: "alert", run: () => openAboutLink("issues", ws.setError) },
      { group: "Help", label: "Release notes", hint: "GitHub releases", icon: "notes", run: () => openAboutLink("releases", ws.setError) },
      { group: "Help", label: `Visit ${developer.name} website`, hint: developer.site, icon: "external", run: () => openAboutLink("website", ws.setError) },
    );
    for (const p of state.settings.lastSnapshot?.projects ?? [])
      out.push({
        group: "Projects",
        label: p.projectName,
        hint: "Open in Analysis",
        icon: "folder",
        run: () => {
          ws.setSelected(p.projectId);
          go("Analysis");
        },
      });
    if (state.ai?.combined && draft.aiUsage.enabled)
      for (const [id, a] of Object.entries(state.ai.combined.agents))
        out.push({
          group: "AI agents",
          label: a.label,
          hint: "Open its usage report",
          icon: "spark",
          run: () => {
            skin.setAiAgent(id);
            go("AI usage");
          },
        });
    return out;
  }, [visible, state, draft, busy, dirty, ws, look, skin]);
  const [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = useMemo(() => {
    const list = items.filter((it) => words.every((w) => (it.group + " " + it.label + " " + (it.hint ?? "")).toLowerCase().includes(w)));
    if (words.length) list.sort((a, b) => Number(b.label.toLowerCase().startsWith(words[0])) - Number(a.label.toLowerCase().startsWith(words[0])));
    return list;
    // words is derived from query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query]);
  const cur = Math.min(active, Math.max(0, shown.length - 1));
  const back = useRef<HTMLDivElement>(null),
    box = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    list = useRef<HTMLDivElement>(null),
    prevFocus = useRef<Element | null>(null),
    closing = useRef(false);
  useLayoutEffect(() => {
    prevFocus.current = document.activeElement;
    play(back.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 140 });
    play(box.current, [{ opacity: 0, transform: "translateY(-14px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 240 });
    input.current?.focus();
  }, []);
  useLayoutEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cur, shown]);
  const close = (then?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    const a = play(back.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onClose();
    };
    if (a) a.onfinish = finish;
    setTimeout(finish, a ? 280 : 0);
    if (prevFocus.current instanceof HTMLElement) prevFocus.current.focus({ preventScroll: true });
    then?.();
  };
  const choose = (i: number) => {
    const it = shown[i];
    if (it) close(it.run);
  };
  const listId = "il-palette";
  let group = "";
  return (
    <div
      ref={back}
      className="pal-back"
      onPointerDown={(e) => {
        if (e.target === back.current) close();
      }}
    >
      <div
        ref={box}
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((cur + 1) % Math.max(1, shown.length));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((cur + shown.length - 1) % Math.max(1, shown.length));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(cur);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
          } else if (e.key === "Tab") e.preventDefault();
        }}
      >
        <div className="pal-top">
          <Icon name="search" size={18} />
          <input
            ref={input}
            className="pal-input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={shown.length ? `${listId}-${cur}` : undefined}
            placeholder="Search pages, actions, projects, agents, appearance…"
            spellCheck={false}
            aria-label="Command palette"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div ref={list} className="pal-list" role="listbox" id={listId} aria-label="Results">
          {shown.map((it, i) => {
            const head = !words.length && it.group !== group;
            group = it.group;
            return [
              head ? (
                <div key={"g" + it.group} className="pal-group">
                  {it.group}
                </div>
              ) : null,
              <div
                key={it.group + it.label}
                className="pal-item"
                role="option"
                id={`${listId}-${i}`}
                aria-selected={i === cur}
                onPointerMove={() => {
                  if (cur !== i) setActive(i);
                }}
                onClick={() => choose(i)}
              >
                {it.swatch ? <i className="pal-swatch" style={{ background: it.swatch }} /> : <Icon name={it.icon ?? "arrow"} size={16} />}
                <span className="pal-label">{it.label}</span>
                {it.hint && <span className="pal-hint">{it.hint}</span>}
                {words.length > 0 && <span className="pal-tag">{it.group}</span>}
                {it.kbd && <kbd>{it.kbd}</kbd>}
              </div>,
            ];
          })}
          {!shown.length && <p className="pal-empty">{`Nothing matches “${query}”.`}</p>}
        </div>
        <div className="pal-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>Enter</kbd> run
          </span>
          <span className="spacer" />
          <span>Everything in CodeLines is reachable from here</span>
        </div>
      </div>
    </div>
  );
}

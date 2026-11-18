/** Settings: a section index with scroll-spy, appearance, analysis defaults, Git history, AI usage, widget, local data. */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { scopes, type Settings } from "../../../../shared/contracts";
import { agentLabels } from "../../../../shared/agents";
import { scopeLabel } from "../../../format";
import { reduced } from "../../../motion/core";
import { useWorkspace } from "../../../workspace";
import { LookControls } from "../Appearance";
import { agentColor } from "../format";
import { Icon, type IconName } from "../icons";
import { Button, Check, Field, LinesInput, Select } from "../ui/controls";
import { Panel } from "../ui/layout";
const aiOptions = [
  ["Show AI usage page", "enabled"],
  ["Refresh when first opened in this session", "autoRefreshOnOpen"],
  ["Count each Claude request once (off = raw records)", "deduplicate"],
  ["Bucket AI usage in UTC", "useUtc"],
] as const;
const refreshChoices = [1, 5, 15, 30, 60];
type Section = "Appearance" | "Analysis defaults" | "Git history" | "AI usage" | "Desktop widget" | "Local data";
const sections: [Section, IconName][] = [
  ["Appearance", "palette"],
  ["Analysis defaults", "analysis"],
  ["Git history", "branch"],
  ["AI usage", "spark"],
  ["Desktop widget", "widget"],
  ["Local data", "folder"],
];
function Spy({ name, refs, children }: { name: Section; refs: RefObject<Partial<Record<Section, HTMLElement | null>>>; children: ReactNode }) {
  return (
    <div
      ref={(el) => {
        refs.current[name] = el;
      }}
      data-section={name}
      className="settings-section"
    >
      {children}
    </div>
  );
}
export function SettingsPage() {
  const { state, draft, busy, dirty, change, save, setDraft, act, setWidget } = useWorkspace();
  const refs = useRef<Partial<Record<Section, HTMLElement | null>>>({}),
    [current, setCurrent] = useState<Section>("Appearance");
  // Scroll-spy: the index follows the section in view.
  useEffect(() => {
    const els = Object.values(refs.current).filter((x): x is HTMLElement => !!x);
    const root = els[0]?.closest<HTMLElement>(".view") ?? null;
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target, e.isIntersecting);
        const first = sections.find(([name]) => {
          const el = refs.current[name];
          return el && seen.get(el);
        });
        if (first) setCurrent(first[0]);
      },
      { root, rootMargin: "-120px 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  const sw = (label: string, checked: boolean, set: (s: Settings, v: boolean) => void, note?: string) => (
    <Check switch label={label} note={note} checked={checked} onChange={(v) => change((s) => set(s, v))} />
  );
  return (
    <>
      <div className={"toolbar section-toolbar settings-bar" + (dirty ? " is-dirty" : "")}>
        <p className="muted">{dirty ? "You have unsaved changes." : "Changes take effect when saved or used by an analysis."}</p>
        <span className="spacer" />
        <Button
          label="Discard edits"
          icon="undo"
          disabled={!!busy || !dirty}
          onClick={() => setDraft({ ...structuredClone(state.settings), theme: draft.theme, appearance: draft.appearance, widget: draft.widget })}
        />
        <Button label="Save settings" primary icon="save" disabled={!!busy || !dirty} onClick={() => void save()} />
      </div>
      <div className="settings">
        <nav className="settings-index" aria-label="Settings sections">
          {sections.map(([name, icon]) => (
            <button
              key={name}
              type="button"
              className={current === name ? "is-on" : undefined}
              aria-current={current === name ? "true" : undefined}
              onClick={() => {
                setCurrent(name);
                refs.current[name]?.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" });
              }}
            >
              <Icon name={icon} size={15} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="settings-main">
          <Spy name="Appearance" refs={refs}>
            <Panel title="Appearance" subtitle="Skin, theme, accent, motion and density · applies at once and is saved with your settings">
              <LookControls className="look-wide" />
            </Panel>
          </Spy>
          <fieldset className="settings-form" disabled={!!busy}>
            <Spy name="Analysis defaults" refs={refs}>
              <Panel title="Analysis defaults" subtitle="Exact counts, calculated entirely offline">
                <div className="settings-grid">
                  <Field label="Counting scope">
                    <Select
                      label="Counting scope"
                      value={draft.scanOptions.countingScope}
                      options={scopes.map((s) => [s, scopeLabel(s)] as [string, string])}
                      onChange={(v) =>
                        change((s) => {
                          s.scanOptions.countingScope = v as Settings["scanOptions"]["countingScope"];
                        })
                      }
                    />
                  </Field>
                  <Field label="Tokenizer">
                    <Select
                      label="Tokenizer"
                      value={draft.scanOptions.tokenizerEncoding}
                      options={["o200k_base", "cl100k_base"]}
                      onChange={(v) =>
                        change((s) => {
                          s.scanOptions.tokenizerEncoding = v as "o200k_base" | "cl100k_base";
                        })
                      }
                    />
                  </Field>
                  <Field label="Maximum file size (MB)" help="Larger files are skipped and listed as warnings.">
                    <input
                      type="number"
                      min={0.01}
                      max={1024}
                      step={0.1}
                      value={draft.scanOptions.maxFileSizeBytes / 1024 ** 2}
                      onChange={(e) =>
                        change((s) => {
                          s.scanOptions.maxFileSizeBytes = Math.max(1, Math.round(Number(e.target.value) * 1024 ** 2));
                        })
                      }
                    />
                  </Field>
                  <Field label="Scan concurrency" help="Files read in parallel (1–128).">
                    <input
                      type="number"
                      min={1}
                      max={128}
                      value={draft.scanOptions.maxDegreeOfParallelism}
                      onChange={(e) =>
                        change((s) => {
                          s.scanOptions.maxDegreeOfParallelism = Math.min(128, Math.max(1, Math.round(Number(e.target.value)) || 1));
                        })
                      }
                    />
                  </Field>
                </div>
                <Field label="Global exclusions" help="One .gitignore-style rule per line; project exclusions are applied last.">
                  <LinesInput
                    label="Global exclusions"
                    rows={8}
                    value={draft.scanOptions.globalExcludePatterns}
                    onChange={(lines) =>
                      change((s) => {
                        s.scanOptions.globalExcludePatterns = lines;
                      })
                    }
                  />
                </Field>
              </Panel>
            </Spy>
            <Spy name="Git history" refs={refs}>
              <Panel title="Git history">
                {sw("Enable Git history statistics", draft.gitHistory.enabled, (s, v) => (s.gitHistory.enabled = v), "Shows the Code changes page")}
                <p className="muted">Uses the installed Git executable. Source scans and reports do not require Git.</p>
              </Panel>
            </Spy>
            <Spy name="AI usage" refs={refs}>
              <Panel title="AI usage" subtitle="Equivalent API costs from local logs; no accounts or API keys">
                <div className="check-list">
                  {aiOptions.map(([label, key]) => (
                    <Check
                      key={key}
                      switch
                      label={label}
                      checked={draft.aiUsage[key]}
                      onChange={(v) =>
                        change((s) => {
                          s.aiUsage[key] = v;
                        })
                      }
                    />
                  ))}
                  {sw("Refresh AI usage after every scan", draft.dailyLog.refreshAiAfterScan, (s, v) => (s.dailyLog.refreshAiAfterScan = v))}
                </div>
                <h3>Agents</h3>
                <div className="agents-grid" role="group" aria-label="Agents to read">
                  {Object.entries(agentLabels).map(([id, label]) => (
                    <Check
                      key={id}
                      className="agent-check"
                      label={
                        <span className="agent-name">
                          <i className="dot" style={{ background: agentColor(id) }} />
                          {label}
                        </span>
                      }
                      checked={!draft.aiUsage.disabledAgents.includes(id)}
                      onChange={(on) =>
                        change((s) => {
                          s.aiUsage.disabledAgents = s.aiUsage.disabledAgents.filter((x) => x !== id);
                          if (!on) s.aiUsage.disabledAgents.push(id);
                        })
                      }
                    />
                  ))}
                </div>
                <Field label="Extra Claude transcript folders (one per line)">
                  <LinesInput
                    label="Extra Claude transcript folders"
                    rows={3}
                    value={draft.aiUsage.extraClaudeRoots}
                    onChange={(lines) =>
                      change((s) => {
                        s.aiUsage.extraClaudeRoots = lines;
                      })
                    }
                  />
                </Field>
              </Panel>
            </Spy>
            <Spy name="Desktop widget" refs={refs}>
              <Panel title="Desktop widget" subtitle="Today's AI usage, streak and code totals in a small window on your desktop">
                <div className="check-list">
                  <Check switch label="Show the widget on the desktop" checked={draft.widget.enabled} onChange={(v) => void setWidget({ enabled: v })} />
                  <Check
                    switch
                    label="Keep it above other windows"
                    disabled={!draft.widget.enabled}
                    checked={draft.widget.alwaysOnTop}
                    onChange={(v) => void setWidget({ alwaysOnTop: v })}
                  />
                  <Check
                    switch
                    label="Start with Windows, showing only the widget"
                    disabled={!draft.widget.enabled}
                    checked={draft.widget.startWithWindows}
                    onChange={(v) => void setWidget({ startWithWindows: v })}
                  />
                </div>
                <div className="settings-grid">
                  <Field
                    label="Refresh AI usage"
                    help={draft.aiUsage.enabled ? "Runs in the background while the widget is visible." : "Turn on the AI usage page to refresh it."}
                  >
                    <Select
                      label="Refresh AI usage"
                      disabled={!draft.widget.enabled}
                      value={draft.widget.refreshMinutes}
                      options={refreshChoices.map((m) => [m, `Every ${m} ${m === 1 ? "minute" : "minutes"}`] as [number, string])}
                      onChange={(v) => void setWidget({ refreshMinutes: Number(v) })}
                    />
                  </Field>
                </div>
                <p className="muted">
                  These options apply at once. While the widget is on, closing CodeLines keeps it in the notification area; right-click the widget or the tray icon for more. Drag
                  to move it, drag its corner to resize, click it to open CodeLines.
                </p>
              </Panel>
            </Spy>
          </fieldset>
          <Spy name="Local data" refs={refs}>
            <Panel title="Local data & migration" subtitle="Import existing CodeLines projects, settings, snapshots, history, and daily records">
              <p className="mono selectable data-dir" title={state.dataDirectory}>
                <Icon name="folder" size={15} />
                {state.dataDirectory}
              </p>
              <p className="muted">Data uses a separate directory. Imports preserve legacy files, keep recovery copies, and can be repeated safely.</p>
              <div>
                <Button
                  label="Import legacy CodeLines data"
                  icon="upload"
                  disabled={!!busy}
                  onClick={() => void act(() => window.codelines.migrate(), "Legacy data migration finished")}
                />
              </div>
            </Panel>
          </Spy>
        </div>
      </div>
    </>
  );
}

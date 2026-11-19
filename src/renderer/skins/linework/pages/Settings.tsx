/**
 * Settings: a sticky save bar, a section index that follows the scroll, Appearance (skin,
 * theme, motion, density, accent with a live contrast readout), Analysis defaults, Git
 * history, AI usage with agents, the Desktop widget with a live preview, local data and About.
 */
import { useEffect, useMemo, useState } from "react";
import { agentLabels } from "../../../../shared/agents";
import type { WidgetView } from "../../../../shared/contracts";
import { widgetSummary } from "../../../../widget/summary";
import { useAppearanceControls } from "../../../appearance/controls";
import { reduced } from "../../../motion/core";
import { WidgetPanel } from "../../../widget/Widget";
import { useWorkspace } from "../../../workspace";
import { AccentPicker, ContrastReadout, DensitySeg, MotionSeg, SkinPicker, ThemeSeg } from "../Appearance";
import { useShell } from "../context";
import { Icon } from "../icons";
import { Check, Field, Group, LinesInput, Select, Sheet } from "../ui/controls";
import { agentColor } from "../ui/fmt";
import { scopeOptions, tokenizerOptions } from "../../../format";
import { appVersion, copyrightLine, developer, onAboutRequest, openAboutLink, type AboutLink } from "../../../about";
import { NexteLogo } from "../../../ui/NexteLogo";
import { runUpdateAction, updateView, useUpdateState } from "../../../update";

const sections = [
  ["appearance", "Appearance"],
  ["analysis", "Analysis defaults"],
  ["git", "Git history"],
  ["ai", "AI usage"],
  ["widget", "Desktop widget"],
  ["data", "Local data & migration"],
  ["about", "About"],
] as const;
const aiOptions = [
  ["Show AI usage page", "enabled"],
  ["Refresh when first opened in this session", "autoRefreshOnOpen"],
  ["Count each Claude request once (off = raw records)", "deduplicate"],
  ["Bucket AI usage in UTC", "useUtc"],
] as const;
const refreshChoices = [1, 5, 15, 30, 60];
const updateIcons = { check: "refresh", restart: "restore", download: "download" } as const;

export function SettingsPage() {
  const { state, draft, busy, dirty, change, save, setDraft, act, setWidget, setUpdates, setError } = useWorkspace();
  const update = updateView(useUpdateState());
  const { scroller } = useShell();
  const c = useAppearanceControls();
  const [on, setOn] = useState<string>(sections[0][0]);

  // Scroll-spy: the index follows the section under the top of the page.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const spy = () => {
      let cur: string = sections[0][0];
      for (const [id] of sections) {
        const s = document.getElementById("lw-set-" + id);
        if (s && s.getBoundingClientRect().top < 200) cur = id;
      }
      // The last sections never reach the top; at the bottom of the page the last one is current.
      if (el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2) cur = sections[sections.length - 1][0];
      setOn(cur);
    };
    el.addEventListener("scroll", spy, { passive: true });
    return () => el.removeEventListener("scroll", spy);
  }, [scroller]);
  useEffect(
    () =>
      onAboutRequest(() => {
        setOn("about");
        document.getElementById("lw-set-about")?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
      }),
    [],
  );
  const link = (to: AboutLink, label: string, icon: "external" | "branch" | "alert" | "info") => (
    <button className="btn" type="button" onClick={() => openAboutLink(to, setError)}>
      <Icon name={icon} />
      {label}
    </button>
  );

  const disabled = !!busy;
  return (
    <>
      <div className="settings-bar">
        <p className={"save-msg" + (dirty ? " dirty" : "")}>
          {dirty ? "You have unsaved changes." : "Changes take effect when saved or used by an analysis."}
        </p>
        <span className="spacer" />
        <button
          className="btn"
          type="button"
          disabled={disabled || !dirty}
          onClick={() => setDraft({ ...structuredClone(state.settings), theme: draft.theme, appearance: draft.appearance, widget: draft.widget })}
        >
          Discard edits
        </button>
        <button className="btn primary" type="button" disabled={disabled || !dirty} onClick={() => void save()}>
          Save settings
        </button>
      </div>
      <div className="settings-layout">
        <nav className="settings-index" aria-label="Settings sections">
          {sections.map(([id, label]) => (
            <a
              key={id}
              href={"#lw-set-" + id}
              className={on === id ? "on" : ""}
              aria-current={on === id ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("lw-set-" + id)?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="settings-body">
          <Sheet className="set-sec" id="lw-set-appearance" title="Appearance" sub="Skin, theme, accent, motion and density apply at once and are saved with your settings.">
            <SkinPicker c={c} />
            <div className="set-grid">
              <Group label="Theme">
                <ThemeSeg c={c} />
              </Group>
              <Group label="Motion" help="Reduce keeps only short fades: no sliding, scaling, counting or chart build-ups.">
                <MotionSeg c={c} system="Follow Windows" />
              </Group>
              <Group label="Density" help="Table rows and controls.">
                <DensitySeg c={c} />
              </Group>
            </div>
            <Group label="Accent">
              <AccentPicker c={c} />
            </Group>
            <ContrastReadout c={c} />
          </Sheet>
          <fieldset className="set-fieldset" disabled={disabled}>
            <Sheet className="set-sec" id="lw-set-analysis" title="Analysis defaults" sub="Exact counts, calculated entirely offline">
              <div className="set-grid">
                <Field label="Counting scope">
                  <Select
                    aria-label="Counting scope"
                    value={draft.scanOptions.countingScope}
                    options={scopeOptions}
                    onChange={(v) =>
                      change((s) => {
                        s.scanOptions.countingScope = v;
                      })
                    }
                  />
                </Field>
                <Field label="Tokenizer">
                  <Select
                    aria-label="Tokenizer"
                    value={draft.scanOptions.tokenizerEncoding}
                    options={tokenizerOptions}
                    onChange={(v) =>
                      change((s) => {
                        s.scanOptions.tokenizerEncoding = v;
                      })
                    }
                  />
                </Field>
                <Field label="Maximum file size (MB)" help="Larger files are skipped and listed as warnings.">
                  <input
                    className="input"
                    type="number"
                    min={0.01}
                    max={1024}
                    step={0.1}
                    value={+(draft.scanOptions.maxFileSizeBytes / 1024 ** 2).toFixed(2)}
                    onChange={(e) =>
                      change((s) => {
                        s.scanOptions.maxFileSizeBytes = Math.max(1, Math.round(Number(e.target.value) * 1024 ** 2));
                      })
                    }
                  />
                </Field>
                <Field label="Scan concurrency" help="Files read in parallel (1–128).">
                  <input
                    className="input"
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
                  className="mono"
                  rows={8}
                  value={draft.scanOptions.globalExcludePatterns}
                  onChange={(lines) =>
                    change((s) => {
                      s.scanOptions.globalExcludePatterns = lines;
                    })
                  }
                />
              </Field>
            </Sheet>
            <Sheet className="set-sec" id="lw-set-git" title="Git history">
              <Check
                label="Enable Git history statistics"
                checked={draft.gitHistory.enabled}
                onChange={(v) =>
                  change((s) => {
                    s.gitHistory.enabled = v;
                  })
                }
              />
              <p className="muted">
                Uses the installed Git executable. Source scans and reports do not require Git. Turning this off folds <b>Code changes</b> out
                of the navigation.
              </p>
            </Sheet>
            <Sheet className="set-sec" id="lw-set-ai" title="AI usage" sub="Equivalent API costs from local logs; no accounts or API keys">
              <div className="check-list">
                {aiOptions.map(([label, key]) => (
                  <Check
                    key={key}
                    label={label}
                    checked={draft.aiUsage[key]}
                    onChange={(v) =>
                      change((s) => {
                        s.aiUsage[key] = v;
                      })
                    }
                  />
                ))}
                <Check
                  label="Refresh AI usage after every scan"
                  checked={draft.dailyLog.refreshAiAfterScan}
                  onChange={(v) =>
                    change((s) => {
                      s.dailyLog.refreshAiAfterScan = v;
                    })
                  }
                />
              </div>
              <h3 className="sub-h">Agents</h3>
              <div className="agents-grid">
                {Object.entries(agentLabels).map(([id, label]) => (
                  <Check
                    key={id}
                    className="agent-check"
                    label={label}
                    before={<i className="dot" style={{ background: agentColor(id) }} />}
                    checked={!draft.aiUsage.disabledAgents.includes(id)}
                    onChange={(v) =>
                      change((s) => {
                        s.aiUsage.disabledAgents = s.aiUsage.disabledAgents.filter((x) => x !== id);
                        if (!v) s.aiUsage.disabledAgents.push(id);
                      })
                    }
                  />
                ))}
              </div>
              <Field label="Extra Claude transcript folders (one per line)">
                <LinesInput
                  className="mono"
                  rows={3}
                  value={draft.aiUsage.extraClaudeRoots}
                  onChange={(lines) =>
                    change((s) => {
                      s.aiUsage.extraClaudeRoots = lines;
                    })
                  }
                />
              </Field>
            </Sheet>
            <Sheet
              className="set-sec"
              id="lw-set-widget"
              bodyClass="widget-settings"
              title="Desktop widget"
              sub="Today's AI usage, streak and code totals in a small window on your desktop"
            >
              <div>
                <div className="check-list">
                  <Check label="Show the widget on the desktop" checked={draft.widget.enabled} onChange={(v) => void setWidget({ enabled: v })} />
                  <Check
                    label="Keep it above other windows"
                    disabled={!draft.widget.enabled}
                    checked={draft.widget.alwaysOnTop}
                    onChange={(v) => void setWidget({ alwaysOnTop: v })}
                  />
                  <Check
                    label="Start with Windows, showing only the widget"
                    disabled={!draft.widget.enabled}
                    checked={draft.widget.startWithWindows}
                    onChange={(v) => void setWidget({ startWithWindows: v })}
                  />
                </div>
                <div className="set-grid one">
                  <Field
                    label="Refresh AI usage"
                    help={draft.aiUsage.enabled ? "Runs in the background while the widget is visible." : "Turn on the AI usage page to refresh it."}
                  >
                    <Select
                      aria-label="Refresh AI usage"
                      disabled={!draft.widget.enabled}
                      value={String(draft.widget.refreshMinutes)}
                      onChange={(v) => void setWidget({ refreshMinutes: Number(v) })}
                      options={refreshChoices.map((m) => ({ value: String(m), label: `Every ${m} ${m === 1 ? "minute" : "minutes"}` }))}
                    />
                  </Field>
                </div>
                <p className="muted">
                  These options apply at once. While the widget is on, closing CodeLines keeps it in the notification area; right-click the
                  widget or the tray icon for more. Drag to move it, drag its corner to resize, click it to open CodeLines.
                </p>
              </div>
              <WidgetPreview dark={c.scheme === "dark"} />
            </Sheet>
          </fieldset>
          <Sheet
            className="set-sec"
            id="lw-set-data"
            title="Local data & migration"
            sub="Import existing CodeLines projects, settings, snapshots, history, and daily records"
          >
            <p className="data-dir mono selectable" title={state.dataDirectory}>
              <Icon name="db" />
              <span>{state.dataDirectory}</span>
            </p>
            <p className="muted">Data uses a separate directory. Imports preserve legacy files, keep recovery copies, and can be repeated safely.</p>
            <button className="btn" type="button" disabled={disabled} onClick={() => void act(() => window.codelines.migrate(), "Legacy data migration finished")}>
              <Icon name="upload" />
              Import legacy CodeLines data
            </button>
          </Sheet>
          <Sheet className="set-sec" id="lw-set-about" title="About" sub="Free, open-source software for understanding your code and AI usage">
            <div className="about-grid">
              <div className="about-block">
                <div className="brand">
                  <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
                    <rect className="bm-bg" x="1" y="1" width="38" height="38" rx="11" />
                    <path className="bm-l bm-1" d="M10 13h16" />
                    <path className="bm-l bm-2" d="M15 20h15" />
                    <path className="bm-l bm-3" d="M15 27h9" />
                  </svg>
                  <div className="brand-text">
                    <strong>CodeLines</strong>
                    <span>Version {appVersion()}</span>
                  </div>
                </div>
                <p className="muted">Project intelligence, local by design: your source and usage stay on this computer.</p>
              </div>
              <div className="about-block">
                <span className="about-label">Developed by</span>
                <NexteLogo height={20} className="about-nexte" />
                <p>
                  <strong>{developer.name}</strong> ·{" "}
                  <span lang="ar" dir="rtl">
                    {developer.nameAr}
                  </span>
                </p>
                <p className="muted">{developer.tagline}</p>
                <div className="about-actions">{link("website", developer.site, "external")}</div>
              </div>
              <div className="about-block">
                <span className="about-label">Open source</span>
                <p className="muted">{copyrightLine}</p>
                <div className="about-actions">
                  {link("repo", "GitHub repository", "branch")}
                  {link("issues", "Report an issue", "alert")}
                  {link("releases", "Release notes", "info")}
                </div>
              </div>
              <div className="about-block">
                <span className="about-label">Updates</span>
                <p className="muted update-status" data-tone={update.tone}>
                  {update.text}
                </p>
                {update.progress !== null && (
                  <div className="ui-update-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(update.progress)}>
                    <i style={{ width: `${update.progress}%` }} />
                  </div>
                )}
                {update.action && (
                  <div className="about-actions">
                    <button className="btn" type="button" disabled={update.action.disabled} onClick={() => runUpdateAction(update.action!.kind, setError)}>
                      <Icon name={updateIcons[update.action.icon]} />
                      {update.action.label}
                    </button>
                  </div>
                )}
                {update.canAutoCheck && (
                  <Check label="Check for updates automatically" checked={draft.updates.autoCheck} onChange={(v) => void setUpdates({ autoCheck: v })} />
                )}
              </div>
            </div>
          </Sheet>
        </div>
      </div>
    </>
  );
}

/** The real widget panel on the current data (as if saved), on a small desktop. */
function WidgetPreview({ dark }: { dark: boolean }) {
  const { state, draft } = useWorkspace();
  const [view, setView] = useState<WidgetView>({ tab: "overview", range: "today" });
  const data = useMemo(
    () => widgetSummary({ ai: state.ai, daily: state.daily, settings: { ...state.settings, aiUsage: draft.aiUsage, projects: draft.projects } }, Date.now(), dark),
    [state.ai, state.daily, state.settings, draft.aiUsage, draft.projects, dark],
  );
  return (
    <div className="widget-preview">
      <span className="wp-label">Live preview</span>
      <div className="wp-host">
        <div className="w-box" aria-label="Desktop widget preview">
          <WidgetPanel data={data} view={view} onView={setView} />
          <svg className="w-grip" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13 6 6 13M13 10l-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      </div>
    </div>
  );
}

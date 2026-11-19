import { Card, Field, LinesInput } from "../components";
import { scopeOptions, tokenizerOptions } from "../format";
import { Select } from "../ui/Select";
import { agentLabels } from "../../shared/agents";
import { useWorkspace } from "../workspace";
import { AppearanceCard } from "../skins/classic/AppearanceCard";
import { AboutCard } from "../skins/classic/AboutCard";
const aiOptions = [
  { label: "Show AI usage page", key: "enabled" },
  { label: "Refresh when first opened in this session", key: "autoRefreshOnOpen" },
  { label: "Count each Claude request once (off = raw records)", key: "deduplicate" },
  { label: "Bucket AI usage in UTC", key: "useUtc" },
] as const;
const refreshChoices = [1, 5, 15, 30, 60];
export function SettingsPage() {
  const { state, draft, busy, dirty, change, save, setDraft, act, setWidget } =
    useWorkspace();
  return (
    <>
      <div className="toolbar section-toolbar">
        <p className="muted">
          {dirty
            ? "You have unsaved changes."
            : "Changes take effect when saved or used by an analysis."}
        </p>
        <div className="spacer" />
        <button
          disabled={!!busy || !dirty}
          onClick={() =>
            setDraft({
              ...structuredClone(state.settings),
              theme: draft.theme,
              appearance: draft.appearance,
              widget: draft.widget,
            })
          }
        >
          Discard edits
        </button>
        <button
          className="primary"
          disabled={!!busy || !dirty}
          onClick={() => void save()}
        >
          Save settings
        </button>
      </div>
      <AppearanceCard />
      <fieldset disabled={!!busy}>
        <Card
          title="Analysis defaults"
          subtitle="Exact counts, calculated entirely offline"
        >
          <div className="settings-grid">
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
                type="number"
                min={0.01}
                max={1024}
                step={0.1}
                value={draft.scanOptions.maxFileSizeBytes / 1024 ** 2}
                onChange={(e) =>
                  change((s) => {
                    s.scanOptions.maxFileSizeBytes = Math.max(
                      1,
                      Math.round(Number(e.target.value) * 1024 ** 2),
                    );
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
                    s.scanOptions.maxDegreeOfParallelism = Math.min(
                      128,
                      Math.max(1, Math.round(Number(e.target.value)) || 1),
                    );
                  })
                }
              />
            </Field>
          </div>
          <Field
            label="Global exclusions"
            help="One .gitignore-style rule per line; project exclusions are applied last."
          >
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
        </Card>
        <Card title="Git history">
          <label className="check">
            <input
              type="checkbox"
              checked={draft.gitHistory.enabled}
              onChange={(e) =>
                change((s) => {
                  s.gitHistory.enabled = e.target.checked;
                })
              }
            />
            Enable Git history statistics
          </label>
          <p className="muted">
            Uses the installed Git executable. Source scans and reports do not
            require Git.
          </p>
        </Card>
        <Card
          title="AI usage"
          subtitle="Equivalent API costs from local logs; no accounts or API keys"
        >
          <div className="check-list">
            {aiOptions.map(({ label, key }) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={draft.aiUsage[key]}
                  onChange={(e) =>
                    change((s) => {
                      s.aiUsage[key] = e.target.checked;
                    })
                  }
                />
                {label}
              </label>
            ))}
            <label className="check">
              <input
                type="checkbox"
                checked={draft.dailyLog.refreshAiAfterScan}
                onChange={(e) =>
                  change((s) => {
                    s.dailyLog.refreshAiAfterScan = e.target.checked;
                  })
                }
              />
              Refresh AI usage after every scan
            </label>
          </div>
          <h3>Agents</h3>
          <div className="agents-grid">
            {Object.entries(agentLabels).map(([id, label]) => (
              <label className="check" key={id}>
                <input
                  type="checkbox"
                  checked={!draft.aiUsage.disabledAgents.includes(id)}
                  onChange={(e) =>
                    change((s) => {
                      s.aiUsage.disabledAgents = s.aiUsage.disabledAgents.filter(
                        (x) => x !== id,
                      );
                      if (!e.target.checked) s.aiUsage.disabledAgents.push(id);
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <Field label="Extra Claude transcript folders (one per line)">
            <LinesInput
              className="mono"
              value={draft.aiUsage.extraClaudeRoots}
              onChange={(lines) =>
                change((s) => {
                  s.aiUsage.extraClaudeRoots = lines;
                })
              }
            />
          </Field>
        </Card>
        <Card
          title="Desktop widget"
          subtitle="Today's AI usage, streak and code totals in a small window on your desktop"
        >
          <div className="check-list">
            <label className="check">
              <input
                type="checkbox"
                checked={draft.widget.enabled}
                onChange={(e) => void setWidget({ enabled: e.target.checked })}
              />
              Show the widget on the desktop
            </label>
            <label className="check">
              <input
                type="checkbox"
                disabled={!draft.widget.enabled}
                checked={draft.widget.alwaysOnTop}
                onChange={(e) =>
                  void setWidget({ alwaysOnTop: e.target.checked })
                }
              />
              Keep it above other windows
            </label>
            <label className="check">
              <input
                type="checkbox"
                disabled={!draft.widget.enabled}
                checked={draft.widget.startWithWindows}
                onChange={(e) =>
                  void setWidget({ startWithWindows: e.target.checked })
                }
              />
              Start with Windows, showing only the widget
            </label>
          </div>
          <div className="settings-grid">
            <Field
              label="Refresh AI usage"
              help={
                draft.aiUsage.enabled
                  ? "Runs in the background while the widget is visible."
                  : "Turn on the AI usage page to refresh it."
              }
            >
              <Select
                aria-label="Refresh AI usage"
                disabled={!draft.widget.enabled}
                value={String(draft.widget.refreshMinutes)}
                onChange={(v) => void setWidget({ refreshMinutes: Number(v) })}
                options={refreshChoices.map((m) => ({
                  value: String(m),
                  label: `Every ${m} ${m === 1 ? "minute" : "minutes"}`,
                }))}
              />
            </Field>
          </div>
          <p className="muted">
            These options apply at once. While the widget is on, closing
            CodeLines keeps it in the notification area; right-click the
            widget or the tray icon for more. Drag to move it, drag its corner
            to resize, click it to open CodeLines.
          </p>
        </Card>
      </fieldset>
      <Card
        title="Local data & migration"
        subtitle="Import existing CodeLines projects, settings, snapshots, history, and daily records"
      >
        <p className="mono selectable" title={state.dataDirectory}>
          {state.dataDirectory}
        </p>
        <p className="muted">
          Data uses a separate directory. Imports preserve legacy files, keep
          recovery copies, and can be repeated safely.
        </p>
        <button
          disabled={!!busy}
          onClick={() =>
            void act(
              () => window.codelines.migrate(),
              "Legacy data migration finished",
            )
          }
        >
          Import legacy CodeLines data
        </button>
      </Card>
      <AboutCard />
    </>
  );
}

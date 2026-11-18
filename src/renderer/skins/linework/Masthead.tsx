/**
 * The page header on ruled paper: eyebrow, the title (it slides up out of a mask on a page
 * change), the latest scan or AI refresh, the large outlined page numeral (an odometer
 * slide), and the console with the scan or AI actions.
 */
import { forwardRef } from "react";
import { scopes, type Settings } from "../../../shared/contracts";
import type { PageDef } from "../../pages";
import { useWorkspace } from "../../workspace";
import { Icon } from "./icons";
import { Select } from "./ui/controls";
import { date, scopeLabel } from "./ui/fmt";

export const Masthead = forwardRef<HTMLElement, { page: PageDef; index: number }>(function Masthead({ page, index }, ref) {
  const { state, draft, busy, change, execute, exportData, setError } = useWorkspace();
  const ai = page.name === "AI usage";
  const meta = ai
    ? state.ai
      ? "Latest AI refresh " + date(state.ai.generatedAt)
      : "Refresh to read local AI agent usage."
    : state.settings.lastSnapshot
      ? "Latest scan " + date(state.settings.lastSnapshot.scannedAt)
      : "A clearer view starts with your first scan.";
  const ready = !!state.ai?.combined;
  return (
    <header className="masthead" ref={ref}>
      <div className="mh-text">
        <span className="eyebrow">
          <i aria-hidden="true" />
          {page.hint}
        </span>
        <h1>
          <span className="mh-title">{page.name}</span>
        </h1>
        <p className="mh-meta">
          <Icon name="clock" />
          <span>{meta}</span>
        </p>
      </div>
      <span className="mh-num" aria-hidden="true">
        {String(index).padStart(2, "0")}
      </span>
      {page.scan && (
        <div className="console" role="group" aria-label="Scan controls">
          <label className="console-field">
            <span>Scope</span>
            <Select
              aria-label="Counting scope"
              disabled={!!busy}
              value={draft.scanOptions.countingScope}
              onChange={(e) =>
                change((s) => {
                  s.scanOptions.countingScope = e.target.value as Settings["scanOptions"]["countingScope"];
                })
              }
            >
              {scopes.map((s) => (
                <option key={s} value={s}>
                  {scopeLabel(s)}
                </option>
              ))}
            </Select>
          </label>
          <label className="console-field">
            <span>Tokenizer</span>
            <Select
              aria-label="Tokenizer"
              disabled={!!busy}
              value={draft.scanOptions.tokenizerEncoding}
              onChange={(e) =>
                change((s) => {
                  s.scanOptions.tokenizerEncoding = e.target.value as Settings["scanOptions"]["tokenizerEncoding"];
                })
              }
            >
              <option>o200k_base</option>
              <option>cl100k_base</option>
            </Select>
          </label>
          <button
            className={"btn primary scan-btn" + (busy?.kind === "scan" ? " running" : "")}
            type="button"
            disabled={!!busy || !draft.projects.some((p) => p.isEnabled)}
            onClick={() => void execute("scan")}
          >
            {busy?.kind === "scan" ? (
              <>
                <span className="spin" aria-hidden="true" />
                Scanning…
              </>
            ) : (
              <>
                <Icon name="play" />
                Scan all projects
              </>
            )}
          </button>
        </div>
      )}
      {ai && (
        <div className="console" role="group" aria-label="AI usage actions">
          <button className="btn primary" type="button" disabled={!!busy} onClick={() => void execute("ai")}>
            {busy?.kind === "ai" ? (
              <>
                <span className="spin" aria-hidden="true" />
                Refreshing…
              </>
            ) : (
              <>
                <Icon name="refresh" />
                Refresh
              </>
            )}
          </button>
          <button className="btn" type="button" disabled={!!busy} onClick={() => void execute("ai", undefined, true)}>
            <Icon name="rescan" />
            Full rescan
          </button>
          <button
            className="btn"
            type="button"
            disabled={!!busy || !ready}
            onClick={() => void window.codelines.openReport().catch((e: unknown) => setError(e))}
          >
            <Icon name="external" />
            Open in browser
          </button>
          {ready && (
            <>
              <span className="console-sep" aria-hidden="true" />
              <button className="btn" type="button" disabled={!!busy} onClick={() => void exportData("ai", "html")}>
                <Icon name="download" />
                Export HTML
              </button>
              <button className="btn" type="button" disabled={!!busy} onClick={() => void exportData("ai", "json")}>
                JSON
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
});

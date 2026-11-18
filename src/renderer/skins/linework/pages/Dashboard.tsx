/**
 * Dashboard (layout adapted from the Codex gpt-6 entry, drawn with Linework tokens): a
 * "Workspace footprint" hero with the project terrain, four metric cards with 30-day
 * sparklines that drill into their pages, the project table with glyphs and a composition
 * bar, and the language donut with its share list and per-language table.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ProjectMetric } from "../../../../shared/contracts";
import { payloadTotals } from "../../../../ai/aggregate";
import { dayParts, tokens } from "../../../../ai/model";
import { timeline } from "../../../../domain/daily";
import { useFlip } from "../../../motion/core";
import { useWorkspace } from "../../../workspace";
import { useShell, type AnalysisTab } from "../context";
import { Donut } from "../charts/Donut";
import { Spark } from "../charts/Spark";
import { Terrain } from "../charts/Terrain";
import { Icon, type IconName } from "../icons";
import { EmptyState, Tk } from "../ui/controls";
import { afterPaint } from "../ui/paint";
import { langColor, number, percent, plural } from "../ui/fmt";
import { Table, type Col } from "../ui/Table";
import type { Page } from "../../../pages";

const glyphs: IconName[] = ["lines", "branch", "db", "spark", "widget", "analysis", "folder", "calendar"];

export function Dashboard() {
  const { state, draft, busy, act, selected, setSelected } = useWorkspace();
  const shell = useShell();
  const snap = state.settings.lastSnapshot,
    results = useMemo(() => snap?.projects ?? [], [snap]),
    current = results.find((p) => p.projectId === selected) ?? results[0];
  const enabledIds = useMemo(() => draft.projects.filter((p) => p.isEnabled).map((p) => p.id), [draft.projects]);
  const rows = useMemo(() => timeline(state.daily, enabledIds, true).slice(-30), [state.daily, enabledIds]);
  const combined = state.ai?.combined;
  const ai30 = useMemo(() => {
    if (!combined) return null;
    const cut = dayParts(Date.now() - 30 * 86400000, false).day;
    return tokens(payloadTotals(combined, (d) => d > cut));
  }, [combined]);
  const listRef = useRef<HTMLDivElement>(null);
  const capture = useFlip(listRef, ".language-share", (el) => el.dataset.k, { enterNew: true });
  const pick = (id: string) => {
    if (id === current?.projectId) return;
    capture();
    setSelected(id);
  };

  if (!snap || !results.length)
    return (
      <EmptyState
        title="Meet your codebase"
        action={
          <button
            className="btn primary"
            type="button"
            disabled={!!busy}
            onClick={() => {
              shell.go("Projects");
              void act(() => window.codelines.addProject(), "Project added");
            }}
          >
            <Icon name="plus" />
            Add your first project
          </button>
        }
      >
        Add your project folders, then scan to see files, languages, lines, and tokens.
      </EmptyState>
    );

  const scanned = rows.filter((r) => r.lines),
    first = scanned[0]?.lines?.physicalLines,
    last = scanned.at(-1)?.lines?.physicalLines,
    growth = first && last && scanned.length > 1 ? (last - first) / first : null;
  const aiPage = shell.visible.includes("AI usage");
  const metrics: {
    id: string;
    label: string;
    icon: IconName;
    color: string;
    go?: Page;
    tab?: AnalysisTab;
    goLabel: string;
    values: number[];
    value: number | string;
    detail: string;
    title: string;
  }[] = [
    {
      id: "projects",
      label: "Projects",
      icon: "folder",
      color: "var(--accent-ui)",
      go: "Projects",
      goLabel: "Projects",
      values: rows.map((r) => r.projects),
      value: results.length,
      detail: `${draft.projects.filter((p) => p.isEnabled).length} enabled`,
      title: number(results.length),
    },
    {
      id: "files",
      label: "Files",
      icon: "table",
      color: "var(--s-1)",
      go: "Analysis",
      tab: "Files",
      goLabel: "Analysis · Files",
      values: rows.map((r) => r.lines?.files ?? 0),
      value: snap.fileCount,
      detail: "Across the latest scan",
      title: number(snap.fileCount),
    },
    {
      id: "tokens",
      label: "Source tokens",
      icon: "db",
      color: "var(--s-3)",
      go: "Analysis",
      goLabel: "Analysis",
      values: rows.map((r) => r.lines?.tokens ?? 0),
      value: snap.totalTokens,
      detail: snap.tokenizerEncoding,
      title: number(snap.totalTokens),
    },
    {
      id: "ai",
      label: "AI tokens · 30 days",
      icon: "spark",
      color: "var(--s-2)",
      go: aiPage ? "AI usage" : undefined,
      goLabel: "AI usage",
      values: ai30 === null ? [] : rows.map((r) => r.ai?.tokens ?? 0),
      value: ai30 ?? "—",
      detail: ai30 === null ? "AI usage is off or not refreshed" : "Cache included · all agents",
      title: ai30 === null ? "" : number(ai30),
    },
  ];

  return (
    <>
      <div className="dash-top">
        <section className="footprint" aria-label="Workspace footprint">
          <div className="hero-grid" aria-hidden="true" />
          <Terrain projects={results} selectedId={current?.projectId} onPick={pick} />
          <div className="footprint-text">
            <div className="kicker">
              <Icon name="lines" />
              Workspace footprint
            </div>
            <strong className="giant" title={number(snap.physicalLines)}>
              <Tk value={snap.physicalLines} k="dash.physical" />
            </strong>
            <span className="hero-unit">
              Physical lines <small>· every line, blank included</small>
            </span>
            {growth !== null && (
              <div className={"foot-growth" + (growth < 0 ? " down" : "")}>
                <Icon name="up" />
                {growth > 0 ? "+" : ""}
                {percent(growth)} <small>vs. {scanned.length >= 30 ? "30 days ago" : "the first day in the log"}</small>
              </div>
            )}
          </div>
          <div className="footprint-bottom">
            <button
              type="button"
              className="fp-code"
              aria-label="Code lines — open Analysis"
              title={number(snap.codeLines) + " code lines"}
              onClick={() => shell.go("Analysis")}
            >
              <Icon name="analysis" />
              <b>
                <Tk value={snap.codeLines} k="dash.code" />
              </b>
              <span>code lines</span>
              <span
                className="fp-spark"
                data-tip-t="Code lines · 30-day trend"
                data-tip={
                  scanned.length
                    ? `From: ${number(scanned[0].lines?.codeLines)} · To: ${number(scanned.at(-1)?.lines?.codeLines)}`
                    : "No daily log yet"
                }
              >
                <Spark values={rows.map((r) => r.lines?.codeLines ?? 0)} w={90} h={18} zero={false} area={false} />
              </span>
            </button>
            <span className="plot-id">
              <Icon name="dash" />
              Project terrain · pick a summit
            </span>
          </div>
        </section>
        <div className="mini-grid">
          {metrics.map((m, i) => {
            const inner = (
              <>
                <span className="metric-label">
                  <span className="metric-icon">
                    <Icon name={m.icon} />
                  </span>
                  <span>{m.label}</span>
                  {m.go && (
                    <span className="metric-go" aria-hidden="true">
                      <Icon name="arrow" />
                    </span>
                  )}
                </span>
                <span className="metric-middle">
                  <strong className="metric-value" title={m.title}>
                    <Tk value={m.value} k={"dash.m." + m.id} />
                  </strong>
                  <span className="metric-spark">{m.values.length > 0 && <Spark values={m.values} zero={false} />}</span>
                </span>
                <small className="metric-detail">{m.detail}</small>
              </>
            );
            const style = { ["--series" as string]: m.color, ["--i" as string]: i };
            return m.go ? (
              <button
                key={m.id}
                type="button"
                className="metric is-link"
                style={style}
                aria-label={`${m.label} — open ${m.goLabel}`}
                onClick={() => shell.go(m.go!, { tab: m.tab })}
              >
                {inner}
              </button>
            ) : (
              <div key={m.id} className="metric" style={style}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
      <div className="dash-bottom">
        <section className="sheet" id="dash-overview">
          <header className="sheet-head">
            <div>
              <h2>Project overview</h2>
              <p>Latest scan across {plural(results.length, "project")} · select a project to explore its languages</p>
            </div>
            <div className="sheet-actions">
              <button type="button" className="btn sm ghost" onClick={() => shell.go("Projects")}>
                <Icon name="external" />
                Projects
              </button>
            </div>
          </header>
          <div className="sheet-body">
            <ProjectTable results={results} selectedId={current?.projectId} onPick={pick} />
          </div>
        </section>
        {current && <LanguageSheet project={current} listRef={listRef} />}
      </div>
    </>
  );
}

function ProjectTable({ results, selectedId, onPick }: { results: ProjectMetric[]; selectedId?: string; onPick: (id: string) => void }) {
  const columns = useMemo<Col<ProjectMetric>[]>(() => {
    const glyph = (r: ProjectMetric) => {
      const i = Math.max(0, results.indexOf(r));
      return { ic: glyphs[i % glyphs.length], c: `var(--s-${(i % 12) + 1})` };
    };
    return [
      {
        key: "projectName",
        label: "Project",
        value: (r) => r.projectName,
        cls: () => "project-cell",
        render: (r) => {
          const g = glyph(r);
          return (
            <span className="project-name">
              <span className="project-glyph" style={{ ["--series" as string]: g.c }}>
                <Icon name={g.ic} />
              </span>
              <span className="pn-text">
                <strong>{r.projectName}</strong>
                <small>{r.rootPath}</small>
              </span>
            </span>
          );
        },
      },
      { key: "fileCount", label: "Files", value: (r) => r.fileCount },
      { key: "physicalLines", label: "Physical lines", value: (r) => r.physicalLines },
      { key: "codeLines", label: "Code lines", value: (r) => r.codeLines },
      { key: "totalTokens", label: "Source tokens", value: (r) => r.totalTokens },
      {
        key: "composition",
        label: "Composition",
        num: false,
        title: "Code / comment / content / blank lines",
        value: (r) => r.codeLines / (r.physicalLines || 1),
        render: (r) => {
          const t = r.physicalLines || 1,
            parts: [string, number, string][] = [
              ["Code", r.codeLines, "var(--success)"],
              ["Comment", r.commentLines, "var(--s-5)"],
              ["Content", r.contentLines, "var(--s-12)"],
              ["Blank", r.blankLines, "var(--line-strong)"],
            ];
          return (
            <span
              className="micro-stack"
              tabIndex={0}
              data-tip-t={r.projectName + " · composition"}
              data-tip={parts.map((p) => `${p[0]}: ${number(p[1])} (${percent(p[1] / t)})`).join(" · ")}
            >
              {parts.map((p) => (
                <i key={p[0]} style={{ flex: p[1], background: p[2] }} />
              ))}
            </span>
          );
        },
      },
    ];
  }, [results]);
  return (
    <Table
      label="Project overview"
      rows={results}
      columns={columns}
      rowKey={(r) => r.projectId}
      isSelected={(r) => r.projectId === selectedId}
      onSelect={(r) => onPick(r.projectId)}
    />
  );
}

function LanguageSheet({ project, listRef }: { project: ProjectMetric; listRef: RefObject<HTMLDivElement | null> }) {
  const total = project.physicalLines || 1;
  const langs = useMemo(() => [...project.languages].sort((a, b) => b.physicalLines - a.physicalLines), [project]);
  const lead = langs[0];
  // Bars fill from empty on first show, then slide to new shares when the project changes.
  const [grown, setGrown] = useState(false);
  useEffect(() => afterPaint(() => setGrown(true)), []);
  const segs = project.languages.map((l) => ({
    key: l.language,
    label: l.language,
    value: l.physicalLines,
    color: langColor(l.language),
    detail: `Files: ${number(l.files)} · Lines: ${number(l.physicalLines)} · Tokens: ${number(l.tokens)} · Share: ${percent(l.physicalLines / total)}`,
  }));
  const rows = project.languages.map((l) => ({ ...l, share: l.physicalLines / total }));
  return (
    <section className="sheet lang-sheet" id="dash-langs">
      <header className="sheet-head">
        <div>
          <h2>Language share</h2>
          <p className="lang-project">{project.projectName}</p>
        </div>
        <span className="sheet-glyph" aria-hidden="true">
          <Icon name="bars" />
        </span>
      </header>
      <div className="sheet-body">
        <div className="language-pie">
          <Donut items={segs} center={String(segs.length)} caption="languages" />
          <div className="lang-leader" style={{ ["--lead" as string]: lead ? langColor(lead.language) : "var(--muted)" }}>
            <span>Primary language</span>
            <b>{lead ? lead.language : "—"}</b>
            <small>{lead ? `${percent(lead.physicalLines / total)} of lines` : "No language data"}</small>
          </div>
        </div>
        <div className="language-list" role="region" aria-label="Language share" tabIndex={0} ref={listRef}>
          {!project.languages.length && <p className="muted">No language data for this project.</p>}
          {project.languages.map((l, i) => {
            const share = l.physicalLines / total;
            return (
              <div className="language-share" data-k={l.language} key={l.language} style={{ ["--i" as string]: i }}>
                <div className="ls-top">
                  <span className="ls-name">
                    <i style={{ background: langColor(l.language) }} />
                    {l.language}
                  </span>
                  <strong>{percent(share)}</strong>
                </div>
                <div className="share-track">
                  <i style={{ width: grown ? (share * 100).toFixed(2) + "%" : 0, background: langColor(l.language) }} />
                </div>
                <small>
                  {plural(l.files, "file")} · {number(l.physicalLines)} lines · {number(l.tokens)} tokens
                </small>
              </div>
            );
          })}
        </div>
        <details className="language-detail">
          <summary>
            <Icon name="chev" />
            Files, lines and tokens
          </summary>
          <Table
            label="Languages: files, lines and tokens"
            rows={rows}
            searchMin={1e9}
            rowKey={(r) => r.language}
            columns={[
              {
                key: "language",
                label: "Language",
                value: (r) => r.language,
                render: (r) => (
                  <span className="agent-name">
                    <i style={{ background: langColor(r.language) }} />
                    {r.language}
                  </span>
                ),
              },
              { key: "files", label: "Files", value: (r) => r.files },
              { key: "physicalLines", label: "Lines", value: (r) => r.physicalLines },
              { key: "tokens", label: "Tokens", value: (r) => r.tokens },
              { key: "share", label: "Share", num: true, value: (r) => r.share, render: (r) => percent(r.share) },
            ]}
          />
        </details>
      </div>
    </section>
  );
}


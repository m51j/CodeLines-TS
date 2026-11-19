/**
 * Analysis: project and category pickers with exports, six instrument tiles, the line
 * anatomy ribbon, and tabs (sliding ink bar) over the language, category, file and
 * warning views of the selected project.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CategoryMetric, FileMetric, LanguageMetric } from "../../../../shared/contracts";
import { play } from "../../../motion/core";
import { useWorkspace } from "../../../workspace";
import { useShell, type AnalysisTab } from "../context";
import { Ribbon } from "../charts/Ribbon";
import { Icon } from "../icons";
import { Tabs } from "../ui/Choice";
import { EmptyState, Field, Select, Sheet, Tiles } from "../ui/controls";
import { categories, categoryLabel, langColor, number, percent } from "../ui/fmt";
import { Table, type Col } from "../ui/Table";

const tabs: AnalysisTab[] = ["Languages", "Categories", "Files", "Warnings"];

const langCols: Col<LanguageMetric>[] = [
  {
    key: "language",
    label: "Language",
    value: (r) => r.language,
    path: true,
    render: (r) => (
      <span className="agent-name">
        <i style={{ background: langColor(r.language) }} />
        {r.language}
      </span>
    ),
  },
  { key: "category", label: "Category", value: (r) => categoryLabel(r.category) },
  { key: "files", label: "Files", value: (r) => r.files },
  { key: "bytes", label: "Bytes", value: (r) => r.bytes },
  { key: "tokens", label: "Tokens", value: (r) => r.tokens },
  { key: "physicalLines", label: "Physical", value: (r) => r.physicalLines },
  { key: "blankLines", label: "Blank", value: (r) => r.blankLines },
  { key: "codeLines", label: "Code", value: (r) => r.codeLines },
  { key: "commentLines", label: "Comment", value: (r) => r.commentLines },
  { key: "mixedLines", label: "Mixed", value: (r) => r.mixedLines },
  { key: "contentLines", label: "Content", value: (r) => r.contentLines },
];
const catCols: Col<CategoryMetric>[] = [
  { key: "category", label: "Category", value: (r) => categoryLabel(r.category), path: true },
  { key: "files", label: "Files", value: (r) => r.files },
  { key: "tokens", label: "Tokens", value: (r) => r.tokens },
  { key: "physicalLines", label: "Physical lines", value: (r) => r.physicalLines },
  { key: "codeOrContentLines", label: "Code + content", value: (r) => r.codeOrContentLines },
];
const lineKeys = ["physicalLines", "blankLines", "codeLines", "commentLines", "mixedLines", "contentLines"] as const,
  lineLabels = ["Physical", "Blank", "Code", "Comment", "Mixed", "Content"];
const fileCols: Col<FileMetric>[] = [
  { key: "relativePath", label: "Path", value: (r) => r.relativePath, path: true },
  { key: "extension", label: "Extension", value: (r) => r.extension },
  { key: "language", label: "Language", value: (r) => r.language },
  { key: "category", label: "Category", value: (r) => categoryLabel(r.category) },
  { key: "bytes", label: "Bytes", value: (r) => r.bytes },
  { key: "tokens", label: "Tokens", value: (r) => r.tokens },
  ...lineKeys.map((k, i) => ({ key: k, label: lineLabels[i], value: (f: FileMetric) => f.lines[k] })),
];

export function Analysis() {
  const { state, busy, exportData, selected, setSelected } = useWorkspace();
  const shell = useShell();
  const [tab, setTab] = useState<AnalysisTab>(() => shell.takeAnalysisTab() ?? "Languages"),
    [category, setCategory] = useState("all");
  const results = state.settings.lastSnapshot?.projects ?? [],
    r = results.find((p) => p.projectId === selected) ?? results[0];
  const languages = useMemo(() => r?.languages.filter((l) => category === "all" || l.category === category) ?? [], [r, category]),
    files = useMemo(() => r?.files.filter((f) => category === "all" || f.category === category) ?? [], [r, category]);
  const panel = useRef<HTMLDivElement>(null),
    shown = useRef(`${tab}|${category}|${r?.projectId}`);
  const panelKey = `${tab}|${category}|${r?.projectId}`;
  useLayoutEffect(() => {
    if (shown.current === panelKey) return;
    shown.current = panelKey;
    play(panel.current, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 240 });
  }, [panelKey]);

  if (!r)
    return (
      <EmptyState title="Every line has a story">Scan a project to explore detailed language, category, file, and token metrics.</EmptyState>
    );
  const t = r.physicalLines || 1,
    pure = r.codeLines - r.mixedLines;
  const anatomy = [
    { key: "code", label: "Code", value: pure, color: "var(--success)" },
    { key: "mixed", label: "Mixed", value: r.mixedLines, color: "var(--s-7)" },
    { key: "comment", label: "Comment", value: r.commentLines, color: "var(--s-5)" },
    { key: "content", label: "Content", value: r.contentLines, color: "var(--s-12)" },
    { key: "blank", label: "Blank", value: r.blankLines, color: "var(--line-strong)" },
  ].map((p) => ({ ...p, share: p.value / t, detail: `Lines: ${number(p.value)} · Share: ${percent(p.value / t)}` }));

  return (
    <>
      <div className="toolbar section-toolbar">
        <Field label="Project">
          <Select aria-label="Analysis project" value={r.projectId} onChange={setSelected} options={results.map((p) => ({ value: p.projectId, label: p.projectName }))} />
        </Field>
        <Field label="Category">
          <Select
            aria-label="Analysis category"
            value={category}
            onChange={setCategory}
            options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: categoryLabel(c) }))]}
          />
        </Field>
        <span className="spacer" />
        <button className="btn" type="button" disabled={!!busy} onClick={() => void exportData("analysis", "csv")}>
          <Icon name="download" />
          Export CSV
        </button>
        <button className="btn" type="button" disabled={!!busy} onClick={() => void exportData("analysis", "json")}>
          JSON
        </button>
      </div>
      <Tiles
        prefix="analysis"
        items={[
          { id: "files", label: "Files", value: r.fileCount, fmt: number },
          { id: "physical", label: "Physical lines", value: r.physicalLines, title: number(r.physicalLines) },
          { id: "code", label: "Code", value: r.codeLines, title: number(r.codeLines), tone: "success" },
          { id: "comments", label: "Comments", value: r.commentLines, title: number(r.commentLines) },
          { id: "content", label: "Content", value: r.contentLines, title: number(r.contentLines), detail: "Documentation text" },
          { id: "tokens", label: "Tokens", value: r.totalTokens, title: number(r.totalTokens), tone: "accent" },
        ]}
      />
      <Sheet
        className="anatomy"
        title="Line anatomy"
        sub="How the physical lines of this project break down. Mixed lines (code with a comment) count as code."
      >
        <Ribbon segments={anatomy} className="tall" />
        <div className="legend">
          {anatomy.map((p) => (
            <span key={p.key}>
              <i style={{ background: p.color }} />
              {p.label} · {percent(p.share)}
            </span>
          ))}
        </div>
      </Sheet>
      <Tabs
        label="Analysis views"
        id="lw-an"
        value={tab}
        onChange={setTab}
        options={tabs.map((x) => ({
          v: x,
          controls: "lw-an-panel",
          l:
            x === "Warnings" ? (
              <>
                Warnings <span className="count">{r.warnings.length}</span>
              </>
            ) : (
              x
            ),
        }))}
      />
      <div role="tabpanel" id="lw-an-panel" className="tab-panel" aria-labelledby={"lw-an-t-" + tab} ref={panel}>
        <Sheet title={tab} sub={<span className="mono">{r.rootPath}</span>}>
          {tab === "Languages" && <Table label="Language analysis" rows={languages} columns={langCols} rowKey={(x) => x.language} />}
          {tab === "Categories" && <Table label="Category analysis" rows={r.categories} columns={catCols} rowKey={(x) => x.category} />}
          {tab === "Files" && <Table label="File analysis" rows={files} columns={fileCols} rowKey={(x) => x.relativePath} />}
          {tab === "Warnings" &&
            (r.warnings.length ? (
              <ul className="warnings">
                {r.warnings.map((w, i) => (
                  <li key={i}>
                    <Icon name="alert" />
                    <span className="mono">{w}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No warnings or skipped paths were reported.</p>
            ))}
        </Sheet>
      </div>
    </>
  );
}

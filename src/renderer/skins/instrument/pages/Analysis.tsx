/** Analysis: one project's readouts, its line composition, and languages / categories / files / warnings. */
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CategoryMetric, FileMetric, LanguageMetric } from "../../../../shared/contracts";
import { categories, categoryLabel, number, percent, tileNumber } from "../../../format";
import { useWorkspace } from "../../../workspace";
import { memo } from "../context";
import { langColor } from "../format";
import { Icon } from "../icons";
import { ShareBar } from "../charts";
import { Button, Select, Seg } from "../ui/controls";
import { Empty, Panel, SwapIn, Tiles, type TileItem } from "../ui/layout";
import { DataTable, type Column } from "../ui/Table";
const TABS = ["Languages", "Categories", "Files", "Warnings"] as const;
type Tab = (typeof TABS)[number];
const col = <T,>(key: keyof T & string, label: string, path = false): Column<T> => ({ key, label, path, value: (r) => r[key] as string | number | null | undefined });
const category = <T extends { category: string }>(): Column<T> => ({ key: "category", label: "Category", value: (r) => categoryLabel(r.category) });
const languageColumns: Column<LanguageMetric>[] = [
  {
    key: "language",
    label: "Language",
    path: true,
    value: (r) => r.language,
    render: (r) => (
      <span className="agent-name">
        <i className="dot" style={{ background: langColor(r.language) }} />
        <span className="cell-path">{r.language}</span>
      </span>
    ),
  },
  category(),
  col("files", "Files"),
  col("bytes", "Bytes"),
  col("tokens", "Tokens"),
  { ...col<LanguageMetric>("physicalLines", "Physical"), bar: true },
  col("blankLines", "Blank"),
  col("codeLines", "Code"),
  col("commentLines", "Comment"),
  col("mixedLines", "Mixed"),
  col("contentLines", "Content"),
];
const categoryColumns: Column<CategoryMetric>[] = [
  { ...category<CategoryMetric>(), path: true },
  col("files", "Files"),
  col("tokens", "Tokens"),
  { ...col<CategoryMetric>("physicalLines", "Physical lines"), bar: true },
  col("codeOrContentLines", "Code + content"),
];
const LINE_LABELS = {
  physicalLines: "Physical",
  blankLines: "Blank",
  codeLines: "Code",
  commentLines: "Comment",
  mixedLines: "Mixed",
  contentLines: "Content",
} as const;
const fileColumns: Column<FileMetric>[] = [
  { ...col<FileMetric>("relativePath", "Path", true), className: "mono" },
  col("extension", "Extension"),
  col("language", "Language"),
  category(),
  col("bytes", "Bytes"),
  col("tokens", "Tokens"),
  ...(Object.keys(LINE_LABELS) as (keyof typeof LINE_LABELS)[]).map((k) => ({
    key: k,
    label: LINE_LABELS[k],
    value: (f: FileMetric) => f.lines[k],
    bar: k === "physicalLines" ? (true as const) : undefined,
  })),
];
export function Analysis() {
  const { state, busy, exportData, selected, setSelected } = useWorkspace();
  const [tab, setTabState] = useState<Tab>(memo.analysisTab),
    [dir, setDir] = useState(1),
    [cat, setCat] = useState("all");
  const id = useId(),
    mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
  }, []);
  const results = useMemo(() => state.settings.lastSnapshot?.projects ?? [], [state.settings.lastSnapshot]),
    result = results.find((p) => p.projectId === selected) ?? results[0];
  const languages = useMemo(() => result?.languages.filter((l) => cat === "all" || l.category === cat) ?? [], [result, cat]),
    files = useMemo(() => result?.files.filter((f) => cat === "all" || f.category === cat) ?? [], [result, cat]);
  const composition = useMemo(() => {
    if (!result) return [];
    const parts: [string, number, string][] = [
      ["Code", result.codeLines, "var(--success)"],
      ["Comment", result.commentLines, "var(--s3)"],
      ["Content", result.contentLines, "var(--s4)"],
      ["Blank", result.blankLines, "var(--line-2)"],
    ];
    return parts.map(([label, value, color]) => ({
      key: label,
      label,
      value,
      color,
      rows: [
        ["Lines", number(value)],
        ["Share", percent(value / (result.physicalLines || 1))],
      ] as [string, string][],
    }));
  }, [result]);
  if (!result) return <Empty art="story" title="Every line has a story" text="Scan a project to explore detailed language, category, file, and token metrics." />;
  const tiles: TileItem[] = [
    { label: "Files", value: result.fileCount, icon: "files" },
    { label: "Physical lines", value: result.physicalLines, fmt: tileNumber, title: number(result.physicalLines), icon: "lines" },
    { label: "Code", value: result.codeLines, fmt: tileNumber, title: number(result.codeLines), tone: "success", icon: "code" },
    { label: "Comments", value: result.commentLines, fmt: tileNumber, title: number(result.commentLines), icon: "notes" },
    { label: "Content", value: result.contentLines, fmt: tileNumber, title: number(result.contentLines), detail: "Documentation text", icon: "file" },
    { label: "Tokens", value: result.totalTokens, fmt: tileNumber, title: number(result.totalTokens), tone: "accent", icon: "token" },
  ];
  const setTab = (t: Tab) => {
    setDir(Math.sign(TABS.indexOf(t) - TABS.indexOf(tab)) || 1);
    memo.analysisTab = t;
    setTabState(t);
  };
  return (
    <>
      <div className="toolbar section-toolbar">
        <label className="inline-field">
          <span>Project</span>
          <Select label="Analysis project" value={result.projectId} options={results.map((p) => [p.projectId, p.projectName] as [string, string])} onChange={setSelected} />
        </label>
        <label className="inline-field">
          <span>Category</span>
          <Select
            label="Analysis category"
            value={cat}
            options={[["all", "All categories"] as [string, string], ...categories.map((c) => [c, categoryLabel(c)] as [string, string])]}
            onChange={setCat}
          />
        </label>
        <span className="spacer" />
        <Button label="Export CSV" icon="download" disabled={!!busy} onClick={() => void exportData("analysis", "csv")} />
        <Button label="JSON" disabled={!!busy} onClick={() => void exportData("analysis", "json")} />
      </div>
      <Tiles items={tiles} id="analysis" className="tiles-6" />
      <Panel title="Line composition" subtitle="How the physical lines of this project break down" className="panel-slim">
        <ShareBar label="Line composition" className="is-tall" items={composition} />
        <div className="legend">
          {composition.map((c) => (
            <span key={c.key} className="legend-item is-static">
              <i className="dot" style={{ background: c.color }} />
              <span>{c.label}</span>
              <b>{`${percent(c.value / (result.physicalLines || 1))} · ${number(c.value)}`}</b>
            </span>
          ))}
        </div>
      </Panel>
      <Seg<Tab>
        label="Analysis views"
        role="tablist"
        className="seg-tabs"
        value={tab}
        options={TABS.map((t) => ({ value: t, label: t, id: `${id}-tab-${t}`, controls: `${id}-panel`, badge: t === "Warnings" ? String(result.warnings.length) : undefined }))}
        onChange={setTab}
      />
      <Panel title={tab} subtitle={result.rootPath} id={`${id}-panel`} role="tabpanel" labelledBy={`${id}-tab-${tab}`}>
        <SwapIn key={tab} dir={dir} className="viewhost" skip={!mounted.current}>
          {tab === "Languages" && <DataTable label="Language analysis" rows={languages} columns={languageColumns} rowKey={(r) => r.language + r.category} />}
          {tab === "Categories" && <DataTable label="Category analysis" rows={result.categories} columns={categoryColumns} rowKey={(r) => r.category} />}
          {tab === "Files" && <DataTable label="File analysis" rows={files} columns={fileColumns} rowKey={(r) => r.relativePath} />}
          {tab === "Warnings" &&
            (result.warnings.length ? (
              <ul className="warnings">
                {result.warnings.map((w, i) => (
                  <li key={i}>
                    <Icon name="alert" size={15} />
                    <span className="mono">{w}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No warnings or skipped paths were reported.</p>
            ))}
        </SwapIn>
      </Panel>
    </>
  );
}

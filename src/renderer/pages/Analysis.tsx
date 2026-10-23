import { useId, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Card, Empty, Table, Tiles, tabKeys } from "../components";
import { categories, categoryLabel, number, tileNumber } from "../format";
import { useWorkspace } from "../workspace";
import {
  categoryColumns,
  fileColumns,
  languageColumns,
} from "./columns";
const tabs = ["Languages", "Categories", "Files", "Warnings"] as const;
export function Analysis() {
  const { state, busy, exportData, selected, setSelected } = useWorkspace();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Languages"),
    [category, setCategory] = useState("all");
  const id = useId();
  const results = state.settings.lastSnapshot?.projects ?? [],
    result = results.find((p) => p.projectId === selected) ?? results[0];
  const languages = useMemo(
      () =>
        result?.languages.filter(
          (l) => category === "all" || l.category === category,
        ) ?? [],
      [result, category],
    ),
    files = useMemo(
      () =>
        result?.files.filter(
          (f) => category === "all" || f.category === category,
        ) ?? [],
      [result, category],
    );
  if (!result)
    return (
      <Empty title="Every line has a story">
        Scan a project to explore detailed language, category, file, and token
        metrics.
      </Empty>
    );
  return (
    <>
      <div className="toolbar section-toolbar">
        <label>
          Project
          <select
            aria-label="Analysis project"
            value={result.projectId}
            onChange={(e) => setSelected(e.target.value)}
          >
            {results.map((p) => (
              <option value={p.projectId} key={p.projectId}>
                {p.projectName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            aria-label="Analysis category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <div className="spacer" />
        <button
          disabled={!!busy}
          onClick={() => void exportData("analysis", "csv")}
        >
          <Download size={15} />
          Export CSV
        </button>
        <button
          disabled={!!busy}
          onClick={() => void exportData("analysis", "json")}
        >
          JSON
        </button>
      </div>
      <Tiles
        items={[
          { label: "Files", value: number(result.fileCount) },
          {
            label: "Physical lines",
            value: tileNumber(result.physicalLines),
            title: number(result.physicalLines),
          },
          {
            label: "Code",
            value: tileNumber(result.codeLines),
            title: number(result.codeLines),
            tone: "success",
          },
          {
            label: "Comments",
            value: tileNumber(result.commentLines),
            title: number(result.commentLines),
          },
          {
            label: "Content",
            value: tileNumber(result.contentLines),
            title: number(result.contentLines),
            detail: "Documentation text",
          },
          {
            label: "Tokens",
            value: tileNumber(result.totalTokens),
            title: number(result.totalTokens),
            tone: "accent",
          },
        ]}
      />
      <div
        className="tabs"
        role="tablist"
        aria-label="Analysis views"
        onKeyDown={tabKeys}
      >
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            id={`${id}-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`${id}-panel`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "Warnings" && (
              <span className="count">{result.warnings.length}</span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`}>
        <Card title={tab} subtitle={result.rootPath}>
          {tab === "Languages" && (
            <Table
              label="Language analysis"
              rows={languages}
              columns={languageColumns}
              rowKey={(r) => r.language}
            />
          )}
          {tab === "Categories" && (
            <Table
              label="Category analysis"
              rows={result.categories}
              columns={categoryColumns}
              rowKey={(r) => r.category}
            />
          )}
          {tab === "Files" && (
            <Table
              label="File analysis"
              rows={files}
              columns={fileColumns}
              rowKey={(r) => r.relativePath}
            />
          )}
          {tab === "Warnings" &&
            (result.warnings.length ? (
              <ul className="warnings">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No warnings or skipped paths were reported.</p>
            ))}
        </Card>
      </div>
    </>
  );
}

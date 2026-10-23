import type {
  CategoryMetric,
  FileMetric,
  GitFile,
  GitProject,
  LanguageMetric,
  ProjectMetric,
} from "../../shared/contracts";
import { col, type Column } from "../components";
import { categoryLabel } from "../format";
const category = <T extends { category: string }>(): Column<T> => ({
  key: "category",
  label: "Category",
  value: (r) => categoryLabel(r.category),
});
export const projectColumns: Column<ProjectMetric>[] = [
  col("projectName", "Project", true),
  col("fileCount", "Files"),
  col("physicalLines", "Physical lines"),
  col("codeLines", "Code lines"),
  col("totalTokens", "Source tokens"),
];
export const languageColumns: Column<LanguageMetric>[] = [
  col("language", "Language", true),
  category(),
  col("files", "Files"),
  col("bytes", "Bytes"),
  col("tokens", "Tokens"),
  col("physicalLines", "Physical"),
  col("blankLines", "Blank"),
  col("codeLines", "Code"),
  col("commentLines", "Comment"),
  col("mixedLines", "Mixed"),
  col("contentLines", "Content"),
];
export const categoryColumns: Column<CategoryMetric>[] = [
  { ...category<CategoryMetric>(), path: true },
  col("files", "Files"),
  col("tokens", "Tokens"),
  col("physicalLines", "Physical lines"),
  col("codeOrContentLines", "Code + content"),
];
const lineLabels = {
  physicalLines: "Physical",
  blankLines: "Blank",
  codeLines: "Code",
  commentLines: "Comment",
  mixedLines: "Mixed",
  contentLines: "Content",
} as const;
export const fileColumns: Column<FileMetric>[] = [
  col("relativePath", "Path", true),
  col("extension", "Extension"),
  col("language", "Language"),
  category(),
  col("bytes", "Bytes"),
  col("tokens", "Tokens"),
  ...(Object.keys(lineLabels) as (keyof typeof lineLabels)[]).map((k) => ({
    key: k,
    label: lineLabels[k],
    value: (f: FileMetric) => f.lines[k],
  })),
];
export const historyProjectColumns: Column<GitProject>[] = [
  col("projectName", "Project", true),
  col("branch", "Branch"),
  {
    key: "head",
    label: "Captured HEAD",
    value: (r) => r.head,
    render: (r) => (
      // Short hashes keep the table readable; the tooltip holds the full one.
      <span className="mono" title={r.head}>
        {r.head ? r.head.slice(0, 10) : "—"}
      </span>
    ),
  },
  col("status", "Status"),
  col("added", "Added"),
  col("deleted", "Deleted"),
  col("modifiedEstimate", "Modified est."),
  col("net", "Net"),
  col("commits", "Commits"),
];
export const historyFileColumns: Column<GitFile>[] = [
  col("path", "Path", true),
  col("added", "Added"),
  col("deleted", "Deleted"),
  col("modifiedEstimate", "Modified est."),
  col("net", "Net"),
  { key: "binary", label: "Binary", value: (r) => (r.binary ? "Yes" : "No") },
];

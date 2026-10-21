import type {
  Snapshot,
  HistorySnapshot,
  DailyLog,
  AiResult,
} from "../shared/contracts";
import { timeline } from "../domain/daily";
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export const csv = (header: string[], rows: unknown[][]): string =>
  "\uFEFF" +
  header.join(",") +
  "\r\n" +
  rows.map((row) => row.map(csvCell).join(",")).join("\r\n") +
  "\r\n";
export function analysisCsv(s: Snapshot): string {
  return csv(
    [
      "Project",
      "Path",
      "Extension",
      "Language",
      "Category",
      "Bytes",
      "Tokens",
      "PhysicalLines",
      "BlankLines",
      "CodeLines",
      "CommentLines",
      "MixedLines",
      "ContentLines",
    ],
    s.projects.flatMap((p) =>
      p.files.map((f) => [
        f.projectName,
        f.relativePath,
        f.extension,
        f.language,
        f.category,
        f.bytes,
        f.tokens,
        f.lines.physicalLines,
        f.lines.blankLines,
        f.lines.codeLines,
        f.lines.commentLines,
        f.lines.mixedLines,
        f.lines.contentLines,
      ]),
    ),
  );
}
export function historyCsv(s: HistorySnapshot): string {
  const rows: unknown[][] = [];
  for (const p of s.projects) {
    const prefix = [
      p.projectName,
      p.branch,
      p.head,
      s.start,
      s.end,
      s.mode,
      s.scope,
      p.status,
      p.commits,
      p.changedFiles,
      p.binaryFiles,
    ];
    if (p.files.length)
      for (const f of p.files)
        rows.push([
          ...prefix,
          f.path,
          f.added,
          f.deleted,
          f.modifiedEstimate,
          f.net,
          f.binary,
          "File",
        ]);
    else
      rows.push([
        ...prefix,
        null,
        null,
        null,
        null,
        null,
        null,
        "ProjectStatus",
      ]);
  }
  const t = s.totals;
  rows.push([
    "All projects",
    "",
    "",
    s.start,
    s.end,
    s.mode,
    s.scope,
    `${t.projects} projects; ${t.incompleteProjects} incomplete/unavailable`,
    t.commits,
    t.changedFiles,
    t.binaryFiles,
    "",
    t.added,
    t.deleted,
    t.modifiedEstimate,
    t.net,
    "",
    "Totals",
  ]);
  return csv(
    [
      "Project",
      "Branch",
      "Head",
      "Start",
      "End",
      "Mode",
      "Scope",
      "Status",
      "Commits",
      "ChangedFiles",
      "BinaryFiles",
      "Path",
      "Added",
      "Deleted",
      "ModifiedEstimate",
      "Net",
      "Binary",
      "RecordType",
    ],
    rows,
  );
}
export function dailyCsv(
  log: DailyLog,
  projects?: string[],
  allAgents = true,
): string {
  return csv(
    [
      "Date",
      "Projects",
      "CarriedProjects",
      "Files",
      "PhysicalLines",
      "DeltaPhysicalLines",
      "CodeLines",
      "DeltaCodeLines",
      "CommentLines",
      "BlankLines",
      "ContentLines",
      "Tokens",
      "DeltaTokens",
      "AiTokens",
      "AiCost",
      "AiCostPartial",
      "Notes",
    ],
    timeline(log, projects, allAgents).map((r) => [
      r.date,
      r.projects,
      r.carriedProjects,
      r.lines?.files,
      r.lines?.physicalLines,
      r.deltaLines,
      r.lines?.codeLines,
      r.deltaCode,
      r.lines?.commentLines,
      r.lines?.blankLines,
      r.lines?.contentLines,
      r.lines?.tokens,
      r.deltaTokens,
      r.ai?.tokens,
      r.ai?.cost,
      r.ai?.costPartial,
      r.notes,
    ]),
  );
}
export const safeJson = (data: unknown): string =>
  JSON.stringify(data)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
export function reportHtml(
  result: AiResult,
  script: string,
  css: string,
): string {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'"><title>CodeLines — AI usage</title><style>' +
    css.replaceAll("</style", "<\\/style") +
    '</style></head><body><div id="root"></div><script>window.CODELINES_REPORT=' +
    safeJson(result) +
    ";</script><script>" +
    script.replaceAll("</script", "<\\/script") +
    "</script></body></html>"
  );
}

import type { Category, Scope } from "../shared/contracts";
export interface Language {
  name: string;
  category: Category;
  extensions: string[];
  names: string[];
  comments: string[];
  blocks: [string, string][];
}
const language = (
  name: string,
  category: Category,
  extensions: string[],
  comments: string[] = [],
  blocks: [string, string][] = [],
  names: string[] = [],
): Language => ({ name, category, extensions, comments, blocks, names });
const source = (
  n: string,
  e: string[],
  c: string[] = [],
  b: [string, string][] = [],
  f: string[] = [],
) => language(n, "SourceCode", e, c, b, f);
const config = (
  n: string,
  e: string[],
  c: string[] = [],
  b: [string, string][] = [],
) => language(n, "Configuration", e, c, b);
const text = (n: string, e: string[]) => language(n, "DocumentationText", e);
const cblock: [string, string][] = [["/*", "*/"]];
const xmlblock: [string, string][] = [["<!--", "-->"]];
export const languages: Language[] = [
  source("C#", [".cs"], ["//"], cblock),
  source("XAML", [".xaml"], [], xmlblock),
  source("Razor", [".razor", ".cshtml"], ["//"], [["@*", "*@"], ...xmlblock]),
  source("TypeScript", [".ts", ".tsx", ".mts", ".cts"], ["//"], cblock),
  source("JavaScript", [".js", ".jsx", ".mjs", ".cjs"], ["//"], cblock),
  source("HTML", [".html", ".htm"], [], xmlblock),
  source("CSS", [".css", ".scss", ".sass", ".less"], ["//"], cblock),
  source("SQL", [".sql"], ["--"], cblock),
  source("Dart", [".dart"], ["//"], cblock),
  source(
    "C/C++",
    [".c", ".cc", ".cpp", ".cxx", ".h", ".hh", ".hpp", ".hxx"],
    ["//"],
    cblock,
  ),
  source("Python", [".py", ".pyw"], ["#"]),
  source("Rust", [".rs"], ["//"], cblock),
  source("Java", [".java"], ["//"], cblock),
  source("Kotlin", [".kt", ".kts"], ["//"], cblock),
  source("Swift", [".swift"], ["//"], cblock),
  source("Objective-C", [".m", ".mm"], ["//"], cblock),
  source("PowerShell", [".ps1", ".psm1", ".psd1"], ["#"], [["<#", "#>"]]),
  source("Batch", [".bat", ".cmd"], ["REM ", "::"]),
  source("Shell", [".sh", ".bash", ".zsh", ".fish"], ["#"]),
  source("Go", [".go"], ["//"], cblock),
  source("PHP", [".php"], ["//", "#"], cblock),
  source("Ruby", [".rb"], ["#"]),
  source("F#", [".fs", ".fsx", ".fsi"], ["//"], [["(*", "*)"]]),
  source("Visual Basic", [".vb"], ["'"]),
  source("Lua", [".lua"], ["--"], [["--[[", "]]"]]),
  source("R", [".r"], ["#"]),
  source("Vue", [".vue"], ["//"], [...cblock, ...xmlblock]),
  source("Svelte", [".svelte"], ["//"], [...cblock, ...xmlblock]),
  source("Build Script", [".gradle"], ["#", "//"], cblock, [
    "Makefile",
    "Dockerfile",
    "Jenkinsfile",
  ]),
  config("JSON", [".json", ".jsonc"], ["//"], cblock),
  config(
    "XML",
    [
      ".xml",
      ".config",
      ".props",
      ".targets",
      ".csproj",
      ".fsproj",
      ".vbproj",
      ".vcxproj",
    ],
    [],
    xmlblock,
  ),
  config("YAML", [".yaml", ".yml"], ["#"]),
  config("TOML", [".toml"], ["#"]),
  config("INI", [".ini", ".editorconfig", ".properties"], ["#", ";"]),
  config("Solution", [".sln", ".slnx"], ["#"]),
  text("Markdown", [".md", ".markdown", ".mdx"]),
  text("Text", [".txt", ".text", ".log"]),
  text("Documentation", [".rst", ".adoc", ".asc"]),
];
export function extension(path: string): string {
  const n = path.replaceAll("\\", "/").split("/").pop() ?? "";
  const i = n.lastIndexOf(".");
  return i < 0 ? "" : n.slice(i);
}
export function classify(path: string, scope: Scope): Language | null {
  const name = path.replaceAll("\\", "/").split("/").pop()?.toLowerCase();
  const ext = extension(path).toLowerCase();
  const found = languages.find(
    (l) =>
      l.extensions.includes(ext) ||
      l.names.some((n) => n.toLowerCase() === name),
  );
  if (!found) return scope === "AllText" ? text("Plain Text", []) : null;
  return scope === "AllText" ||
    found.category === "SourceCode" ||
    (scope === "SourceAndConfiguration" && found.category === "Configuration")
    ? found
    : null;
}

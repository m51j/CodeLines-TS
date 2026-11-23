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
// Extensions and exact names are unique across the registry (a test enforces
// it). Ambiguous extensions keep one owner or stay out: .m is Objective-C (not
// MATLAB), .pl is Perl (not Prolog), and .d, .inc, .cls and .pp are
// unregistered because build outputs and unrelated languages share them.
export const languages: Language[] = [
  source("C#", [".cs", ".csx", ".cake"], ["//"], cblock),
  source("XAML", [".xaml", ".axaml"], [], xmlblock),
  source("Razor", [".razor", ".cshtml"], ["//"], [["@*", "*@"], ...xmlblock]),
  source("TypeScript", [".ts", ".tsx", ".mts", ".cts"], ["//"], cblock),
  source("JavaScript", [".js", ".jsx", ".mjs", ".cjs"], ["//"], cblock),
  source("HTML", [".html", ".htm", ".xhtml"], [], xmlblock),
  source(
    "CSS",
    [".css", ".scss", ".sass", ".less", ".styl", ".pcss"],
    ["//"],
    cblock,
  ),
  source("SQL", [".sql", ".psql", ".pgsql", ".plsql", ".ddl"], ["--"], cblock),
  source("Dart", [".dart"], ["//"], cblock),
  source(
    "C/C++",
    [
      ".c",
      ".cc",
      ".cpp",
      ".cxx",
      ".h",
      ".hh",
      ".hpp",
      ".hxx",
      ".inl",
      ".ipp",
      ".tpp",
      ".ixx",
      ".cppm",
      ".ino",
      ".cu",
      ".cuh",
    ],
    ["//"],
    cblock,
  ),
  source("Python", [".py", ".pyw", ".pyi", ".pyx", ".pxd"], ["#"]),
  source("Rust", [".rs"], ["//"], cblock),
  source("Java", [".java"], ["//"], cblock),
  source("Kotlin", [".kt", ".kts"], ["//"], cblock),
  source("Swift", [".swift"], ["//"], cblock),
  source("Objective-C", [".m", ".mm"], ["//"], cblock),
  source("PowerShell", [".ps1", ".psm1", ".psd1"], ["#"], [["<#", "#>"]]),
  source("Batch", [".bat", ".cmd"], ["REM ", "::"]),
  source("Shell", [".sh", ".bash", ".zsh", ".fish", ".ksh", ".csh"], ["#"]),
  source("Go", [".go"], ["//"], cblock),
  source("PHP", [".php", ".phtml"], ["//", "#"], cblock),
  source(
    "Ruby",
    [".rb", ".rake", ".gemspec", ".ru"],
    ["#"],
    [],
    ["Rakefile", "Gemfile", "Vagrantfile", "Podfile", "Fastfile", "Brewfile"],
  ),
  source("F#", [".fs", ".fsx", ".fsi"], ["//"], [["(*", "*)"]]),
  source("Visual Basic", [".vb", ".vbs", ".bas"], ["'"]),
  source("Lua", [".lua", ".luau"], ["--"], [["--[[", "]]"]]),
  source("R", [".r"], ["#"]),
  source("Vue", [".vue"], ["//"], [...cblock, ...xmlblock]),
  source("Svelte", [".svelte"], ["//"], [...cblock, ...xmlblock]),
  source("Astro", [".astro"], ["//"], [...cblock, ...xmlblock]),
  source(
    "Build Script",
    [".gradle", ".mk", ".dockerfile", ".just"],
    ["#", "//"],
    cblock,
    [
      "Makefile",
      "GNUmakefile",
      "Dockerfile",
      "Containerfile",
      "Jenkinsfile",
      "Justfile",
      "meson.build",
    ],
  ),
  source("CMake", [".cmake"], ["#"], [["#[[", "]]"]], ["CMakeLists.txt"]),
  source("Starlark", [".bzl", ".bazel", ".star"], ["#"]),
  // Game engines and shaders
  source("GDScript", [".gd"], ["#"]),
  source("Godot Shader", [".gdshader", ".gdshaderinc"], ["//"], cblock),
  source(
    "GLSL",
    [
      ".glsl",
      ".vert",
      ".frag",
      ".geom",
      ".comp",
      ".tesc",
      ".tese",
      ".vsh",
      ".fsh",
    ],
    ["//"],
    cblock,
  ),
  source(
    "HLSL",
    [".hlsl", ".hlsli", ".fx", ".fxh", ".cginc", ".compute", ".usf", ".ush"],
    ["//"],
    cblock,
  ),
  source("ShaderLab", [".shader"], ["//"], cblock),
  source("WGSL", [".wgsl"], ["//"], cblock),
  source("Metal", [".metal"], ["//"], cblock),
  source("GameMaker", [".gml"], ["//"], cblock),
  source("Ren'Py", [".rpy"], ["#"]),
  source("Haxe", [".hx"], ["//"], cblock),
  source("ActionScript", [".as"], ["//"], cblock),
  source("Squirrel", [".nut"], ["//", "#"], cblock),
  source("Wren", [".wren"], ["//"], cblock),
  source("Fennel", [".fnl"], [";"]),
  // General purpose
  source("Scala", [".scala", ".sc", ".sbt"], ["//"], cblock),
  source("Groovy", [".groovy", ".gvy"], ["//"], cblock),
  source("Perl", [".pl", ".pm"], ["#"]),
  source("Haskell", [".hs", ".lhs"], ["--"], [["{-", "-}"]]),
  source("Elm", [".elm"], ["--"], [["{-", "-}"]]),
  source("PureScript", [".purs"], ["--"], [["{-", "-}"]]),
  source("Lean", [".lean"], ["--"], [["/-", "-/"]]),
  source("OCaml", [".ml", ".mli"], [], [["(*", "*)"]]),
  source("Elixir", [".ex", ".exs"], ["#"]),
  source("Erlang", [".erl", ".hrl"], ["%"]),
  source("Gleam", [".gleam"], ["//"]),
  source("Clojure", [".clj", ".cljs", ".cljc", ".edn"], [";"]),
  source("Lisp", [".lisp", ".lsp", ".el"], [";"], [["#|", "|#"]]),
  source("Scheme", [".scm", ".ss", ".rkt"], [";"], [["#|", "|#"]]),
  source("Zig", [".zig", ".zon"], ["//"]),
  source("Odin", [".odin"], ["//"], cblock),
  source("Nim", [".nim", ".nims", ".nimble"], ["#"], [["#[", "]#"]]),
  source("Crystal", [".cr"], ["#"]),
  source("Julia", [".jl"], ["#"], [["#=", "=#"]]),
  source("Vala", [".vala", ".vapi"], ["//"], cblock),
  source("Fortran", [".f", ".for", ".f90", ".f95", ".f03", ".f08"], ["!"]),
  source(
    "Pascal",
    [".pas", ".dpr", ".dpk", ".lpr"],
    ["//"],
    [
      ["{", "}"],
      ["(*", "*)"],
    ],
  ),
  source("Ada", [".adb", ".ads", ".ada"], ["--"]),
  source("COBOL", [".cob", ".cbl", ".cpy"], ["*>"]),
  source("Tcl", [".tcl"], ["#"]),
  source("AWK", [".awk"], ["#"]),
  source("CoffeeScript", [".coffee"], ["#"], [["###", "###"]]),
  source("QML", [".qml"], ["//"], cblock),
  source("Solidity", [".sol"], ["//"], cblock),
  source("Nix", [".nix"], ["#"], cblock),
  source("AutoHotkey", [".ahk"], [";"], cblock),
  source("AutoIt", [".au3"], [";"], [["#cs", "#ce"]]),
  source("Inno Setup", [".iss"], [";", "//"]),
  source("NSIS", [".nsi", ".nsh"], [";", "#"], cblock),
  source("Gherkin", [".feature"], ["#"]),
  // Hardware, embedded and low level
  source("Assembly", [".asm", ".s", ".nasm"], [";", "//"], cblock),
  source("Verilog", [".v", ".vh", ".sv", ".svh"], ["//"], cblock),
  source("VHDL", [".vhd", ".vhdl"], ["--"]),
  source(
    "Structured Text",
    [".st", ".iecst"],
    ["//"],
    [["(*", "*)"], ...cblock],
  ),
  source("Linker Script", [".ld", ".lds"], [], cblock),
  source("Device Tree", [".dts", ".dtsi"], ["//"], cblock),
  source("Resource Script", [".rc", ".rc2"], ["//"], cblock),
  source("WebAssembly", [".wat", ".wast"], [";;"], [["(;", ";)"]]),
  // Schemas and infrastructure
  source("Protocol Buffers", [".proto"], ["//"], cblock),
  source("Thrift", [".thrift"], ["//", "#"], cblock),
  source("GraphQL", [".graphql", ".gql"], ["#"]),
  source("Prisma", [".prisma"], ["//"]),
  source("Terraform", [".tf", ".tfvars", ".hcl"], ["#", "//"], cblock),
  source("Bicep", [".bicep"], ["//"], cblock),
  // Templates
  source("ERB", [".erb"], [], [["<%#", "%>"], ...xmlblock]),
  source("EJS", [".ejs"], [], [["<%#", "%>"], ...xmlblock]),
  source("JSP", [".jsp", ".jspx"], [], [["<%--", "--%>"], ...xmlblock]),
  source("Jinja", [".jinja", ".jinja2", ".j2"], [], [["{#", "#}"]]),
  source("Twig", [".twig"], [], [["{#", "#}"]]),
  source(
    "Handlebars",
    [".hbs", ".handlebars", ".mustache"],
    [],
    [["{{!--", "--}}"], ["{{!", "}}"], ...xmlblock],
  ),
  source(
    "Liquid",
    [".liquid"],
    [],
    [["{% comment %}", "{% endcomment %}"], ...xmlblock],
  ),
  source("Pug", [".pug", ".jade"], ["//"]),
  config(
    "JSON",
    [
      ".json",
      ".jsonc",
      ".json5",
      ".webmanifest",
      ".code-workspace",
      ".asmdef",
      ".uproject",
      ".uplugin",
    ],
    ["//"],
    cblock,
  ),
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
      ".sqlproj",
      ".shproj",
      ".projitems",
      ".pubxml",
      ".nuspec",
      ".ruleset",
      ".resx",
      ".xsd",
      ".xsl",
      ".xslt",
      ".plist",
      ".wxs",
      ".wxi",
    ],
    [],
    xmlblock,
  ),
  config("YAML", [".yaml", ".yml"], ["#"]),
  config("TOML", [".toml"], ["#"]),
  config(
    "INI",
    [".ini", ".editorconfig", ".properties", ".cfg", ".conf"],
    ["#", ";"],
  ),
  // Scenes, resources and project settings share Godot's ConfigFile syntax.
  // Generated .import and .uid sidecars are deliberately left unregistered.
  config("Godot Resource", [".tscn", ".tres", ".godot", ".gdextension"], [";"]),
  config("Solution", [".sln", ".slnx"], ["#"]),
  text("Markdown", [".md", ".markdown", ".mdx", ".rmd", ".qmd"]),
  text("Text", [".txt", ".text", ".log"]),
  text("Documentation", [".rst", ".adoc", ".asc", ".org"]),
  text("LaTeX", [".tex", ".bib"]),
];
const byExtension = new Map<string, Language>(),
  byName = new Map<string, Language>();
for (const l of languages) {
  for (const e of l.extensions) if (!byExtension.has(e)) byExtension.set(e, l);
  for (const n of l.names)
    if (!byName.has(n.toLowerCase())) byName.set(n.toLowerCase(), l);
}
export function extension(path: string): string {
  const n = path.replaceAll("\\", "/").split("/").pop() ?? "";
  const i = n.lastIndexOf(".");
  return i < 0 ? "" : n.slice(i);
}
export function classify(path: string, scope: Scope): Language | null {
  const name = path.replaceAll("\\", "/").split("/").pop()?.toLowerCase() ?? "";
  // An exact file name outranks its extension (CMakeLists.txt is not Text).
  const found =
    byName.get(name) ?? byExtension.get(extension(path).toLowerCase());
  if (!found) return scope === "AllText" ? text("Plain Text", []) : null;
  return scope === "AllText" ||
    found.category === "SourceCode" ||
    (scope === "SourceAndConfiguration" && found.category === "Configuration")
    ? found
    : null;
}

import fs from "node:fs/promises";

/** The CHANGELOG section for one version: the text under "## <version>" up to the next "## ". */
export function releaseNotes(changelog: string, version: string): string {
  const lines = changelog.replaceAll("\r\n", "\n").split("\n");
  // "## 1.2.0 — date", "## v1.2.0" or "## [1.2.0]": the version, then a space or the line end.
  const start = lines.findIndex((l) => {
    const head = l.startsWith("## ") ? l.slice(3).replace(/^\[?v?/, "") : null;
    return head !== null && head.startsWith(version) && /^(\]|\s|$)/.test(head.slice(version.length));
  });
  if (start < 0) throw new Error(`CHANGELOG.md has no "## ${version}" section.`);
  const end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  const body = lines.slice(start + 1, end < 0 ? undefined : end).join("\n").trim();
  if (!body) throw new Error(`The CHANGELOG.md section for ${version} is empty.`);
  return body + "\n";
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/release-notes.ts")) {
  const version = process.argv[2];
  if (!version) throw new Error("Usage: tsx scripts/release-notes.ts <version>");
  process.stdout.write(releaseNotes(await fs.readFile("CHANGELOG.md", "utf8"), version));
}

import fs from "node:fs/promises";
import path from "node:path";
const lock = JSON.parse(await fs.readFile("package-lock.json", "utf8")) as {
  packages: Record<
    string,
    { dev?: boolean; license?: string; version?: string }
  >;
};
const sections: string[] = [
  "CodeLines TS — installed production dependency license notices\nGenerated from package-lock.json. Electron includes additional notices in its distribution.",
];
for (const [directory, p] of Object.entries(lock.packages)) {
  if (!directory || p.dev) continue;
  let names: string[];
  try {
    names = await fs.readdir(directory);
  } catch {
    continue;
  }
  const licenses = names.filter((n) =>
    /^(licen[cs]e|copying|notice)([.-]|$)/i.test(n),
  );
  sections.push(
    `\n${"=".repeat(72)}\n${directory} @ ${p.version ?? ""}\nDeclared license: ${p.license ?? "See package source"}\n`,
  );
  for (const name of licenses) {
    const file = path.join(directory, name);
    if ((await fs.stat(file)).isFile())
      sections.push(name + "\n" + (await fs.readFile(file, "utf8")));
  }
}
await fs.mkdir("docs", { recursive: true });
await fs.writeFile(
  "docs/THIRD-PARTY-LICENSES.txt",
  sections.join("\n"),
  "utf8",
);
